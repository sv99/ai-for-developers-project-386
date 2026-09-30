# TypeSpec: доменная модель API-слоя

Файл `typespec/main.tsp` описывает доменную модель «Календаря звонков» по контракту API-слоя в `src/api`.

Это **не** HTTP-контракт: сервис клиентский, модули `src/api` работают с `localStorage` напрямую, эндпоинтов нет (см. `docs/spec.md`). Поэтому в модели нет маршрутов и сервисов — только сущности, их ограничения и операции слоя.

## Что внутри

- перечисления `SlotStatus` (свободно / занято) и `BookingStatus` (активна / отменена);
- модели `TimeRange`, `DaySlot`, `EventType`, `EventTypeInput`, `Contact`, `Booking`, `BookingInput`, `CalendarName`;
- ошибки `ApiError`, `NotFoundError`, `ValidationError`, `ConflictError` — с текстами из кода;
- операции API-слоя: `listBookings`, `listUpcomingBookings`, `createBooking`, `cancelBooking`, `listDaySlots`, `countFreeSlots`, `bookingWindowEnd`, `listEventTypes`, `createEventType`, `getCalendarName`, `setCalendarName`.

В описаниях зафиксированы доменные правила: 30-минутная сетка 09:00–18:00, окно регистрации 14 дней, значение «занято» (занято активной Записью, время прошло или день вне окна), сохранение тела Записи при отмене. Термины — по `CONTEXT.md`.

## Проверка

```bash
pnpm tsp:check
```

Компилятор `@typespec/compiler` стоит в `devDependencies`; внешних библиотек сама модель не требует. Для проверки схемой OpenAPI нужен `@typespec/openapi3` — здесь он не подключён: HTTP в проекте нет, эмиттер дал бы пустой список путей и предупреждение «no service found».
