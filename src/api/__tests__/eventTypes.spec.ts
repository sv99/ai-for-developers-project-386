import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiClientError } from '../client'
import { createEventType, listEventTypes } from '../eventTypes'
import { stubFetch } from './fetchStub'

const eventType = {
  id: 'et-1',
  name: 'Встреча 15 минут',
  description: 'Короткий тип события для быстрого слота.',
  durationMinutes: 15,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listEventTypes', () => {
  it('GET /api/event-types and returns the list', async () => {
    const stub = stubFetch()
    stub.respondAlways(200, [eventType])

    const types = await listEventTypes()

    expect(types).toEqual([eventType])
    expect(stub.lastCall().url).toBe('/api/event-types')
    expect(stub.lastCall().init.method).toBe('GET')
  })
})

describe('createEventType', () => {
  it('POST /api/event-types with the input as JSON', async () => {
    const stub = stubFetch()
    stub.respond(201, eventType)

    const input = { name: 'Встреча 15 минут', description: '', durationMinutes: 15 }
    const created = await createEventType(input)

    expect(created).toEqual(eventType)
    expect(stub.lastCall().init.method).toBe('POST')
    expect(JSON.parse(String(stub.lastCall().init.body))).toEqual(input)
  })

  it('raises ApiClientError with the contract message on validation errors', async () => {
    const stub = stubFetch()
    stub.respondAlways(400, { message: 'Название типа события обязательно' })

    const error = await createEventType({ name: '  ', description: '', durationMinutes: 30 }).catch(
      (caught) => caught,
    )

    expect(error).toBeInstanceOf(ApiClientError)
    expect((error as ApiClientError).status).toBe(400)
    expect((error as ApiClientError).message).toBe('Название типа события обязательно')
  })
})
