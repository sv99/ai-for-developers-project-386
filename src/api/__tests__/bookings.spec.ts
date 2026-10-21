import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiClientError } from '../client'
import { cancelBooking, createBooking, listBookings, listUpcomingBookings } from '../bookings'
import { stubFetch } from './fetchStub'

const booking = {
  id: 'bk-1',
  eventTypeId: 'et-1',
  date: '2026-11-01',
  startTime: '09:00',
  contact: { name: 'Гость', phone: '+7 900 000-00-00' },
  status: 'active',
  createdAt: '2026-10-21T10:00:00Z',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listBookings', () => {
  it('GET /api/bookings and returns the list', async () => {
    const stub = stubFetch()
    stub.respondAlways(200, [booking])

    const bookings = await listBookings()

    expect(bookings).toEqual([booking])
    expect(stub.lastCall().url).toBe('/api/bookings')
    expect(stub.lastCall().init.method).toBe('GET')
  })
})

describe('listUpcomingBookings', () => {
  it('GET /api/bookings/upcoming', async () => {
    const stub = stubFetch()
    stub.respondAlways(200, [])

    await listUpcomingBookings()

    expect(stub.lastCall().url).toBe('/api/bookings/upcoming')
  })
})

describe('createBooking', () => {
  it('POST /api/bookings with the input as JSON', async () => {
    const stub = stubFetch()
    stub.respond(201, booking)

    const input = {
      eventTypeId: 'et-1',
      date: '2026-11-01',
      startTime: '09:00',
      contact: { name: 'Гость', phone: '+7 900 000-00-00' },
    }
    const created = await createBooking(input)

    expect(created).toEqual(booking)
    expect(stub.lastCall().init.method).toBe('POST')
    expect(JSON.parse(String(stub.lastCall().init.body))).toEqual(input)
  })

  it('raises ApiClientError with the contract message on 409', async () => {
    const stub = stubFetch()
    stub.respondAlways(409, { message: 'Это время уже занято. Выберите другое время.' })

    const error = await createBooking({
      eventTypeId: 'et-1',
      date: '2026-11-01',
      startTime: '09:00',
      contact: { name: 'Гость', phone: '+7 900 000-00-00' },
    }).catch((caught) => caught)

    expect(error).toBeInstanceOf(ApiClientError)
    expect((error as ApiClientError).status).toBe(409)
    expect((error as ApiClientError).message).toBe('Это время уже занято. Выберите другое время.')
  })
})

describe('cancelBooking', () => {
  it('POST /api/bookings/{id}/cancel', async () => {
    const stub = stubFetch()
    stub.respond(200, { ...booking, status: 'cancelled' })

    const cancelled = await cancelBooking('bk-1')

    expect(cancelled.status).toBe('cancelled')
    expect(stub.lastCall().url).toBe('/api/bookings/bk-1/cancel')
    expect(stub.lastCall().init.method).toBe('POST')
  })

  it('raises ApiClientError with 404 when the booking is gone', async () => {
    const stub = stubFetch()
    stub.respondAlways(404, { message: 'Запись не найдена' })

    const error = await cancelBooking('bk-x').catch((caught) => caught)

    expect((error as ApiClientError).status).toBe(404)
    expect((error as ApiClientError).message).toBe('Запись не найдена')
  })
})

describe('network failures', () => {
  it('raises ApiClientError with status 0 and a human message when the server is unreachable', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    vi.stubGlobal('fetch', fetchMock)

    const error = await listBookings().catch((caught) => caught)

    expect(error).toBeInstanceOf(ApiClientError)
    expect((error as ApiClientError).status).toBe(0)
    expect((error as ApiClientError).message).toBe('Сервер недоступен. Попробуйте позже.')
  })

  it('falls back to a generic message when the error body is not JSON', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 502, text: async () => 'Bad Gateway' }) as Response)
    vi.stubGlobal('fetch', fetchMock)

    const error = await listBookings().catch((caught) => caught)

    expect((error as ApiClientError).status).toBe(502)
    expect((error as ApiClientError).message).toBe('Внутренняя ошибка сервера')
  })
})
