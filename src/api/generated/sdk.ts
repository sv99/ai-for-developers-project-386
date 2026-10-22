// Сгенерировано scripts/generate-sdk.mjs из docs/openapi.yaml — не редактировать руками.
import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

/** Типизированный SDK «Календаря звонков»: пути и методы запросов — из контракта. */
export const createSdk = (baseUrl: string) => {
  const client = createClient<paths>({ baseUrl })
  return {
  /** Последний день окна регистрации, `YYYY-MM-DD`: сегодня + 14 дней.
Соответствует `bookingWindowEnd`. */
  bookingWindowEnd: () => client.GET('/booking-window-end'),
  /** Все Записи, включая отменённые и прошедшие. Соответствует `listBookings`. */
  listBookings: () => client.GET('/bookings'),
  /** Создаёт Запись. Ошибки: неизвестный Тип события, пустая дата, время вне сетки,
событие не помещается до 18:00, пустой контакт и пересечение с активной Записью.
Соответствует `createBooking`. */
  createBooking: (body: components['schemas']['BookingInput']) => client.POST('/bookings', { body }),
  /** Предстоящие Записи владельца: активные, начало которых ещё не прошло, в порядке
времени начала. Соответствует `listUpcomingBookings`. */
  listUpcomingBookings: () => client.GET('/bookings/upcoming'),
  /** Отменяет Запись: статус становится `cancelled`, время снова свободно, тело Записи
сохраняется. Ошибки: «Запись не найдена», «Запись уже отменена». Соответствует
`cancelBooking`. */
  cancelBooking: (id: string) => client.POST('/bookings/{id}/cancel', { params: { path: { id } } }),
  /** Все Типы событий. Соответствует `listEventTypes`. */
  listEventTypes: () => client.GET('/event-types'),
  /** Создаёт Тип события. Ошибки: пустое название, длительность не целое или меньше 1.
Соответствует `createEventType`. */
  createEventType: (body: components['schemas']['EventTypeInput']) => client.POST('/event-types', { body }),
  /** Проверка состояния сервера. Служебный эндпоинт: во фронтовом API-слое аналога нет. */
  health: () => client.GET('/health'),
  /** Имя календаря; по умолчанию «Владелец». Соответствует `getCalendarName`. */
  getCalendarName: () => client.GET('/settings/calendar-name'),
  /** Сохраняет имя календаря; при пустом имени ошибка. Соответствует `setCalendarName`. */
  setCalendarName: (body: components['schemas']['CalendarName']) => client.PUT('/settings/calendar-name', { body }),
  /** Слоты дня со статусами (`listDaySlots`). За окном регистрации (сегодня + 14 дней)
и в прошлом все Слоты `taken`. */
  listDaySlots: (date: string) => client.GET('/slots', { params: { query: { date } } }),
  /** Число свободных Слотов дня, 0 … 18. Соответствует `countFreeSlots`. */
  countFreeSlots: (date: string) => client.GET('/slots/free-count', { params: { query: { date } } }),
  }
}

export type Sdk = ReturnType<typeof createSdk>
