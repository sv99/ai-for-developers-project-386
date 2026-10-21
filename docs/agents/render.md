# Render: MCP-сервер и деплой

Ключ API (`rnd_…`, выдаётся на <https://dashboard.render.com/u/settings?add-api-key>) лежит в `.secrets/render-api-key`. Папка `.secrets/` в `.gitignore` — файл не коммитится.

## MCP-сервер

Remote-сервер `render` (`https://mcp.render.com/mcp`) описан в `opencode.json` (в корне, коммитится), ключ подставляется через `{file:.secrets/render-api-key}`.

На новой машине файл нужно создать, иначе Render MCP вернёт `unauthorized`:

```sh
printf '%s' rnd_… > .secrets/render-api-key
```

## Деплой

`pnpm deploy:render` (`scripts/deploy.mjs`) триггерит деплой сервиса `calendar-slot` и следит за ним до завершения. Ключ скрипт берёт не из файла, а из переменной окружения:

```sh
RENDER_API_KEY=rnd_… pnpm deploy:render
```

Опции и переменные (`--clear-cache`, `--service`, `RENDER_SERVICE_ID`) описаны в шапке `scripts/deploy.mjs`. Сам сервис создаётся из blueprint `render.yaml` (Render Dashboard → New → Blueprint).
