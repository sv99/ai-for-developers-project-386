# AGENTS.md

Учебный проект Хекслета: календарь звонков (сервис бронирования). Vue 3 + TypeScript + Element Plus + Vite.

## Команды

Все команды — скрипты корневого `package.json` (версии Node и pnpm закреплены там же: `engines`, `packageManager`). DSN локальной compose-БД зашит в серверных скриптах через `cross-env`; CI зовёт `go` напрямую со своим `DATABASE_URL`.

- Фронт: `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm lint:check`.
- Сервер (`server/`, Go; тулчейн — Windows или WSL, dev-цикл владельца — Windows): `pnpm server:test` (интеграционные; `-p 1` — пакеты делят одну БД), `pnpm server:vet`, `pnpm server:build`, `pnpm server:dev`. Регенерация стабов контракта — `pnpm server:gen`: генерат `server/gen/` коммитится, в CI guard проверяет актуальность.
- Локальная БД — `pnpm db:up` / `pnpm db:down` (compose `server/compose.yaml` на стороне Windows). Миграции goose (embed, `internal/store/migrations/`) накатываются при старте сервера и в `TestMain` тестов store — интеграционные тесты идут по `DATABASE_URL`, без него пропускаются.
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

Vitest; один файл — `pnpm test LandingPage`. Тесты лежат рядом с компонентами: `src/**/__tests__/*.spec.ts`.

## CI (не ломать)

- `ci.yml` (push в main + PR): `pnpm test` → `pnpm build` → smoke-тест: `pnpm preview` на порту 4173, проверяется `id="app"` в HTML. **Не убирай `<div id="app">` из `index.html`** — упадёт smoke-тест.
- `hexlet-check.yml` — сгенерирован Хекслетом: **не удалять, не переименовывать, не редактировать** (и не переименовывать репозиторий).

## Коммиты и релизы

- Коммить по **Conventional Commits** (`feat:`, `fix:`, …) — по ним release-please собирает релизы.
- **Один коммит — одно логическое изменение**: несвязанные правки дроби на отдельные коммиты (код + документация к нему — одно изменение; код + unrelated рефакторинг — нет).
- В описании коммита объясняй **причину** изменения и **новое поведение** — не только что менялось, но зачем и как теперь работает.
- Механика релизов и секреты — `docs/agents/releases.md`.

## TypeSpec

- `typespec/main.tsp` — доменная модель API-слоя (сущности, ограничения, операции `src/api`). Это **не** HTTP-контракт: сервис клиентский, эндпоинтов нет. Проверка — `pnpm tsp:check`.
- `typespec/http.tsp` — справочный прототип HTTP-контракта (задел на будущий сервер). Подробности — `typespec/README.md`.
- `docs/openapi.yaml` — сгенерированный из `typespec/http.tsp` контракт (`pnpm openapi`, проверка актуальности — `pnpm openapi:check`), **коммитится**, руками не редактируется.

## Agent skills

### Issue tracker

Issues живут в GitHub Issues репозитория, все операции через `gh` CLI. См. `docs/agents/issue-tracker.md`.

### Triage labels

Дефолтный словарь из пяти ролей: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. См. `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` и `docs/adr/` в корне репозитория. См. `docs/agents/domain.md`.
