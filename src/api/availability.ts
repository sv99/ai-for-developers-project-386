// Занятость дня: Слоты строит сервер, клиент добирает производные величины.
import { request } from './client'
import { fitsInDay } from './slots'
import type { BookingWindowEnd, DaySlot, FreeSlotsCount } from './types'

// Реэкспорт для страниц, которые работают с DaySlot (источник — сгенерированный контракт).
export type { DaySlot } from './types'

export const listDaySlots = (date: string): Promise<DaySlot[]> =>
  request<DaySlot[]>((api) => api.listDaySlots(date))

// Слоты, которые могут стать началом события такой длительности.
export const listDayStarts = (date: string, durationMinutes: number): Promise<DaySlot[]> =>
  listDaySlots(date).then((slots) => slots.filter((slot) => fitsInDay(slot.startTime, durationMinutes)))

export const countFreeSlots = (date: string): Promise<number> =>
  request<FreeSlotsCount>((api) => api.countFreeSlots(date)).then((body) => body.count)

export const bookingWindowEnd = (): Promise<string> =>
  request<BookingWindowEnd>((api) => api.bookingWindowEnd()).then((body) => body.date)
