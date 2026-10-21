import { afterEach, describe, expect, it, vi } from 'vitest'

import { bookingWindowEnd, countFreeSlots, listDaySlots, listDayStarts } from '../availability'
import { fitsInDay, listStartTimes, SLOT_MINUTES, toMinutes, toTime } from '../slots'
import { stubFetch } from './fetchStub'

const slots = (): ReturnType<typeof buildSlots> => buildSlots()

const buildSlots = (taken: string[] = []): Array<{ endTime: string; startTime: string; status: 'free' | 'taken' }> =>
  listStartTimes().map((startTime) => ({
    startTime,
    endTime: toTime(toMinutes(startTime) + SLOT_MINUTES),
    status: taken.includes(startTime) ? 'taken' : ('free' as const),
  }))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listDaySlots', () => {
  it('GET /api/slots?date=… and returns the slots', async () => {
    const stub = stubFetch()
    stub.respondAlways(200, slots())

    const daySlots = await listDaySlots('2026-11-01')

    expect(daySlots).toHaveLength(18)
    expect(stub.lastCall().url).toBe('/api/slots?date=2026-11-01')
    expect(stub.lastCall().init.method).toBe('GET')
  })
})

describe('listDayStarts', () => {
  it('keeps only the slots a 60-minute event can start at', async () => {
    const stub = stubFetch()
    stub.respondAlways(200, slots())

    const starts = await listDayStarts('2026-11-01', 60)

    expect(starts).toHaveLength(17) // 17:30 не помещается до 18:00
    expect(starts.every((slot) => fitsInDay(slot.startTime, 60))).toBe(true)
  })
})

describe('countFreeSlots', () => {
  it('GET /api/slots/free-count?date=… and unwraps the count', async () => {
    const stub = stubFetch()
    stub.respondAlways(200, { count: 17 })

    const count = await countFreeSlots('2026-11-01')

    expect(count).toBe(17)
    expect(stub.lastCall().url).toBe('/api/slots/free-count?date=2026-11-01')
  })
})

describe('bookingWindowEnd', () => {
  it('GET /api/booking-window-end and unwraps the date', async () => {
    const stub = stubFetch()
    stub.respondAlways(200, { date: '2026-11-03' })

    const end = await bookingWindowEnd()

    expect(end).toBe('2026-11-03')
    expect(stub.lastCall().url).toBe('/api/booking-window-end')
  })
})
