package handlers_test

// HTTP-тесты операций записи: реальный роутер + реальный Postgres (compose локально,
// service-контейнер в CI). Без DATABASE_URL — пропуск (решение #68).
// Сообщения валидации — контрактные: UI показывает их как есть.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/sv99/ai-for-developers-project-386/server/internal/handlers"
	"github.com/sv99/ai-for-developers-project-386/server/internal/store"
)

var testDBURL string

func TestMain(m *testing.M) {
	testDBURL = os.Getenv("DATABASE_URL")
	if testDBURL == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL не задан — HTTP-тесты пропущены")
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func newTestHandler(t *testing.T) http.Handler {
	t.Helper()
	ctx := context.Background()
	pool, err := store.Connect(ctx, testDBURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	if err := store.Migrate(ctx, testDBURL); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire: %v", err)
	}
	if _, err := conn.Exec(ctx, `truncate bookings, event_types, settings`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	conn.Release()
	t.Cleanup(pool.Close)
	return handlers.NewRouter(slog.New(slog.NewTextHandler(io.Discard, nil)), store.New(pool), time.UTC)
}

// post — helper: тело → ответ; возвращает статус и разобранный JSON.
func post(t *testing.T, handler http.Handler, method, path string, body any) (int, map[string]any) {
	t.Helper()
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		reader = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)

	var parsed map[string]any
	if res.Body.Len() > 0 {
		if err := json.Unmarshal(res.Body.Bytes(), &parsed); err != nil {
			t.Fatalf("response is not JSON: %q", res.Body.String())
		}
	}
	return res.Code, parsed
}

func createEventType(t *testing.T, handler http.Handler, durationMinutes int) string {
	t.Helper()
	code, body := post(t, handler, http.MethodPost, "/event-types", map[string]any{
		"name":            "Вводный звонок",
		"description":     "",
		"durationMinutes": durationMinutes,
	})
	if code != http.StatusCreated {
		t.Fatalf("create event type: status %d, body %v", code, body)
	}
	id, _ := body["id"].(string)
	if id == "" {
		t.Fatalf("no id in response: %v", body)
	}
	return id
}

// tomorrow — завтрашняя дата (UTC): гарантированно в окне и в будущем.
func tomorrow() string { return time.Now().UTC().AddDate(0, 0, 1).Format("2006-01-02") }

func bookingInput(eventTypeID, date, startTime string) map[string]any {
	return map[string]any{
		"eventTypeId": eventTypeID,
		"date":        date,
		"startTime":   startTime,
		"contact":     map[string]any{"name": "Гость", "phone": "+7 900 000-00-00"},
	}
}

func TestCreateBooking201And409(t *testing.T) {
	handler := newTestHandler(t)
	typeID := createEventType(t, handler, 60)

	code, body := post(t, handler, http.MethodPost, "/bookings", bookingInput(typeID, tomorrow(), "09:00"))
	if code != http.StatusCreated {
		t.Fatalf("want 201, got %d: %v", code, body)
	}
	if body["status"] != "active" || body["date"] != tomorrow() || body["startTime"] != "09:00" {
		t.Fatalf("booking fields wrong: %v", body)
	}

	// Пересечение 09:30–10:30 с занятым [09:00, 10:00) → 409 с контрактовым сообщением.
	code, body = post(t, handler, http.MethodPost, "/bookings", bookingInput(typeID, tomorrow(), "09:30"))
	if code != http.StatusConflict || body["message"] != "Это время уже занято. Выберите другое время." {
		t.Fatalf("want 409 conflict, got %d: %v", code, body)
	}

	// Касающийся интервал [10:00, 11:00) — проходит.
	code, _ = post(t, handler, http.MethodPost, "/bookings", bookingInput(typeID, tomorrow(), "10:00"))
	if code != http.StatusCreated {
		t.Fatalf("touching interval must be 201, got %d", code)
	}
}

func TestCreateBookingValidations(t *testing.T) {
	handler := newTestHandler(t)
	typeID := createEventType(t, handler, 60)
	date := tomorrow()

	cases := []struct {
		name    string
		input   map[string]any
		status  int
		message string
	}{
		{
			name:    "неизвестный тип (валидный uuid)",
			input:   bookingInput("00000000-0000-0000-0000-000000000000", date, "09:00"),
			status:  http.StatusNotFound,
			message: "Тип события не найден",
		},
		{
			name:    "невалидный id типа",
			input:   bookingInput("не-uuid", date, "09:00"),
			status:  http.StatusNotFound,
			message: "Тип события не найден",
		},
		{
			name: "пустая дата",
			input: map[string]any{
				"eventTypeId": typeID, "date": "", "startTime": "09:00",
				"contact": map[string]any{"name": "Гость", "phone": "1"},
			},
			status:  http.StatusBadRequest,
			message: "Выберите дату",
		},
		{
			name:    "дата вне окна регистрации",
			input:   bookingInput(typeID, "2020-01-01", "09:00"),
			status:  http.StatusBadRequest,
			message: "Выберите дату из окна регистрации",
		},
		{
			name:    "время вне сетки",
			input:   bookingInput(typeID, date, "09:10"),
			status:  http.StatusBadRequest,
			message: "Выберите время начала из доступных",
		},
		{
			name:    "не помещается до 18:00",
			input:   bookingInput(typeID, date, "17:30"),
			status:  http.StatusBadRequest,
			message: "Событие не помещается до конца рабочего дня",
		},
		{
			name: "пустое имя",
			input: map[string]any{
				"eventTypeId": typeID, "date": date, "startTime": "09:00",
				"contact": map[string]any{"name": "   ", "phone": "+7"},
			},
			status:  http.StatusBadRequest,
			message: "Введите имя",
		},
		{
			name: "пустой телефон",
			input: map[string]any{
				"eventTypeId": typeID, "date": date, "startTime": "09:00",
				"contact": map[string]any{"name": "Гость", "phone": ""},
			},
			status:  http.StatusBadRequest,
			message: "Введите телефон",
		},
	}
	for _, tc := range cases {
		code, body := post(t, handler, http.MethodPost, "/bookings", tc.input)
		if code != tc.status || body["message"] != tc.message {
			t.Fatalf("%s: want %d %q, got %d %v", tc.name, tc.status, tc.message, code, body)
		}
	}
}

func TestCreateBookingRejectsPastTime(t *testing.T) {
	handler := newTestHandler(t)
	typeID := createEventType(t, handler, 30)

	// Детерминированно: сегодня 09:00 прошло, если сейчас UTC ≥ 09:00 (резолюция #62: start ≤ now — прошло).
	now := time.Now().UTC()
	today := now.Format("2006-01-02")
	code, body := post(t, handler, http.MethodPost, "/bookings", bookingInput(typeID, today, "09:00"))

	if !now.Before(time.Date(now.Year(), now.Month(), now.Day(), 9, 0, 0, 0, time.UTC)) {
		if code != http.StatusBadRequest || body["message"] != "Выберите время в будущем" {
			t.Fatalf("past time: want 400 «Выберите время в будущем», got %d %v", code, body)
		}
		return
	}
	if code != http.StatusCreated {
		t.Fatalf("before 09:00 UTC the 09:00 slot is still future: want 201, got %d %v", code, body)
	}
}

func TestCancelBooking404and400(t *testing.T) {
	handler := newTestHandler(t)
	typeID := createEventType(t, handler, 30)

	code, body := post(t, handler, http.MethodPost, "/bookings/00000000-0000-0000-0000-000000000000/cancel", nil)
	if code != http.StatusNotFound || body["message"] != "Запись не найдена" {
		t.Fatalf("want 404, got %d %v", code, body)
	}

	code, body = post(t, handler, http.MethodPost, "/bookings/abc/cancel", nil)
	if code != http.StatusNotFound || body["message"] != "Запись не найдена" {
		t.Fatalf("invalid id: want 404, got %d %v", code, body)
	}

	code, created := post(t, handler, http.MethodPost, "/bookings", bookingInput(typeID, tomorrow(), "09:00"))
	if code != http.StatusCreated {
		t.Fatalf("create: %d %v", code, created)
	}
	id, _ := created["id"].(string)

	code, body = post(t, handler, http.MethodPost, "/bookings/"+id+"/cancel", nil)
	if code != http.StatusOK || body["status"] != "cancelled" {
		t.Fatalf("want 200 cancelled, got %d %v", code, body)
	}

	// Повторная отмена → 400 «уже отменена».
	code, body = post(t, handler, http.MethodPost, "/bookings/"+id+"/cancel", nil)
	if code != http.StatusBadRequest || body["message"] != "Запись уже отменена" {
		t.Fatalf("second cancel: want 400, got %d %v", code, body)
	}
}

func TestListBookingsKeepsCancelled(t *testing.T) {
	handler := newTestHandler(t)
	typeID := createEventType(t, handler, 30)

	code, created := post(t, handler, http.MethodPost, "/bookings", bookingInput(typeID, tomorrow(), "09:00"))
	if code != http.StatusCreated {
		t.Fatalf("create: %d %v", code, created)
	}
	id, _ := created["id"].(string)

	code, body := post(t, handler, http.MethodPost, "/bookings/"+id+"/cancel", nil)
	if code != http.StatusOK {
		t.Fatalf("cancel: %d %v", code, body)
	}

	req := httptest.NewRequest(http.MethodGet, "/bookings", nil)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"status":"cancelled"`) {
		t.Fatalf("cancelled booking must remain in /bookings: %d %s", res.Code, res.Body.String())
	}
}

func TestCreateEventTypeValidation(t *testing.T) {
	handler := newTestHandler(t)

	code, body := post(t, handler, http.MethodPost, "/event-types", map[string]any{
		"name": "   ", "description": "", "durationMinutes": 30,
	})
	if code != http.StatusBadRequest || body["message"] != "Название типа события обязательно" {
		t.Fatalf("empty name: want 400, got %d %v", code, body)
	}

	code, body = post(t, handler, http.MethodPost, "/event-types", map[string]any{
		"name": "Звонок", "description": "", "durationMinutes": 0,
	})
	if code != http.StatusBadRequest || body["message"] != "Длительность должна быть целым числом минут" {
		t.Fatalf("zero duration: want 400, got %d %v", code, body)
	}

	code, body = post(t, handler, http.MethodPost, "/event-types", map[string]any{
		"name": "Звонок", "description": "Про продукт", "durationMinutes": 45,
	})
	if code != http.StatusCreated || body["durationMinutes"] != float64(45) {
		t.Fatalf("happy path: want 201, got %d %v", code, body)
	}
}

func TestSetCalendarName(t *testing.T) {
	handler := newTestHandler(t)

	code, body := post(t, handler, http.MethodPut, "/settings/calendar-name", map[string]any{"name": "   "})
	if code != http.StatusBadRequest || body["message"] != "Введите имя календаря" {
		t.Fatalf("empty name: want 400, got %d %v", code, body)
	}

	code, body = post(t, handler, http.MethodPut, "/settings/calendar-name", map[string]any{"name": "  Моя звонилка  "})
	if code != http.StatusOK || body != nil {
		t.Fatalf("save: want 200 empty body, got %d %v", code, body)
	}

	code, body = post(t, handler, http.MethodGet, "/settings/calendar-name", nil)
	if code != http.StatusOK || body["name"] != "Моя звонилка" {
		t.Fatalf("after save: want trimmed name, got %d %v", code, body)
	}
}
