// Сервер «Календаря звонков» — HTTP-поверхность контракта typespec/http.tsp.
package main

import (
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"

	"github.com/sv99/ai-for-developers-project-386/server/gen"
	"github.com/sv99/ai-for-developers-project-386/server/internal/handlers"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000" // локальный порт контракта; Render подставляет свой PORT
	}

	var handler gen.ServerInterface = handlers.NewServer()

	r := chi.NewRouter()
	// CORS нужен только в проде (фронт и API на разных origins); в dev — Vite proxy.
	if origins := os.Getenv("CORS_ORIGINS"); origins != "" {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins: strings.Split(origins, ","),
			AllowedMethods: []string{"GET", "POST", "PUT", "OPTIONS"},
		}))
	}
	r.Mount("/", gen.Handler(handler))

	logger.Info("calendar server listening", "port", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		logger.Error("server stopped", "err", err)
		os.Exit(1)
	}
}
