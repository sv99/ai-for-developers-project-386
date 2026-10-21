import { vi } from 'vitest'

// Ручной fetch-стаб (решение тикета «Транспорт фронта», карта #61 — без msw):
// собирает вызовы и выдаёт заготовленные ответы по очереди.

export type FetchCall = { url: string; init: RequestInit }
type StubbedResponse = { status: number; body: unknown }

export function stubFetch() {
  const calls: FetchCall[] = []
  const queue: StubbedResponse[] = []
  let permanent: StubbedResponse | null = null

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init })
    const next = queue.length > 0 ? queue.shift()! : permanent
    if (!next) {
      throw new Error(`нет заготовленного ответа для ${url}`)
    }
    const text = next.body === undefined ? '' : JSON.stringify(next.body)
    return { ok: next.status < 400, status: next.status, text: async () => text } as Response
  })
  vi.stubGlobal('fetch', fetchMock)

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
