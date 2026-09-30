import { listBookings } from './bookings'
import { listEventTypes } from './eventTypes'
import { bookingRange, fitsInDay, listStartTimes, SLOT_MINUTES, toMinutes, toTime } from './slots'

export type SlotStatus = 'free' | 'taken'

export type DaySlot = {
  startTime: string
  endTime: string
  status: SlotStatus
}

/**
 * Слот занят, если его занимает активная Запись или его начало уже прошло:
 * забронировать прошедшее время нельзя, поэтому для посетителя оно недоступно.
 */
const isPastStart = (date: string, startTime: string): boolean =>
  new Date(`${date}T${startTime}:00`).getTime() <= Date.now()

const takenMinutes = (date: string): Set<number> => {
  const durations = new Map(listEventTypes().map((type) => [type.id, type.durationMinutes]))
  const taken = new Set<number>()

  for (const booking of listBookings()) {
    if (booking.status !== 'active' || booking.date !== date) {
      continue
    }
    const duration = durations.get(booking.eventTypeId)
    if (!duration) {
      continue
    }
    const range = bookingRange(booking.startTime, duration)
    for (let minutes = range.start; minutes < range.end; minutes += SLOT_MINUTES) {
      taken.add(minutes)
    }
  }

  return taken
}

export const listDaySlots = (date: string): DaySlot[] => {
  const taken = takenMinutes(date)

  return listStartTimes().map((startTime) => {
    const start = toMinutes(startTime)
    const busy = taken.has(start) || isPastStart(date, startTime)

    return {
      startTime,
      endTime: toTime(start + SLOT_MINUTES),
      status: busy ? 'taken' : 'free',
    }
  })
}

export const countFreeSlots = (date: string): number =>
  listDaySlots(date).filter((slot) => slot.status === 'free').length

/** Слоты, которые могут стать началом события такой длительности. */
export const listDayStarts = (date: string, durationMinutes: number): DaySlot[] =>
  listDaySlots(date).filter((slot) => fitsInDay(slot.startTime, durationMinutes))
