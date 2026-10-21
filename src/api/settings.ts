// Настройки владельца: имя календаря. Дефолт держит сервер —
// GET отдаёт «Владелец», пока не сохранено своё.
import { request } from './client'
import type { CalendarName } from './types'

export const DEFAULT_CALENDAR_NAME = 'Владелец'

export const getCalendarName = (): Promise<string> =>
  request<CalendarName>('GET', '/settings/calendar-name').then((body) => body.name)

export const setCalendarName = (name: string): Promise<void> =>
  request('PUT', '/settings/calendar-name', { name })
