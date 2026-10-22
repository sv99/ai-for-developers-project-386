import { vi } from 'vitest'

// Ручной fetch-стаб (решение тикета «Транспорт фронта», карта #61 — без msw):
// собирает вызовы и выдаёт заготовленные ответы по очереди.
// Транспорт ходит через openapi-fetch, а он строит запрос конструктором Request —
// стабим и его: node-версия Request не принимает относительные URL (Failed to parse URL)
// и не отдаёт их строкой в fetch.

export type FetchCall = { url: string; init: RequestInit }
type StubbedResponse = { status: number; body: unknown }

class StubRequest {
  url: string
  method: string
  body: string | null
  headers: Headers

  constructor(input: string, init: RequestInit = {}) {
    this.url = input
    this.method = init.method ?? 'GET'
    this.body = typeof init.body === 'string' ? init.body : null
    this.headers = new Headers(init.headers)
  }
}

export { StubRequest }

export function stubFetch() {
  const calls: FetchCall[] = []
  const queue: StubbedResponse[] = []
  let permanent: StubbedResponse | null = null

  const fetchMock = vi.fn(async (input: string | StubRequest, init: RequestInit = {}) => {
    // openapi-fetch передаёт объект Request и не дублирует его в init — собираем запись сами
    const url = typeof input === 'string' ? input : input.url
    const method = typeof input === 'string' ? (init.method ?? 'GET') : (input.method ?? 'GET')
    const body = typeof input === 'string' ? init.body : input.body
    calls.push({ url, init: { ...init, method, body } })
    const next = queue.length > 0 ? queue.shift()! : permanent
    if (!next) {
      throw new Error(`нет заготовленного ответа для ${url}`)
    }
    const text =
      typeof next.body === 'string' ? next.body : next.body === undefined ? '' : JSON.stringify(next.body)
    return { ok: next.status < 400, status: next.status, headers: new Headers(), text: async () => text } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('Request', StubRequest)

  return {
    calls,
    /** Один ответ на ближайший вызов. */
    respond: (status: number, body: unknown) => queue.push({ status, body }),
    /** Постоянный ответ для всех дальнейших вызовов. */
    respondAlways: (status: number, body: unknown) => {
      permanent = { status, body }
    },
    lastCall: () => {
      if (calls.length === 0) {
        throw new Error('fetch не вызывался')
      }
      return calls[calls.length - 1]!
    },
  }
}
