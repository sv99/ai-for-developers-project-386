// Package handlers держит HTTP-слой сервера: тонкие хендлеры над store.
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/sv99/ai-for-developers-project-386/server/gen"
)

// Server реализует gen.ServerInterface. Встроенный gen.Unimplemented даёт
// заглушки 501 для операций, которые приходят в вехах 2–5 (миграции, store, фронт).
type Server struct {
	gen.Unimplemented
}

func NewServer() *Server { return &Server{} }

// Health — единственная реализованная операция контракта в вехе 1 (GET /health).
func (s *Server) Health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(gen.HealthOk{Ok: true})
}
