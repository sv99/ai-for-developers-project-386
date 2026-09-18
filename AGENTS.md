# AGENTS.md

Учебный проект Хекслета: календарь звонков (сервис бронирования). Vue 3 + TypeScript + Element Plus + Vite. Менеджер пакетов — **pnpm 12.4.2**, Node `^22.18.0 || >=24.12.0` (в CI — 24).

## Команды

- `pnpm dev` — dev-сервер Vite
- `pnpm test` — все тесты (vitest run); один файл: `pnpm test LandingPage`
- `pnpm type-check` — `vue-tsc --build` по references из `tsconfig.json`: `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.vitest.json`
- `pnpm lint` — сначала `lint:oxlint`, затем `lint:eslint` (последовательно, оба с `--fix`)
- `pnpm format` — `oxfmt src/` (только `src/`, не весь репозиторий)
- `pnpm build` — параллельно type-check + `vite build`

## Стиль кода

- Форматтер — oxfmt: **без точек с запятой, одинарные кавычки**. ESLint не форматирует код (`eslint-config-prettier`).
- Правила oxlint из `.oxlintrc.json` автоматически учитываются ESLint через `eslint-plugin-oxlint`; не дублируй их в `eslint.config.ts`.
- Псевдоним импортов: `@` → `src/`.

## Element Plus: автоимпорт

`unplugin-auto-import` + `unplugin-vue-components` с `ElementPlusResolver`: компоненты и API Element Plus **не импортируются вручную**. Сгенерированные и закоммиченные `auto-imports.d.ts` и `components.d.ts` не редактируй руками.

## Тесты

- `vitest.config.ts` наследует Vite-конфиг; среда — jsdom, `element-plus` инлайнится, CSS отключён, `e2e/**` исключён.
- Тесты лежат рядом с компонентами: `src/**/__tests__/*.spec.ts`.

## CI (не ломать)

- `ci.yml` (push в main + PR): `pnpm test` → `pnpm build` → smoke-тест: `pnpm preview` на порту 4173, проверяется `id="app"` в HTML. **Не убирай `<div id="app">` из `index.html`** — упадёт smoke-тест.
- `hexlet-check.yml` — сгенерирован Хекслетом: **не удалять, не переименовывать, не редактировать** (и не переименовывать репозиторий).

## Релизы (release-please)

- Пуш в main запускает `release-please.yml` — по **Conventional Commits** (`feat:`, `fix:` …) создаёт release-PR и тег `v*.*.*`.
- Версию в `package.json` поднимает release-please — **не бампай вручную**. `release.yml` сверяет версию пакета с тегом и заливает `dist-<tag>.zip` в GitHub Release.
- Для release-please нужен секрет `RELEASE_PLEASE_TOKEN` (fine-grained PAT): релиз/тег от обычного `GITHUB_TOKEN` не запустит `release.yml`.
