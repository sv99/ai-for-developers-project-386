// Транспорт API: тонкий fetch-слой (решение тикета «Транспорт фронта», карта #61).
//
// База — VITE_API_BASE_URL:
// - в dev не задана → '/api': запросы уходят на same-origin, Vite proxy
//   (см. vite.config.ts) пересылает их Go-серверу, отрезая префикс /api;
// - в проде фронт и API на разных origins — задаётся полный origin API
//   (зашит в Dockerfile через ARG, CORS настраивает сервер через CORS_ORIGINS).
//
// Ошибки — ApiClientError с сообщением контракта: сервер отдаёт готовые
// русские тексты, UI показывает их как есть.

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export class ApiClientError extends Error {
  /** HTTP-статус; 0 — сеть недоступна. */
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Method = 'GET' | 'POST' | 'PUT'

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiClientError(0, 'Сервер недоступен. Попробуйте позже.')
  }
  return parse<T>(response)
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!response.ok) {
    throw new ApiClientError(response.status, messageFrom(text))
  }
  return (text ? JSON.parse(text) : null) as T
}

function messageFrom(text: string): string {
  try {
    const data = JSON.parse(text) as { message?: unknown }
    if (typeof data.message === 'string' && data.message) {
      return data.message
    }
  } catch {
    // тело не JSON — общий текст ниже
  }
  return 'Внутренняя ошибка сервера'
}
