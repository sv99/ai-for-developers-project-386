// Package handlers держит HTTP-слой сервера: тонкие хендлеры над store.
// Доменные правила — в internal/calendar; решения — wayfinder-карта #61.
package handlers

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"

	"github.com/sv99/ai-for-developers-project-386/server/gen"
	"github.com/sv99/ai-for-developers-project-386/server/internal/calendar"
	"github.com/sv99/ai-for-developers-project-386/server/internal/store"
)

// Server реализует gen.ServerInterface. Встроенный gen.Unimplemented даёт
// заглушки 501 для операций, которые приходят в вехе 4 (запись: брони, типы, настройки).
type Server struct {
	gen.Unimplemented
	store  *store.Store // nil, если сервер запущен без DATABASE_URL
	loc    *time.Location
	logger *slog.Logger
}

func NewServer(logger *slog.Logger, st *store.Store, loc *time.Location) *Server {
	return &Server{store: st, loc: loc, logger: logger}
}

// NewRouter — собирает chi-роутер контракта: единая точка для main и тестов.
// CORS нужен только в проде (фронт и API на разных origins); в dev — Vite proxy.
func NewRouter(logger *slog.Logger, st *store.Store, loc *time.Location) http.Handler {
	r := chi.NewRouter()
	if origins := os.Getenv("CORS_ORIGINS"); origins != "" {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins: strings.Split(origins, ","),
			AllowedMethods: []string{"GET", "POST", "PUT", "OPTIONS"},
		}))
	}
	r.Mount("/", gen.Handler(NewServer(logger, st, loc)))
	return r
}

// now — «сейчас» в поясе владельца (ADR 0004): единая точка отсчёта окна и прошедшего.
func (s *Server) now() time.Time { return time.Now().In(s.loc) }

// Health — проверка состояния (GET /health).
func (s *Server) Health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, gen.HealthOk{Ok: true})
}

// ListEventTypes — все Типы событий (GET /event-types).
func (s *Server) ListEventTypes(w http.ResponseWriter, r *http.Request) {
	if s.missingDB(w) {
		return
	}
	types, err := s.store.ListEventTypes(r.Context())
	if err != nil {
		s.fail(w, "list event types", err)
		return
	}
	writeJSON(w, http.StatusOK, types)
}

// ListBookings — все Записи, включая отменённые и прошедшие (GET /bookings).
func (s *Server) ListBookings(w http.ResponseWriter, r *http.Request) {
	if s.missingDB(w) {
		return
	}
	bookings, err := s.store.ListBookings(r.Context())
	if err != nil {
		s.fail(w, "list bookings", err)
		return
	}
	writeJSON(w, http.StatusOK, bookings)
}

// ListUpcomingBookings — предстоящие Записи владельца (GET /bookings/upcoming).
func (s *Server) ListUpcomingBookings(w http.ResponseWriter, r *http.Request) {
	if s.missingDB(w) {
		return
	}
	bookings, err := s.store.ListUpcomingBookings(r.Context(), s.now())
	if err != nil {
		s.fail(w, "list upcoming bookings", err)
		return
	}
	writeJSON(w, http.StatusOK, bookings)
}

// ListDaySlots — Слоты дня со статусами (GET /slots?date=).
func (s *Server) ListDaySlots(w http.ResponseWriter, r *http.Request, params gen.ListDaySlotsParams) {
	slots, ok := s.daySlots(w, r, params.Date)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, slots)
}

// CountFreeSlots — число свободных Слотов дня (GET /slots/free-count?date=).
func (s *Server) CountFreeSlots(w http.ResponseWriter, r *http.Request, params gen.CountFreeSlotsParams) {
	slots, ok := s.daySlots(w, r, params.Date)
	if !ok {
		return
	}
	count := int32(0)
	for _, slot := range slots {
		if slot.Status == gen.Free {
			count++
		}
	}
	writeJSON(w, http.StatusOK, gen.FreeSlotsCount{Count: count})
}

// BookingWindowEnd — последний день окна регистрации (GET /booking-window-end).
func (s *Server) BookingWindowEnd(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, gen.BookingWindowEnd{Date: calendar.WindowEnd(s.now())})
}

// GetCalendarName — имя календаря владельца (GET /settings/calendar-name).
func (s *Server) GetCalendarName(w http.ResponseWriter, r *http.Request) {
	if s.missingDB(w) {
		return
	}
	name, err := s.store.GetCalendarName(r.Context())
	if err != nil {
		s.fail(w, "get calendar name", err)
		return
	}
	writeJSON(w, http.StatusOK, gen.CalendarName{Name: name})
}

