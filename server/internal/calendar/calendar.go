// Package calendar держит доменные правила «Календаря звонков», не зависящие
// от HTTP и SQL: сетку дня, окно регистрации, статусы Слотов.
// Решения — в wayfinder-карте (#61) и резолюции доменных правил (#62):
// полуинтервалы, ровно 14 дат окна, «прошло» = start ≤ now.
package calendar

import (
	"fmt"
	"time"

	"github.com/sv99/ai-for-developers-project-386/server/gen"
)

const (
	DayStartMinutes = 9 * 60  // 09:00
	DayEndMinutes   = 18 * 60 // 18:00
	SlotMinutes     = 30

	// WindowDates — ровно 14 дат окна регистрации, включая сегодняшний
	// (последний день = сегодня + 13; решение Q2-б, меняет v1 «сегодня + 14»).
	WindowDates = 14
)

// TimeRange — занятый интервал дня: [Start, End) в минутах от полуночи.
type TimeRange struct {
	Start int
	End   int
}

// MinuteLayout — формат времени дня, HH:mm (границы домена: строки контракта).
const MinuteLayout = "15:04"

func ToMinutes(t time.Time) int { return t.Hour()*60 + t.Minute() }

func toTime(minutes int) string {
	return fmt.Sprintf("%02d:%02d", minutes/60, minutes%60)
}

// StartTimes — все начала Слотов дня: 09:00 … 17:30 (18 Слотов).
func StartTimes() []string {
	times := make([]string, 0, (DayEndMinutes-DayStartMinutes)/SlotMinutes)
	for m := DayStartMinutes; m < DayEndMinutes; m += SlotMinutes {
		times = append(times, toTime(m))
	}
	return times
}

// Today — сегодняшняя дата в поясе владельца, YYYY-MM-DD.
func Today(now time.Time) string { return now.Format("2006-01-02") }

// WindowEnd — последний день окна регистрации: сегодня + 13.
func WindowEnd(now time.Time) string {
	return now.AddDate(0, 0, WindowDates-1).Format("2006-01-02")
}

// IsBookableDate — дата внутри окна регистрации: [сегодня, сегодня + 13].
func IsBookableDate(date string, now time.Time) bool {
	return date >= Today(now) && date <= WindowEnd(now)
}

// BuildDaySlots — сетка дня со статусами. Слот taken, если день вне окна,
// его начало уже прошло (start ≤ now) или он накрыт активной Записью.
func BuildDaySlots(date string, now time.Time, bookable bool, busy []TimeRange) ([]gen.DaySlot, error) {
	slots := make([]gen.DaySlot, 0, len(StartTimes()))
	for minutes := DayStartMinutes; minutes < DayEndMinutes; minutes += SlotMinutes {
		startTime := toTime(minutes)
		moment, err := time.ParseInLocation("2006-01-02 15:04", date+" "+startTime, now.Location())
		if err != nil {
			return nil, fmt.Errorf("parse slot moment: %w", err)
		}
		taken := !bookable || !moment.After(now) || covered(minutes, busy)
		slots = append(slots, gen.DaySlot{
			StartTime: startTime,
			EndTime:   toTime(minutes + SlotMinutes),
			Status:    status(taken),
		})
	}
	return slots, nil
}

// Covered — накрыт ли слот-минут чьим-то занятым интервалом [Start, End).
func covered(minutes int, busy []TimeRange) bool {
	for _, r := range busy {
		if r.Start <= minutes && minutes < r.End {
			return true
		}
	}
	return false
}

func status(taken bool) gen.SlotStatus {
	if taken {
		return gen.Taken
	}
	return gen.Free
}
