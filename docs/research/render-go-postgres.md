# Research: Render — Go-сервис и внутренний Postgres (issue #66)

Резолюция research-тикета [#66](https://github.com/sv99/ai-for-developers-project-386/issues/66).
Все утверждения проверены по официальной документации Render (ссылки в тексте), дата проверки — 2026-10-21.

## TL;DR

Go-сервис и внутренняя БД объявляются в существующем `render.yaml`: сервис — `type: web`,
`runtime: go`, `buildCommand: go build -tags netgo -ldflags '-s -w' -o app`, `startCommand: ./app`;
БД — в корневом ключе `databases:` с `plan: free`. `DATABASE_URL` в сервисе задаётся через
`fromDatabase: { name: <имя инстанса БД>, property: connectionString }` — это **внутренний**
(приватный) URL. `OWNER_TZ` — обычная env-переменная `envVars: [{ key: OWNER_TZ, value: UTC }]`.
`scripts/deploy.mjs` совместим: у него уже есть `--service <name|id>` и `RENDER_SERVICE_NAME`.

## Проверенный фрагмент render.yaml

```yaml
services:
  # Существующий сервис — без изменений (уже управляется этим blueprint).
  - type: web
    name: calendar-slot
    runtime: docker
    dockerfilePath: ./Dockerfile
    plan: free
    healthCheckPath: /
    autoDeploy: true

  # Новый Go-сервис: нативный Go runtime, без Dockerfile.
  - type: web
    name: calendar-slot-api        # имя должно быть уникальным в blueprint
    runtime: go
    plan: free
    region: oregon                 # тот же регион, что у БД (условие internal-соединений)
    buildCommand: go build -tags netgo -ldflags '-s -w' -o app
    startCommand: ./app
    healthCheckPath: /
    autoDeploy: true
    envVars:
      - key: DATABASE_URL          # внутренний URL приватной сети Render
        fromDatabase:
          name: calendar-slot-db   # имя инстанса БД из блока databases (НЕ databaseName)
          property: connectionString
      - key: OWNER_TZ              # таймзона владельца; default UTC
        value: UTC

databases:
  - name: calendar-slot-db
    databaseName: calendar_slot    # опционально: иначе сгенерируется из name
    plan: free
    region: oregon                 # должен совпадать с регионом сервиса
    postgresMajorVersion: '17'     # опционально: default — последняя поддерживаемая (18)
    # ipAllowList: []              # опционально: запретить ВЕСЬ внешний доступ (только internal)
```

## Факты по темам тикета

### 1. Go-сервис в render.yaml

- `runtime: go` — один из нативных рантаймов; поле `runtime` заменяет устаревшее `env`
  ([blueprint-spec](https://render.com/docs/blueprint-spec#runtime)).
- `buildCommand` обязателен для всех не-Docker рантаймов
  ([blueprint-spec](https://render.com/docs/blueprint-spec#buildcommand)).
- Официальные команды из Go-quickstart'а Render
  ([deploy-go-nethttp](https://render.com/docs/deploy-go-nethttp)):
  - Build Command: `go build -tags netgo -ldflags '-s -w' -o app`
  - Start Command: `./app`
- Нативные рантаймы — Debian 12, сборка Go детерминирована содержимым `go.mod`
  ([native-runtimes](https://render.com/docs/native-runtimes)).
- Веб-сервис обязан слушать `0.0.0.0:$PORT`; `PORT` по умолчанию `10000`
  ([web-services#port-binding](https://render.com/docs/web-services#port-binding)) —
  Go-приложение должно читать `os.Getenv("PORT")`.

### 2. DATABASE_URL внутреннего Postgres

- БД объявляются в корневом ключе `databases:` (не в `services:`)
  ([blueprint-spec#databases](https://render.com/docs/blueprint-spec#database-fields)).
- `fromDatabase.name` — это **`name` инстанса** (имя ресурса Render), а не `databaseName`
  ([blueprint-spec](https://render.com/docs/blueprint-spec#referencing-service-properties)).
- `property: connectionString` — «URL for connecting to the datastore **over the private
  network**», формат `postgresql://user:password@host:port/database`
  ([blueprint-spec#connectionString](https://render.com/docs/blueprint-spec#connectionstring)).
  То есть через blueprint сервис получает именно внутреннюю строку подключения.
- Внутренний URL работает только при совпадении аккаунта **и региона**; формат
  `postgresql://USER:PASSWORD@INTERNAL_HOST:PORT/DATABASE`, порт по умолчанию `5432`.
  Внутренний TLS — self-signed: `sslmode=require` допустим, `verify-ca`/`verify-full` — нет
  ([postgresql-creating-connecting#internal-connections](https://render.com/docs/postgresql-creating-connecting)).
- Внешний доступ к БД ограничивается `ipAllowList`; `ipAllowList: []` = только внутренние
  соединения ([blueprint-spec#inbound-ip-rules](https://render.com/docs/blueprint-spec#inbound-ip-rules)).
  По умолчанию (поле опущено) разрешены все IP с валидными кредами — удобно для psql с
  локальной машины, но менее защищено.
- Dashboard vs IaC: создание БД через blueprint (ключ `databases:`) — это IaC-путь, БД
  создастся при следующем применении blueprint. Push в связанную ветку, меняющий
  `render.yaml`, **автоматически** применяет изменения (создаёт/обновляет ресурсы)
  ([infrastructure-as-code](https://render.com/docs/infrastructure-as-code#setup)). Удаления
  через blueprint никогда не происходят сами (ресурс останется жить), а ручные правки
  конфликтующих настроек перетираются следующим sync.

### 3. OWNER_TZ

- Задаётся в `envVars` сервиса: `- key: OWNER_TZ, value: UTC`
  ([blueprint-spec#setting-environment-variables](https://render.com/docs/blueprint-spec#setting-environment-variables)).
- Секретный вариант — `sync: false` (значение запрашивается в Dashboard только при
  первичном создании blueprint; при последующих sync игнорируется). Для не-секретного
  дефолта `value: UTC` — правильный вариант, значение хранится в IaC и воспроизводимо.
- Env-переменные, не указанные в blueprint, Render сохраняет; а вот ручные правки значений,
  заданных в blueprint, будут перезаписаны при следующем sync
  ([infrastructure-as-code#modifying](https://render.com/docs/infrastructure-as-code)).
- Альтернатива для нескольких сервисов — `envVarGroups` (общая группа переменных).

### 4. Совместимость с scripts/deploy.mjs

- Скрипт ищет сервис по имени (`calendar-slot` по умолчанию), но уже поддерживает
  `--service <name|id>`, переменные `RENDER_SERVICE_NAME` и `RENDER_SERVICE_ID`
  (см. `scripts/deploy.mjs`, `resolveServiceId`). Второй сервис **ничего не ломает**:
  деплой Go-сервиса — `node scripts/deploy.mjs --service calendar-slot-api`
  (или `RENDER_SERVICE_NAME=calendar-slot-api`).
- Деплоить БД этим скриптом не нужно и невозможно: Postgres — не сервис, у него нет
  деплоев; он создаётся/обновляется blueprint-sync'ом.

### 5. Уживание с существующим сервисом blueprint

- Один blueprint управляет всеми ресурсами из одного `render.yaml`; каждый ресурс
  идентифицируется уникальным `name` (повтор имени существующего сервиса применит к нему
  конфигурацию blueprint). Запрещено управлять одним ресурсом из нескольких blueprint'ов
  ([infrastructure-as-code](https://render.com/docs/infrastructure-as-code),
  [blueprint-spec#name](https://render.com/docs/blueprint-spec#name)).
- Регион сервиса и БД должен совпадать (для internal-соединений); оба `oregon` по умолчанию,
  но лучше указать явно. Регион нельзя менять после создания.

## Ограничения free tier

Для веб-сервиса (план `free` — 0.1 CPU / 512 MB RAM)
([free](https://render.com/docs/free), [blueprint-spec#plan](https://render.com/docs/blueprint-spec#plan)):

- **Засыпание**: сервис засыпает после 15 минут без входящего трафика; пробуждение ~1 минута
  (посетитель видит загрузочную страницу).
- **750 free instance hours** на workspace в месяц суммарно; заснувшие сервисы часы не
  тратят. Внимание: два постоянно-бодрствующих free-сервиса (24/7) потребляют до ~1440 ч/мес
  и упрутся в лимит — workspace приостановит все free-сервисы до конца месяца. Для учебного
  проекта с засыпанием по 15 минут лимита хватает.
- Эфемерная файловая система: локальные файлы теряются при каждом деплое/рестарте/засыпании;
  persistent disk на free недоступен (данные — только во внешней БД).
- Нельзя: масштабирование, shell-доступ, one-off jobs; rollbacks — только на два последних
  деплоя; возможны внезапные рестарты.
- Free-сервис **не может принимать** private-network трафик, но может **отправлять** его
  к своим БД и платным сервисам того же региона — связка «free web → free Postgres» работает.
- Есть порог на исходящий трафик (баводящий сервис могут приостановить).

Для Postgres (план `free` — 0.1 CPU / 256 MB RAM, диск 1 GB) ([free#free-postgres](https://render.com/docs/free#free-postgres)):

- **30 дней жизни**: free-БД истекает через 30 дней после создания; grace-период 14 дней на
  апгрейд, затем БД **удаляется со всеми данными**. Для учебного проекта — пересоздавать
  или апгрейдить раз в месяц.
- Только **одна** free-БД на workspace.
- Нет бэкапов вообще; нет managed connection pooling; возможны внезапные maintenance/рестарты.
- Лимит соединений: для памяти < 8 GB — 100 соединений
  ([postgresql-creating-connecting#connection-limits](https://render.com/docs/postgresql-creating-connecting#connection-limits)).

## Источники

- [Blueprint YAML Reference](https://render.com/docs/blueprint-spec)
- [Render Blueprints (IaC)](https://render.com/docs/infrastructure-as-code)
- [Deploy a Go Web Server on Render](https://render.com/docs/deploy-go-nethttp)
- [Native Runtimes](https://render.com/docs/native-runtimes)
- [Web Services](https://render.com/docs/web-services)
- [Create and Connect to Render Postgres](https://render.com/docs/postgresql-creating-connecting)
- [Deploy for Free](https://render.com/docs/free)
