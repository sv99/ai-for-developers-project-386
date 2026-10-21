// Package handlers держит HTTP-слой сервера: тонкие хендлеры над store.
// Доменные правила — в internal/calendar; решения — wayfinder-карта #61.
package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

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
