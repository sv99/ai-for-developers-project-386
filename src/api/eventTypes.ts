import type { EventType } from './types'

const STORAGE_KEY = 'calendar-event-types'

type EventTypeInput = Omit<EventType, 'id'>

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `et-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const readStorage = (): EventType[] => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return []
  }
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeStorage = (eventTypes: EventType[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(eventTypes))
}

export const listEventTypes = (): EventType[] => readStorage()

export const createEventType = (input: EventTypeInput): EventType => {
  const name = input.name.trim()
  if (!name) {
    throw new Error('Название типа события обязательно')
  }
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1) {
    throw new Error('Длительность должна быть целым числом минут')
  }
  const eventType: EventType = {
    id: generateId(),
    name,
    description: input.description.trim(),
    durationMinutes: input.durationMinutes,
  }
  writeStorage([...readStorage(), eventType])
  return eventType
}
