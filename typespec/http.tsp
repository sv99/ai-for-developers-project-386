/**
 * HTTP-контракт «Календаря звонков»: маршруты, методы и коды ответов поверх доменной модели
 * из `main.tsp`.
 *
 * Из этого файла генерируется всё остальное: OpenAPI-документ `docs/openapi.yaml` (`pnpm openapi`),
 * серверные стабы (`pnpm server:gen`) и фронтовые типы с SDK (`pnpm api:sdk`). Генераты
 * коммитятся, руками не редактируются — правьте модели и операции здесь.
 *
 * Файл подключает `@typespec/http`; эмиттер `@typespec/openapi3` стоит в `devDependencies`.
 *
 * Модели и операции переиспользуются из `main.tsp`; здесь они только получают маршруты, методы
 * и коды ответов. Домен — по GLOSSARY.md: Запись, Слот, Тип события.
 */
import "@typespec/http";
import "./main.tsp";

using TypeSpec.Http;

@service(#{
  title: "Календарь звонков",
})
@server("http://localhost:3000", "Локальный сервер разработки")
namespace CalendarServer {
  /**
   * Проверка состояния сервера. Служебный эндпоинт: во фронтовом API-слое аналога нет.
   */
  @route("/health")
  @get
  op health(): HealthOk;

  // --- Записи ---

  /** Все Записи, включая отменённые и прошедшие. Соответствует `listBookings`. */
  @route("/bookings")
  @get
  op listBookings(): Booking[] | ApiError;

  /**
   * Предстоящие Записи владельца: активные, начало которых ещё не прошло, в порядке
   * времени начала. Соответствует `listUpcomingBookings`.
   */
  @route("/bookings/upcoming")
  @get
  op listUpcomingBookings(): Booking[] | ApiError;

  /**
   * Создаёт Запись. Ошибки: неизвестный Тип события, пустая дата, время вне сетки,
   * событие не помещается до 18:00, пустой контакт и пересечение с активной Записью.
   * Соответствует `createBooking`.
   */
  @route("/bookings")
  @post
  op createBooking(@body input: BookingInput): BookingCreated | BookingConflict;
  // ... или одной строкой, если коды задаются декораторами на моделях:
  //   op createBooking(@body input: BookingInput): Booking | ConflictError | ValidationError;

  /**
   * Отменяет Запись: статус становится `cancelled`, время снова свободно, тело Записи
   * сохраняется. Ошибки: «Запись не найдена», «Запись уже отменена». Соответствует
   * `cancelBooking`.
   */
  @route("/bookings/{id}/cancel")
  @post
  op cancelBooking(@path id: string): Booking | NotFoundError | ValidationError;

  // --- Слоты и доступность ---

  /**
   * Слоты дня со статусами (`listDaySlots`). За окном регистрации (14 дат, включая сегодня)
   * и в прошлом все Слоты `taken`.
   */
  @route("/slots")
  @get
  op listDaySlots(@query date: string): DaySlot[] | ApiError;

  /** Число свободных Слотов дня, 0 … 18. Соответствует `countFreeSlots`. */
  @route("/slots/free-count")
  @get
  op countFreeSlots(@query date: string): FreeSlotsCount | ApiError;

  /**
   * Последний день окна регистрации, `YYYY-MM-DD`: 14-я дата вместе с сегодняшней
   * (сегодня + 13 дней). Соответствует `bookingWindowEnd`.
   */
  @route("/booking-window-end")
  @get
  op bookingWindowEnd(): BookingWindowEnd | ApiError;

  // --- Типы событий ---

  /** Все Типы событий. Соответствует `listEventTypes`. */
  @route("/event-types")
  @get
  op listEventTypes(): EventType[] | ApiError;

  /**
   * Создаёт Тип события. Ошибки: пустое название, длительность не целое или меньше 1.
   * Соответствует `createEventType`.
   */
  @route("/event-types")
  @post
  op createEventType(@body input: EventTypeInput): EventTypeCreated | EventTypeValidation;

  // --- Настройки владельца ---

  /** Имя календаря; по умолчанию «Владелец». Соответствует `getCalendarName`. */
  @route("/settings/calendar-name")
  @get
  op getCalendarName(): CalendarName | ApiError;

  /** Сохраняет имя календаря; при пустом имени ошибка. Соответствует `setCalendarName`. */
  @route("/settings/calendar-name")
  @put
  op setCalendarName(@body input: CalendarName): void | ValidationError;
}

/** Успешный ответ `health` — в доменной модели аналога нет. */
model HealthOk {
  @statusCode
  statusCode: 200;

  ok: true;
}

/** Обёртка успешного создания Записи с кодом 201. */
model BookingCreated {
  @statusCode
  statusCode: 201;

  @body
  booking: Booking;
}

/** Обёртка конфликта Записи с кодом 409. */
model BookingConflict {
  @statusCode
  statusCode: 409;

  @body
  error: ConflictError;
}

/** Обёртка создания Типа события с кодом 201. */
model EventTypeCreated {
  @statusCode
  statusCode: 201;

  @body
  eventType: EventType;
}

/** Обёртка ошибки валидации Типа события с кодом 400. */
model EventTypeValidation {
  @statusCode
  statusCode: 400;

  @body
  error: ValidationError;
}

/** Количество свободных Слотов дня как тело ответа, а не голое число. */
model FreeSlotsCount {
  count: int32;
}

/** Последний день окна регистрации как тело ответа. */
model BookingWindowEnd {
  date: string;
}
