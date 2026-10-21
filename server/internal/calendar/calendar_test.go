package calendar

import (
	"testing"
	"time"

	"github.com/sv99/ai-for-developers-project-386/server/gen"
)

// now фиксируем в UTC: поясовая арифметика скрыта внутри календаря,
// тесты работают с моментом в произвольной фиксированной локации.
func at(t *testing.T, date, clock string) time.Time {
	t.Helper()
	moment, err := time.ParseInLocation("2006-01-02 15:04", date+" "+clock, time.UTC)
	if err != nil {
		t.Fatalf("parse moment: %v", err)
	}
	return moment
}

func TestWindowEndIsTodayPlusThirteen(t *testing.T) {
	// Окно — ровно 14 дат с сегодняшней: 21 окт → последний день 3 ноя (Q2-б).
	if got := WindowEnd(at(t, "2026-10-21", "09:00")); got != "2026-11-03" {
		t.Fatalf("WindowEnd = %s, want 2026-11-03", got)
	}
}

func TestIsBookableDate(t *testing.T) {
	now := at(t, "2026-10-21", "23:59")

	cases := []struct {
		date string
		want bool
	}{
		{"2026-10-20", false}, // вчера
		{"2026-10-21", true},  // сегодня
		{"2026-11-03", true},  // сегодня + 13 — последний день окна
		{"2026-11-04", false}, // уже за окном (v1 пускал до 4 ноября)
	}
	for _, c := range cases {
		if got := IsBookableDate(c.date, now); got != c.want {
			t.Fatalf("IsBookableDate(%s) = %v, want %v", c.date, got, c.want)
		}
	}
}

func TestStartTimesGrid(t *testing.T) {
	times := StartTimes()
	if len(times) != 18 {
		t.Fatalf("want 18 slots, got %d", len(times))
	}
	if times[0] != "09:00" || times[len(times)-1] != "17:30" {
		t.Fatalf("grid ends wrong: %s … %s", times[0], times[len(times)-1])
	}
}

func TestBuildDaySlots(t *testing.T) {
	date := "2026-11-01"

	// Утро: ничего не прошло, занята пара слотов активной Записью 09:00–10:00.
	slots, err := BuildDaySlots(date, at(t, date, "08:00"), true, []TimeRange{{Start: 540, End: 600}})
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if len(slots) != 18 {
		t.Fatalf("want 18 slots, got %d", len(slots))
	}
	if slots[0].Status != gen.SlotStatus("taken") { // 09:00 — внутри [09:00, 10:00)
		t.Fatalf("09:00 must be taken")
	}
	if slots[1].Status != gen.SlotStatus("taken") { // 09:30 — тоже
		t.Fatalf("09:30 must be taken")
	}
	if slots[2].Status != gen.SlotStatus("free") { // 10:00 — касание, свободен
		t.Fatalf("10:00 must be free (touching interval)")
	}
	if slots[0].EndTime != "09:30" || slots[17].EndTime != "18:00" {
		t.Fatalf("endTime wrong: %s … %s", slots[0].EndTime, slots[17].EndTime)
	}

	// Середина дня: всё, что началось до 10:15, — прошло.
	slots, err = BuildDaySlots(date, at(t, date, "10:15"), true, nil)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	for _, slot := range slots[:3] { // 09:00, 09:30, 10:00 — начались до 10:15
		if slot.Status != gen.SlotStatus("taken") {
			t.Fatalf("%s must be taken (past)", slot.StartTime)
		}
	}
	if slots[3].Status != gen.SlotStatus("free") { // 10:30 — ещё будущее
		t.Fatalf("10:30 must be free")
	}

	// Вне окна регистрации — все Слоты taken.
	slots, err = BuildDaySlots(date, at(t, "2026-11-20", "08:00"), false, nil)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	for _, slot := range slots {
		if slot.Status != gen.SlotStatus("taken") {
			t.Fatalf("out of window: %s must be taken", slot.StartTime)
		}
	}
}
