// Типы событий: чтение и создание. Пути и методы — из сгенерированного SDK (контракт).
import { request } from './client'
import type { EventType, EventTypeInput } from './types'

export const listEventTypes = (): Promise<EventType[]> => request<EventType[]>((api) => api.listEventTypes())

export const createEventType = (input: EventTypeInput): Promise<EventType> =>
  request<EventType>((api) => api.createEventType(input))
