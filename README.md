# Календарь звонков

[![hexlet-check](https://github.com/sv99/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/sv99/ai-for-developers-project-386/actions)

Разработайте совместно с ИИ сервис для бронирования календаря

Учебный проект Хекслета: <https://ru.hexlet.io/programs/ai-for-developers>
Как это должно работать: <https://files.hexlet.app/a/2ipc5m>

## Стек

- TypeScript
- Vue
- Element-Plus
- Vite

Большую часть настройки сделал opencode модель GLM 5.3.
Отдельно настраивал release-please (раньше никогда не сталкивался), тоже под руководством Copilot в их новом варианте интерфейса Agents.

## Установка release-please

```bash
git clone https://github.com/sv99/ai-for-developers-project-386.git
cd ai-for-developers-project-386
```

Для работы `release-please` нужно:

1. добавить PAT ключ для репозитория с правами: Contents: Read and write, Pull requests: Read and write.
2. Добавить его в репозиторий как secret Settings → Secrets and variables → Actions → New repository secret с именем RELEASE_PLEASE_TOKEN.

## init

Инициализация проекта для работы с агентом.

```bash
/init
```

## Установка Skills

1. Установите набор скиллов:

```bash
# Install
npx skills@latest add mattpocock/skills
# Update
pnpx skills update
```

1. Проверьте, что агент видит скиллы: они должны появиться в списке доступных.
2. Запустите /setup-matt-pocock-skills

ответы на вопросы:

- трекер задач: GitHub Issues в репозитории проекта;
- метки для разбора задач: оставить значения по умолчанию;
- документы предметной области: один контекст, GLOSSARY.md и docs/adr/ в корне репозитория

1. Посмотрите, что скилл записал в docs/agents/ и в AGENTS.md.

## Главная страница

Я сделал ее раньше.

```bash
Запускал @grill-with-docs Главная страница сервиса "Календарь звонков" открывается и ведёт на страницу записи.
```

Ответы на вопросы в несколько этапов. Использовл GLM-5.3 сжег 3$.

Для @wayfinder "утверждённая спецификация приложения, по которой можно раскладывать тикеты" использовал GLM-5.3-flash. Ушло намного меньше денег.

## Работа с issues

Для работы с ними попробовал GLM-5.3-flash и DeepSeek V4.1 Flash - разницы не заметил.

Поэтапная реализация страниц на основе скриншотов со страницы описания проекта.

## OpenSpec

Начал со спецификации, сгенерированной по уже готовому API-слою. Далее спека переехала в репозиторий и стала рабочим инструментом, с которым агенты делают тикеты.

Как это устроено сейчас:

- спека продукта — `docs/spec.md` (синхронизируется с issue #15), термины — `GLOSSARY.md`, решения — `docs/adr/`;
- контракты — TypeSpec: `typespec/main.tsp` (доменная модель) и `typespec/http.tsp` (HTTP-контракт);
- `pnpm generate` собирает из контракта всё разом: OpenAPI-документ, клиентский SDK и серверные стабы; генераты коммитятся, за актуальностью следят guard-ы в CI;
- спека раскладывается на тикеты через @wayfinder (карта #61), свежие тикеты проходят @triage.

## Deploy в Render

Установка MCP и деплой приложения [calendar-slot](https://calendar-slot.onrender.com/).

После того, как сделал DockerFile начали штатно отрабатываться проверки от hexlet_check.

Используемые конфигурационные файлы:

```bash
# исключен в .gitignore, содержит ключ для деплоя
opencode.json
Dockerfile
nginx.conf.template
# используется для настройки сервиса в Render
render.yaml
```

## Локальный запуск

Требования: Node и pnpm (версии закреплены в `package.json`: `engines`, `packageManager`), Go (см. `server/go.mod`), Docker — для локальной БД.

```bash
pnpm install      # зависимости фронта
pnpm db:up        # Postgres в Docker (server/compose.yaml)
pnpm server:dev   # Go-сервер на http://localhost:3000 — миграции накатываются при старте
pnpm dev          # фронт на http://localhost:5173, /api проксируется на :3000
```

Проверки:

```bash
pnpm lint:check   # eslint + oxlint
pnpm test         # юнит-тесты фронта (Vitest)
pnpm server:test  # тесты сервера, включая интеграционные (DSN и -p 1 зашиты в скрипт)
pnpm e2e          # e2e (Playwright, chromium): сам поднимает БД, Go-сервер и фронт
```

Сборка фронта в прод-режиме: `pnpm build` (результат в `dist/`), локальный просмотр — `pnpm preview`. Все команды проекта — скрипты корневого `package.json`, полный список в AGENTS.md.
