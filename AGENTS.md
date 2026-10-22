# AGENTS.md

Учебный проект Хекслета: календарь звонков (сервис бронирования). Vue 3 + TypeScript + Element Plus + Vite.

## Команды

Все команды — скрипты корневого `package.json` (версии Node и pnpm закреплены там же: `engines`, `packageManager`). DSN локальной compose-БД зашит в серверных скриптах через `cross-env`; CI зовёт `go` напрямую со своим `DATABASE_URL`.

- Фронт: `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm lint:check`.
- Сервер (`server/`, Go; тулчейн — Windows или WSL, dev-цикл владельца — Windows): `pnpm server:test` (интеграционные; `-p 1` — пакеты делят одну БД), `pnpm server:vet`, `pnpm server:build`, `pnpm server:dev`. Регенерация стабов контракта — `pnpm server:gen`: генерат `server/gen/` коммитится, в CI guard проверяет актуальность.
- Локальная БД — `pnpm db:up` / `pnpm db:down` (compose `server/compose.yaml` на стороне Windows). Миграции goose (embed, `internal/store/migrations/`) накатываются при старте сервера и в `TestMain` тестов store — интеграционные тесты идут по `DATABASE_URL`, без него пропускаются.
- e2e — `pnpm e2e` (Playwright, каталог `e2e/`): стек поднимается сам — compose-БД, Go-сервер на :3000 и Vite на :5173 (см. `playwright.config.ts`); `pnpm e2e:reset` чистит БД между тестами.
- Решения — в wayfinder-карте issue #61.

## Локальное окружение и проверка UI (WSL)

- `pnpm` здесь — **windows-версия** (`/mnt/c/nvm4w/nodejs/pnpm`): `pnpm dev`/`pnpm preview` поднимают сервер на стороне Windows, а `node_modules` содержит win32-бинарники. Linux-нодой Vite не запускается (`Cannot find native binding`) — это норма окружения, переустанавливать не нужно.
- Серверы слушают `0.0.0.0`: из WSL адрес — строка `Network` с пометкой `vEthernet (WSL)` в выводе `pnpm dev` (это `.1` подсети `eth0`), а не `localhost`.
- UI проверяется MCP-сервером `playwright` (headless Chromium, настроен в `opencode.json` этого проекта): `browser_navigate` → `browser_snapshot` → `browser_take_screenshot`. Артефакты — в `.playwright-mcp/`.
- Render (MCP-сервер + `pnpm deploy:render`) читает ключ из `.secrets/render-api-key` — см. `docs/agents/render.md`.

## Стиль кода

- Форматтер — oxfmt: **без точек с запятой, одинарные кавычки**. ESLint не форматирует код (`eslint-config-prettier`).
- Правила oxlint из `.oxlintrc.json` уже подключены к ESLint через `eslint-plugin-oxlint` — дублировать их в `eslint.config.ts` не нужно.
- Псевдоним импортов: `@` → `src/`.

## Element Plus: автоимпорт

`unplugin-auto-import` + `unplugin-vue-components` с `ElementPlusResolver`: компоненты и API Element Plus **не импортируются вручную**. Сгенерированные и закоммиченные `auto-imports.d.ts` и `components.d.ts` руками не редактируются.

## Тесты

Vitest; один файл — `pnpm test LandingPage`. Тесты лежат рядом с компонентами: `src/**/__tests__/*.spec.ts`. E2E — Playwright: `pnpm e2e` (один файл — `pnpm e2e booking`); сценарии в `e2e/*.spec.ts`, селекторы — по классам вёрстки (`.type-card`, `.slot`, `.day`), сидирование и проверки данных — через API напрямую (:3000).

## CI (не ломать)

- `ci.yml` (push в main + PR): три джобы — `frontend` (lint → guard-ы генератов (`openapi:check`, `api:sdk` + `git diff` по `src/api/generated`) → test → build → smoke: `pnpm preview` на порту 4173, проверяется `id="app"` в HTML), `server` (golangci-lint, guard генерата, vet, `go test -p 1` с service-контейнером postgres) и `e2e` (postgres service-контейнер + `pnpm e2e`; при падении — артефакт `playwright-report`). **Не убирай `<div id="app">` из `index.html`** — упадёт smoke-тест.
- `hexlet-check.yml` — сгенерирован Хекслетом: **не удалять, не переименовывать, не редактировать** (и не переименовывать репозиторий).

## Коммиты и релизы

- Коммить по **Conventional Commits** (`feat:`, `fix:`, …) — по ним release-please собирает релизы.
- **Один коммит — одно логическое изменение**: несвязанные правки дроби на отдельные коммиты (код + документация к нему — одно изменение; код + unrelated рефакторинг — нет).
- В описании коммита объясняй **причину** изменения и **новое поведение** — не только что менялось, но зачем и как теперь работает.
- Механика релизов и секреты — `docs/agents/releases.md`.

## TypeSpec

- `typespec/main.tsp` — доменная модель API-слоя (сущности, ограничения, операции `src/api`), без маршрутов. Проверка — `pnpm tsp:check`.
- `typespec/http.tsp` — HTTP-контракт: маршруты и методы поверх моделей `main.tsp`. Подробности — `typespec/README.md`.
- `docs/openapi.yaml` — сгенерированный из `typespec/http.tsp` контракт (`pnpm openapi`, проверка актуальности — `pnpm openapi:check`), **коммитится**, руками не редактируется.
- Фронтовые типы и клиентский SDK генерируются из `docs/openapi.yaml` (`pnpm api:sdk`: openapi-typescript + openapi-fetch), серверные стабы — `pnpm server:gen`; оба генерата коммитятся и проверяются guard-ами CI. Вся регенерация разом, в правильном порядке — `pnpm generate` (openapi → api:sdk → server:gen).

## Agent skills

### Issue tracker

Issues живут в GitHub Issues репозитория, все операции через `gh` CLI. См. `docs/agents/issue-tracker.md`.

### Triage labels

Дефолтный словарь из пяти ролей: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. См. `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` и `docs/adr/` в корне репозитория. См. `docs/agents/domain.md`.
