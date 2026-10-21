// Операции записи контракта: Записи, Типы событий, настройки владельца.
// Инвариант двойной брони защищает EXCLUDE-констрейнт (веха 2) — ошибки
// схемы маппятся в доменные: 23P01 → 409, FK → 404. Решения — карта #61.
package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/sv99/ai-for-developers-project-386/server/gen"
)

// Ошибки, на которые хендлеры отвечают контрактными кодами и сообщениями.
var (
	ErrSlotConflict      = errors.New("slot conflict")
	ErrEventTypeNotFound = errors.New("event type not found")
	ErrBookingNotFound   = errors.New("booking not found")
	ErrBookingCancelled  = errors.New("booking already cancelled")
)

const bookingColumns = `id, event_type_id,
	to_char(date, 'YYYY-MM-DD'), to_char(start_time, 'HH24:MI'),
	guest_name, guest_phone, status, created_at`

func scanBookingRow(row pgx.Row) (gen.Booking, error) {
	var b gen.Booking
	var createdAt time.Time
	if err := row.Scan(&b.Id, &b.EventTypeId, &b.Date, &b.StartTime,
		&b.Contact.Name, &b.Contact.Phone, &b.Status, &createdAt); err != nil {
		return gen.Booking{}, err
	}
	b.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return b, nil
}

// mapInsertError — ошибки схемы в доменные: EXCLUDE → конфликт брони, FK → неизвестный Тип события.
func mapInsertError(booking gen.Booking, err error) (gen.Booking, error) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23P01":
			return gen.Booking{}, ErrSlotConflict
		case "23503":
			return gen.Booking{}, ErrEventTypeNotFound
		}
	}
	return gen.Booking{}, err
}

// EventTypeDuration — длительность Типа события; неизвестный id (в т.ч. не-uuid) → ErrEventTypeNotFound.
func (s *Store) EventTypeDuration(ctx context.Context, id string) (int, error) {
	if _, err := uuid.Parse(id); err != nil {
		return 0, ErrEventTypeNotFound
	}
	var duration int
	err := s.pool.QueryRow(ctx,
		`select duration_minutes from event_types where id = $1::uuid`, id).Scan(&duration)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrEventTypeNotFound
	}
	if err != nil {
		return 0, err
	}
	return duration, nil
}

// CreateBooking — создаёт Запись. Атомарный INSERT: EXCLUDE-констрейнт защищает
// от гонок без транзакций; startsAt — наивный момент начала (см. ADR 0004).
func (s *Store) CreateBooking(ctx context.Context, eventTypeID, date, startTime string,
	startsAt time.Time, durationMinutes int, guestName, guestPhone string,
) (gen.Booking, error) {
	endsAt := startsAt.Add(time.Duration(durationMinutes) * time.Minute)
	row := s.pool.QueryRow(ctx,
		`insert into bookings (event_type_id, date, start_time, duration_minutes, ends_at,
		                       guest_name, guest_phone)
		 values ($1, $2, $3, $4, $5, $6, $7)
		 returning `+bookingColumns,
		eventTypeID, date, startTime, durationMinutes, endsAt, guestName, guestPhone)
	booking, err := scanBookingRow(row)
	if err != nil {
		return mapInsertError(booking, err)
	}
	return booking, nil
}

// CancelBooking — отменяет активную Запись: тело сохраняется, время освобождается
// (строка уходит из-под WHERE констрейнта). Не найдена → ErrBookingNotFound,
// уже отменена → ErrBookingCancelled.
func (s *Store) CancelBooking(ctx context.Context, id string) (gen.Booking, error) {
	if _, err := uuid.Parse(id); err != nil {
		return gen.Booking{}, ErrBookingNotFound
	}
	row := s.pool.QueryRow(ctx,
		`update bookings set status = 'cancelled'
		 where id = $1::uuid and status = 'active'
		 returning `+bookingColumns,
		id)
	booking, err := scanBookingRow(row)
	if errors.Is(err, pgx.ErrNoRows) {
		// Существующей активной не было: различаем «нет записи» и «уже отменена».
		var status string
		qerr := s.pool.QueryRow(ctx,
			`select status from bookings where id = $1::uuid`, id).Scan(&status)
		switch {
		case errors.Is(qerr, pgx.ErrNoRows):
			return gen.Booking{}, ErrBookingNotFound
		case qerr != nil:
			return gen.Booking{}, qerr
		default:
			return gen.Booking{}, ErrBookingCancelled
		}
	}
	if err != nil {
		return mapInsertError(booking, err)
	}
	return booking, nil
}

// CreateEventType — новый вид звонка.
func (s *Store) CreateEventType(ctx context.Context, name, description string, durationMinutes int) (gen.EventType, error) {
	var e gen.EventType
	err := s.pool.QueryRow(ctx,
		`insert into event_types (name, description, duration_minutes)
		 values ($1, $2, $3)
		 returning id, name, description, duration_minutes`,
		name, description, durationMinutes).
		Scan(&e.Id, &e.Name, &e.Description, &e.DurationMinutes)
	if err != nil {
		return gen.EventType{}, err
	}
	return e, nil
}

// SetCalendarName — сохраняет имя календаря владельца (upsert по ключу).
func (s *Store) SetCalendarName(ctx context.Context, name string) error {
	_, err := s.pool.Exec(ctx,
		`insert into settings (key, value) values ('calendar_name', $1)
		 on conflict (key) do update set value = excluded.value`,
		name)
	return err
}
