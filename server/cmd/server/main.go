// Сервер «Календаря звонков» — HTTP-поверхность контракта typespec/http.tsp.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sv99/ai-for-developers-project-386/server/gen"
	"github.com/sv99/ai-for-developers-project-386/server/internal/handlers"
	"github.com/sv99/ai-for-developers-project-386/server/internal/store"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000" // локальный порт контракта; Render подставляет свой PORT
	}

	// БД опциональна на старте: без DATABASE_URL сервер живёт (health работает),
	// store-операции остаются заглушками 501.
	var pool *pgxpool.Pool
	if url := os.Getenv("DATABASE_URL"); url != "" {
		var err error
		if pool, err = store.Connect(context.Background(), url); err != nil {
			logger.Error("database connect failed", "err", err)
			os.Exit(1)
		}
		defer pool.Close()
		if err := store.Migrate(context.Background(), url); err != nil {
			logger.Error("database migrate failed", "err", err)
			os.Exit(1)
		}
		logger.Info("database connected and migrated")
	} else {
		logger.Warn("DATABASE_URL not set — running without database")
	}

	r := chi.NewRouter()
	// CORS нужен только в проде (фронт и API на разных origins); в dev — Vite proxy.
	if origins := os.Getenv("CORS_ORIGINS"); origins != "" {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins: strings.Split(origins, ","),
			AllowedMethods: []string{"GET", "POST", "PUT", "OPTIONS"},
		}))
	}
	r.Mount("/", gen.Handler(handlers.NewServer(pool)))

	logger.Info("calendar server listening", "port", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		logger.Error("server stopped", "err", err)
		os.Exit(1)
	}
}