// CreateBooking — создаёт Запись (POST /bookings). Порядок валидаций — как в v1:
// Тип события → дата → сетка → рабочий день → контакты → конфликт времени.
// Дата вне окна и прошедшее время — новые проверки сервера (решение Q2-а/Q3, резолюция #62).
func (s *Server) CreateBooking(w http.ResponseWriter, r *http.Request) {
	if s.missingDB(w) {
		return
	}
	var input gen.BookingInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "Проверьте данные запроса")
		return
	}
	ctx := r.Context()
	now := s.now()

	duration, err := s.store.EventTypeDuration(ctx, input.EventTypeId)
	if errors.Is(err, store.ErrEventTypeNotFound) {
		writeError(w, http.StatusNotFound, "Тип события не найден")
		return
	}
	if err != nil {
		s.fail(w, "event type lookup", err)
		return
	}

	if input.Date == "" {
		writeError(w, http.StatusBadRequest, "Выберите дату")
		return
	}
	if !calendar.IsBookableDate(input.Date, now) {
		writeError(w, http.StatusBadRequest, "Выберите дату из окна регистрации")
		return
	}
	if !calendar.IsStartTime(input.StartTime) {
		writeError(w, http.StatusBadRequest, "Выберите время начала из доступных")
		return
	}
	if !calendar.FitsInDay(input.StartTime, int(duration)) {
		writeError(w, http.StatusBadRequest, "Событие не помещается до конца рабочего дня")
		return
	}
	name := strings.TrimSpace(input.Contact.Name)
	phone := strings.TrimSpace(input.Contact.Phone)
	if name == "" {
		writeError(w, http.StatusBadRequest, "Введите имя")
		return
	}
	if phone == "" {
		writeError(w, http.StatusBadRequest, "Введите телефон")
		return
	}
	startsAt, err := calendar.Moment(input.Date, input.StartTime)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Выберите дату")
		return
	}
	if !startsAt.After(calendar.NaiveNow(now)) {
		writeError(w, http.StatusBadRequest, "Выберите время в будущем")
		return
	}

	booking, err := s.store.CreateBooking(ctx, input.EventTypeId, input.Date, input.StartTime,
		startsAt, int(duration), name, phone)
	switch {
	case errors.Is(err, store.ErrSlotConflict):
		writeError(w, http.StatusConflict, "Это время уже занято. Выберите другое время.")
	case errors.Is(err, store.ErrEventTypeNotFound):
		writeError(w, http.StatusNotFound, "Тип события не найден")
	case err != nil:
		s.fail(w, "create booking", err)
	default:
		writeJSON(w, http.StatusCreated, booking)
	}
}

// CancelBooking — отменяет Запись (POST /bookings/{id}/cancel).
func (s *Server) CancelBooking(w http.ResponseWriter, r *http.Request, id string) {
	if s.missingDB(w) {
		return
	}
	booking, err := s.store.CancelBooking(r.Context(), id)
	switch {
	case errors.Is(err, store.ErrBookingNotFound):
		writeError(w, http.StatusNotFound, "Запись не найдена")
	case errors.Is(err, store.ErrBookingCancelled):
		writeError(w, http.StatusBadRequest, "Запись уже отменена")
	case err != nil:
		s.fail(w, "cancel booking", err)
	default:
		writeJSON(w, http.StatusOK, booking)
	}
}

// CreateEventType — новый вид звонка (POST /event-types).
func (s *Server) CreateEventType(w http.ResponseWriter, r *http.Request) {
	if s.missingDB(w) {
		return
	}
	var input gen.EventTypeInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "Проверьте данные запроса")
		return
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "Название типа события обязательно")
		return
	}
	if input.DurationMinutes < 1 {
		writeError(w, http.StatusBadRequest, "Длительность должна быть целым числом минут")
		return
	}
	eventType, err := s.store.CreateEventType(r.Context(), name, strings.TrimSpace(input.Description), int(input.DurationMinutes))
	if err != nil {
		s.fail(w, "create event type", err)
		return
	}
	writeJSON(w, http.StatusCreated, eventType)
}

// SetCalendarName — сохраняет имя календаря владельца (PUT /settings/calendar-name).
func (s *Server) SetCalendarName(w http.ResponseWriter, r *http.Request) {
	if s.missingDB(w) {
		return
	}
	var input gen.CalendarName
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "Проверьте данные запроса")
		return
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "Введите имя календаря")
		return
	}
	if err := s.store.SetCalendarName(r.Context(), name); err != nil {
		s.fail(w, "set calendar name", err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// daySlots — общая часть ListDaySlots/CountFreeSlots: валидация даты и построение сетки.
func (s *Server) daySlots(w http.ResponseWriter, r *http.Request, date string) ([]gen.DaySlot, bool) {
	if _, err := time.Parse("2006-01-02", date); err != nil {
		writeError(w, http.StatusBadRequest, "Выберите дату")
		return nil, false
	}
	if s.missingDB(w) {
		return nil, false
	}
	now := s.now()
	ranges, err := s.store.ActiveRangesForDate(r.Context(), date)
	if err != nil {
		s.fail(w, "list active ranges", err)
		return nil, false
	}
	slots, err := calendar.BuildDaySlots(date, now, calendar.IsBookableDate(date, now), ranges)
	if err != nil {
		s.fail(w, "build day slots", err)
		return nil, false
	}
	return slots, true
}

// missingDB — операции store недоступны, если сервер запущен без DATABASE_URL.
func (s *Server) missingDB(w http.ResponseWriter) bool {
	if s.store == nil {
		writeError(w, http.StatusServiceUnavailable, "База данных не подключена")
		return true
	}
	return false
}

func (s *Server) fail(w http.ResponseWriter, what string, err error) {
	s.logger.Error("store operation failed", "op", what, "err", err)
	writeError(w, http.StatusInternalServerError, "Внутренняя ошибка сервера")
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, gen.ApiError{Message: message})
}
