// Типы событий: чтение и создание. Раньше — localStorage, теперь — HTTP-контракт.
import { request } from './client'
import type { EventType, EventTypeInput } from './types'

export const listEventTypes = (): Promise<EventType[]> => request('GET', '/event-types')

export const createEventType = (input: EventTypeInput): Promise<EventType> =>
  request('POST', '/event-types', input)
