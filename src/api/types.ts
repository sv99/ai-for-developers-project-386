// Фасад над сгенерированными типами контракта (src/api/generated/schema.ts —
// openapi-typescript из docs/openapi.yaml). Компоненты импортируют доменные
// типы отсюда: при переезде с localStorage на HTTP пути импортов не менялись.
import type { components } from './generated/schema'

export type ApiError = components['schemas']['ApiError']
export type Booking = components['schemas']['Booking']
export type BookingInput = components['schemas']['BookingInput']
export type BookingStatus = components['schemas']['BookingStatus']
export type BookingWindowEnd = components['schemas']['BookingWindowEnd']
export type CalendarName = components['schemas']['CalendarName']
export type Contact = components['schemas']['Contact']
export type DaySlot = components['schemas']['DaySlot']
export type EventType = components['schemas']['EventType']
export type EventTypeInput = components['schemas']['EventTypeInput']
export type FreeSlotsCount = components['schemas']['FreeSlotsCount']
export type SlotStatus = components['schemas']['SlotStatus']
