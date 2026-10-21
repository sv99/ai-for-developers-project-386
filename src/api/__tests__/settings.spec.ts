import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiClientError } from '../client'
import { getCalendarName, setCalendarName } from '../settings'
import { stubFetch } from './fetchStub'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getCalendarName', () => {
  it('GET /api/settings/calendar-name and unwraps the name', async () => {
    const stub = stubFetch()
    stub.respondAlways(200, { name: 'Команда Тота' })

    const name = await getCalendarName()

    expect(name).toBe('Команда Тота')
    expect(stub.lastCall().url).toBe('/api/settings/calendar-name')
    expect(stub.lastCall().init.method).toBe('GET')
  })
})

describe('setCalendarName', () => {
  it('PUT /api/settings/calendar-name with the name and resolves on the empty 200', async () => {
    const stub = stubFetch()
    stub.respondAlways(200, undefined)

    await setCalendarName('Команда Тота')

    expect(stub.lastCall().init.method).toBe('PUT')
    expect(JSON.parse(String(stub.lastCall().init.body))).toEqual({ name: 'Команда Тота' })
  })

  it('raises ApiClientError with the contract message on validation errors', async () => {
    const stub = stubFetch()
    stub.respondAlways(400, { message: 'Введите имя календаря' })

    const error = await setCalendarName('   ').catch((caught) => caught)

    expect((error as ApiClientError).status).toBe(400)
    expect((error as ApiClientError).message).toBe('Введите имя календаря')
  })
})
