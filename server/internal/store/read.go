// Операции чтения контракта: Типы событий, Записи, занятость дня, настройки.
// Доменные правила (сетки, окно, фильтрация «прошедшего») живут в package calendar;
// здесь только SQL и сканирование. Решения — wayfinder-карта #61.
package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sv99/ai-for-developers-project-386/server/gen"
	"github.com/sv99/ai-for-developers-project-386/server/internal/calendar"
)

// Store — методы доступа к данным поверх пула pgx.
type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// DefaultCalendarName — имя календаря, пока владелец не сохранил своё.
const DefaultCalendarName = "Владелец"

func (s *Store) ListEventTypes(ctx context.Context) ([]gen.EventType, error) {
	rows, err := s.pool.Query(ctx,
		`select id, name, description, duration_minutes from event_types order by name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	types := []gen.EventType{}
	for rows.Next() {
		var e gen.EventType
		if err := rows.Scan(&e.Id, &e.Name, &e.Description, &e.DurationMinutes); err != nil {
			return nil, err
		}
		types = append(types, e)
	}
	return types, rows.Err()
}

// listBookingsSQL общий для «всех» и «предстоящих»: разница — в where.
const listBookingsSQL = `select b.id, b.event_type_id,
		to_char(b.date, 'YYYY-MM-DD'), to_char(b.start_time, 'HH24:MI'),
		b.guest_name, b.guest_phone, b.status, b.created_at
	from bookings b
	where %s
	order by b.date, b.start_time, b.created_at`

func scanBookings(rows pgx.Rows) ([]gen.Booking, error) {
	defer rows.Close()
	bookings := []gen.Booking{}
	for rows.Next() {
		var b gen.Booking
		var createdAt time.Time
		if err := rows.Scan(&b.Id, &b.EventTypeId, &b.Date, &b.StartTime,
			&b.Contact.Name, &b.Contact.Phone, &b.Status, &createdAt); err != nil {
			return nil, err
		}
		b.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		bookings = append(bookings, b)
	}
	return bookings, rows.Err()
}

func (s *Store) ListBookings(ctx context.Context) ([]gen.Booking, error) {
	rows, err := s.pool.Query(ctx, fmt.Sprintf(listBookingsSQL, "true"))
	if err != nil {
		return nil, err
	}
	return scanBookings(rows)
}

// ListUpcomingBookings — активные Записи, момент начала которых ещё не прошёл
// (start > now в поясе владельца), в порядке времени начала. now — наивное
// «сейчас» в OWNER_TZ (см. ADR 0004): сравнение со строками домена.
func (s *Store) ListUpcomingBookings(ctx context.Context, now time.Time) ([]gen.Booking, error) {
	rows, err := s.pool.Query(ctx,
		fmt.Sprintf(listBookingsSQL, `b.status = 'active' and (b.date, b.start_time) > ($1::date, $2::time)`),
		now.Format("2006-01-02"), now.Format(calendar.MinuteLayout))
	if err != nil {
		return nil, err
	}
	return scanBookings(rows)
}

// ActiveRangesForDate — интервалы активных Записей дня в минутах от полуночи:
// сырьё для сетки Слотов (Слоты в БД не хранятся).
func (s *Store) ActiveRangesForDate(ctx context.Context, date string) ([]calendar.TimeRange, error) {
	rows, err := s.pool.Query(ctx,
		`select to_char(start_time, 'HH24:MI'), to_char(ends_at, 'HH24:MI')
		 from bookings
		 where date = $1::date and status = 'active'
		 order by start_time`,
		date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ranges := []calendar.TimeRange{}
	for rows.Next() {
		var startStr, endStr string
		if err := rows.Scan(&startStr, &endStr); err != nil {
			return nil, err
		}
		start, err := time.Parse(calendar.MinuteLayout, startStr)
		if err != nil {
			return nil, fmt.Errorf("parse range start %q: %w", startStr, err)
		}
		end, err := time.Parse(calendar.MinuteLayout, endStr)
		if err != nil {
			return nil, fmt.Errorf("parse range end %q: %w", endStr, err)
		}
		ranges = append(ranges, calendar.TimeRange{
			Start: calendar.ToMinutes(start), End: calendar.ToMinutes(end),
		})
	}
	return ranges, rows.Err()
}

// GetCalendarName — имя календаря владельца; по умолчанию «Владелец».
func (s *Store) GetCalendarName(ctx context.Context) (string, error) {
	var name string
	err := s.pool.QueryRow(ctx,
		`select value from settings where key = 'calendar_name'`).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return DefaultCalendarName, nil
	}
	if err != nil {
		return "", err
	}
	return name, nil
}
