// Команда для e2e-тестов: очищает все таблицы перед сценарием
// (детерминизм — каждый тест стартует с пустым календарём и дефолтными настройками).
// Кросс-платформенно: и локально (compose-БД), и в CI (service-контейнер) —
// DSN берётся из DATABASE_URL; pnpm-скрипт e2e:reset зашивает локальный.
//
// TRUNCATE (а не DELETE) — мгновенно и со сбросом идентификаторов; каскад не нужен
// (внешних ключей между таблицами нет, но CASCADE не помешает при их появлении).
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/sv99/ai-for-developers-project-386/server/internal/store"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		fmt.Fprintln(os.Stderr, "e2e-reset: переменная DATABASE_URL не задана")
		os.Exit(1)
	}

	ctx := context.Background()
	pool, err := store.Connect(ctx, dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "e2e-reset: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	if _, err := pool.Exec(ctx, "truncate bookings, event_types, settings restart identity cascade"); err != nil {
		fmt.Fprintf(os.Stderr, "e2e-reset: truncate: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("e2e-reset: база очищена")
}
