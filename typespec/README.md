# TypeSpec: доменная модель и HTTP-контракт

Файл `typespec/main.tsp` описывает доменную модель «Календаря звонков»: сущности, их ограничения и операции API-слоя.

Это **не** HTTP-контракт: в модели нет маршрутов и сервисов — только сущности, их ограничения и операции слоя. HTTP-поверхность навешивается на те же модели в `typespec/http.tsp`; из него генерируются OpenAPI-документ, серверные стабы и фронтовые типы.

## Что внутри

- перечисления `SlotStatus` (свободно / занято) и `BookingStatus` (активна / отменена);
- модели `TimeRange`, `DaySlot`, `EventType`, `EventTypeInput`, `Contact`, `Booking`, `BookingInput`, `CalendarName`;
- ошибки `ApiError`, `NotFoundError`, `ValidationError`, `ConflictError` — с текстами из кода;
- операции API-слоя: `listBookings`, `listUpcomingBookings`, `createBooking`, `cancelBooking`, `listDaySlots`, `countFreeSlots`, `bookingWindowEnd`, `listEventTypes`, `createEventType`, `getCalendarName`, `setCalendarName`.

В описаниях зафиксированы доменные правила: 30-минутная сетка 09:00–18:00, окно регистрации — 14 дат, включая сегодня, значение «занято» (занято активной Записью, время прошло или день вне окна), сохранение тела Записи при отмене. Термины — по `GLOSSARY.md`.

## Проверка

```bash
pnpm tsp:check
```

Компилятор `@typespec/compiler` стоит в `devDependencies`; внешних библиотек сама модель не требует.

## Генерация OpenAPI и SDK из `main.tsp` — почему не работает

Проверено на `@typespec/openapi3` и `@typespec/http-client-js` (TypeSpec 1.16.0): **из `main.tsp` осмысленных OpenAPI/SDK не получить**, потому что это модель данных, а не HTTP-контракт. Эмиттеры строят вывод от HTTP-поверхности, а в `main.tsp` нет ни `@service`, ни `@route`, ни `@get`/`@post` — операции заданы сигнатурами.

Что получается на практике:

- `@typespec/openapi3` отрабатывает «успешно», но выдаёт одну схему (`TimeRange`) и `paths: {}` — остальные модели недостижимы из HTTP-операций. Плюс предупреждение `no-service-found`.
- `@typespec/json-schema` не создаёт вообще ничего: схемы не форсируются, если на них не ссылается HTTP-сторона.
- `@typespec/http-client-js` формально генерирует клиент со всеми моделями, но **выдумывает маршруты**: `listBookings` бьёт в `GET /` — эндпоинтов, которых нет. Такой SDK нерабочий и опасен: он выглядит настоящим.

Это природа самой модели: `main.tsp` описывает домен без HTTP-поверхности, описывать сетевой интерфейс в нём нечего — сетевой интерфейс живёт в `http.tsp`, генерируйте из него.

## HTTP-контракт: `http.tsp`

`typespec/http.tsp` — HTTP-контракт сервиса. Он импортирует `main.tsp`, переиспользует модели и навешивает на те же операции HTTP-поверхность: `@service`, `@server`, `@route`, `@get`/`@post`/`@put`, `@path`/`@query`/`@body`, `@statusCode` и коды ошибок (`ValidationError` → 400, `NotFoundError` → 404, `ConflictError` → 409).

С добавленной HTTP-поверхностью эмиттеры дают то, что нужно: полноценный OpenAPI со всеми операциями и схемами, а SDK-эмиттер — клиент с настоящими маршрутами (`GET /bookings`, `POST /bookings/{id}/cancel` …) вместо фиктивного `GET /`.

Фронтовые типы и SDK генерируются не TypeSpec-эмиттером, а из собранного `docs/openapi.yaml`: `pnpm api:sdk` (openapi-typescript + openapi-fetch). Эмиттер `@typespec/http-client-js` в зависимостях проекта не нужен.

## Генерация OpenAPI и SDK

```bash
pnpm openapi        # собрать docs/openapi.yaml из typespec/http.tsp
pnpm openapi:check  # проверить, что docs/openapi.yaml актуален (для CI)
pnpm api:sdk        # фронтовые типы + клиентский SDK из docs/openapi.yaml
pnpm generate       # вся регенерация разом: openapi → api:sdk → server:gen
```

Скрипт `scripts/generate-openapi.mjs` компилирует `typespec/http.tsp` эмиттером `@typespec/openapi3`, кладёт результат в `docs/openapi.yaml` и убирает временную папку `tsp-output/` (она в `.gitignore`). Флаги: `--out <dir>`, `--name <file>`, `--check`.

Почему скрипт, а не голый `tsp compile`: путь и имя файла фиксированы в репозитории (`docs/openapi.yaml`), вывод воспроизводим, а `pnpm openapi:check` ловит расхождение контракта с кодом.
