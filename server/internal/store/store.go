// Package store держит доступ к БД: пул pgx и миграции goose (embed).
package store

import (
	"context"
	"embed"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Connect открывает пул соединений. Пул не требует живой БД при создании —
// соединения устанавливаются по запросу.
func Connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	return pool, nil
}

// Migrate накатывает встроенные миграции на тестовую или рабочую БД.
// Для goose нужен *sql.DB (database/sql-интерфейс) — открываем через stdlib-драйвер pgx.
func Migrate(ctx context.Context, url string) error {
	cfg, err := pgx.ParseConfig(url)
	if err != nil {
		return fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	sqldb := stdlib.OpenDB(*cfg)
	defer func() { _ = sqldb.Close() }() // ошибки Close на этапе миграций незначимы

	goose.SetBaseFS(migrationsFS)
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("goose dialect: %w", err)
	}
	if err := goose.UpContext(ctx, sqldb, "migrations"); err != nil {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}
