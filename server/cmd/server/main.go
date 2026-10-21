// Сервер «Календаря звонков» — HTTP-поверхность контракта typespec/http.tsp.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"
	_ "time/tzdata" // встроенная база поясов: OWNER_TZ читается без зависимости от ОС

	"github.com/sv99/ai-for-developers-project-386/server/internal/handlers"
	"github.com/sv99/ai-for-developers-project-386/server/internal/store"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000" // локальный порт контракта; Render подставляет свой PORT
	}
	// Пояс владельца: все календарные вычисления («сегодня», окно, «прошло») — в нём (ADR 0004).
	loc, err := time.LoadLocation(envOrDefault("OWNER_TZ", "UTC"))
	if err != nil {
		logger.Error("bad OWNER_TZ", "err", err)
		os.Exit(1)
	}

	// БД опциональна на старте: без DATABASE_URL сервер живёт (health работает),
	// store-операции отвечают 503.
	var st *store.Store
	if url := os.Getenv("DATABASE_URL"); url != "" {
		pool, err := store.Connect(context.Background(), url)
		if err != nil {
			logger.Error("database connect failed", "err", err)
			os.Exit(1)
		}
		defer pool.Close()
		if err := store.Migrate(context.Background(), url); err != nil {
			logger.Error("database migrate failed", "err", err)
			os.Exit(1)
		}
		st = store.New(pool)
		logger.Info("database connected and migrated", "tz", loc.String())
	} else {
		logger.Warn("DATABASE_URL not set — running without database")
	}

	r := handlers.NewRouter(logger, st, loc)

	logger.Info("calendar server listening", "port", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		logger.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
