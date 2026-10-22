// Настройки владельца: имя календаря. Дефолт держит сервер —
// GET отдаёт «Владелец», пока не сохранено своё.
import { request } from './client'
import type { CalendarName } from './types'

export const DEFAULT_CALENDAR_NAME = 'Владелец'

export const getCalendarName = (): Promise<string> =>
  request<CalendarName>((api) => api.getCalendarName()).then((body) => body.name)

export const setCalendarName = (name: string): Promise<void> =>
  request<null>((api) => api.setCalendarName({ name })).then(() => undefined)
