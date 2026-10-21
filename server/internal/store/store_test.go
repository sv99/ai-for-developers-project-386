package store_test

// Интеграционные тесты схемы и миграций: против живого Postgres по DATABASE_URL
// (локально — compose-БД, в CI — service-контейнер). Без переменной — пропуск.
//
// Проверяют решения wayfinder-карты (#61): EXCLUDE-инвариант двойной брони,
// полуинтервалы (касание не конфликт), освобождение времени после отмены.

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/sv99/ai-for-developers-project-386/server/internal/store"
)

var testDBURL string

func TestMain(m *testing.M) {
	testDBURL = os.Getenv("DATABASE_URL")
	if testDBURL == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL не задан — интеграционные тесты store пропущены")
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func setupTestDB(t *testing.T) (*pgx.Conn, func()) {
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

	// Изоляция: каждый тест стартует с чистой БД (решение #68 — TRUNCATE).
	_, err = conn.Exec(ctx, `truncate bookings, event_types, settings`)
	if err != nil {
		t.Fatalf("truncate: %v", err)
	}

	cleanup := func() { conn.Release(); pool.Close() }
	return conn.Conn(), cleanup
}

// insertEventType и insertBooking выполняют сырой SQL — store-методы появятся в вехе 3.
func insertEventType(t *testing.T, pg tx, name string, durationMinutes int) string {
	t.Helper()
	var id string
	err := pg.QueryRow(context.Background(),
		`insert into event_types (name, description, duration_minutes)
		 values ($1, '', $2) returning id`,
		name, durationMinutes,
	).Scan(&id)
	if err != nil {
		t.Fatalf("insert event type: %v", err)
	}
	return id
}

func insertBooking(t *testing.T, pg tx, eventTypeID, date, startTime string, durationMinutes int) error {
	t.Helper()
	_, err := pg.Exec(context.Background(),
		`insert into bookings (event_type_id, date, start_time, duration_minutes, ends_at,
		                       guest_name, guest_phone)
		 values ($1, $2::date, $3::time, $4, ($2::date + $3::time) + make_interval(mins => $4),
		         'Гость', '+7 900 000-00-00')`,
		eventTypeID, date, startTime, durationMinutes,
	)
	return err
}

// tx — минимальный интерфейс БД для хелперов: *pgx.Conn и pgx.Tx оба ему удовлетворяют.
type tx interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func TestMigrationCreatesSchema(t *testing.T) {
	pg, cleanup := setupTestDB(t)
	defer cleanup()

	var tableCount int
	err := pg.QueryRow(context.Background(),
		`select count(*) from information_schema.tables
		 where table_schema = 'public' and table_name in ('event_types', 'bookings', 'settings')`,
	).Scan(&tableCount)
	if err != nil {
		t.Fatalf("query tables: %v", err)
	}
	if tableCount != 3 {
		t.Fatalf("want 3 tables, got %d", tableCount)
	}
}

func TestDoubleBookingConflict(t *testing.T) {
	pg, cleanup := setupTestDB(t)
	defer cleanup()

	ctx := context.Background()
	typeID := insertEventType(t, pg, "Вводный звонок", 60)

	if err := insertBooking(t, pg, typeID, "2026-11-01", "09:00", 60); err != nil {
		t.Fatalf("insert first booking: %v", err)
	}

	// Пересечение 09:30–10:30 с занятым [09:00, 10:00) — конфликт.
	err := insertBooking(t, pg, typeID, "2026-11-01", "09:30", 60)
	if !isExclusionViolation(err) {
		t.Fatalf("want exclusion violation (23P01), got %v", err)
	}

	// Другой день — не конфликт.
	if err := insertBooking(t, pg, typeID, "2026-11-02", "09:30", 60); err != nil {
		t.Fatalf("same time, other day must not conflict: %v", err)
	}

	// Отмена освобождает время: после неё бронь 09:00 проходит.
	if _, err := pg.Exec(ctx,
		`update bookings set status = 'cancelled' where date = '2026-11-01'`); err != nil {
		t.Fatalf("cancel: %v", err)
	}
	if err := insertBooking(t, pg, typeID, "2026-11-01", "09:30", 60); err != nil {
		t.Fatalf("rebooking after cancel must succeed: %v", err)
	}
}

func TestTouchingIntervalsDoNotConflict(t *testing.T) {
	pg, cleanup := setupTestDB(t)
	defer cleanup()

	typeID := insertEventType(t, pg, "Вводный звонок", 60)

	// [09:00, 10:00) и [10:00, 11:00) — касание, не пересечение (решение #62).
	if err := insertBooking(t, pg, typeID, "2026-11-01", "09:00", 60); err != nil {
		t.Fatalf("insert first: %v", err)
	}
	if err := insertBooking(t, pg, typeID, "2026-11-01", "10:00", 60); err != nil {
		t.Fatalf("touching interval must not conflict: %v", err)
	}
}

func TestDurationSnapshotConsistency(t *testing.T) {
	pg, cleanup := setupTestDB(t)
	defer cleanup()

	typeID := insertEventType(t, pg, "Вводный звонок", 60)

	// Ломаем снапшот: ends_at не согласован с duration_minutes — CHECK должен упасть.
	err := insertBooking(t, pg, typeID, "2026-11-01", "09:00", 30) // ends_at = 09:30 при duration 30 — согласовано
	if err != nil {
		t.Fatalf("consistent snapshot must insert: %v", err)
	}
	_, err = pg.Exec(context.Background(),
		`update bookings set duration_minutes = 60 where date = '2026-11-01'`)
	if !isCheckViolation(err) {
		t.Fatalf("want check violation (23514), got %v", err)
	}
}

func isExclusionViolation(err error) bool { return isPgCode(err, "23P01") }

func isCheckViolation(err error) bool { return isPgCode(err, "23514") }

func isPgCode(err error, code string) bool {
	if err == nil {
		return false
	}
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	return pgErr.Code == code
}
