// Транспорт API: типизированный SDK из контракта (src/api/generated/sdk.ts —
// создаётся scripts/generate-sdk.mjs из docs/openapi.yaml на рантайме openapi-fetch)
// плюс семантика ошибок ApiClientError. Пути и методы запросов живут только в SDK.
//
// База — VITE_API_BASE_URL:
// - в dev не задана → '/api': запросы уходят на same-origin, Vite proxy
//   (см. vite.config.ts) пересылает их Go-серверу, отрезая префикс /api;
// - в проде фронт и API на разных origins — задаётся полный origin API
//   (зашит в Dockerfile через ARG, CORS настраивает сервер через CORS_ORIGINS).
//
// Ошибки — ApiClientError с сообщением контракта: сервер отдаёт готовые
// русские тексты, UI показывает их как есть.

import { createSdk, type Sdk } from './generated/sdk'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export class ApiClientError extends Error {
  /** HTTP-статус; 0 — сеть недоступна. */
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type SdkResult = { data?: unknown; error?: unknown; response: Response }

/** Выполнить вызов SDK: сетевая ошибка → статус 0, не-2xx → статус и message контракта. */
export async function request<T>(make: (sdk: Sdk) => Promise<SdkResult>): Promise<T> {
  let result: SdkResult
  try {
    // SDK собираем под каждый вызов: createClient фиксирует глобальные fetch/Request
    // при создании, а в тестах они подменяются перед каждым запросом
    result = await make(createSdk(BASE))
  } catch {
    // openapi-fetch пробрасывает ошибку fetch как есть (в браузере — TypeError сети)
    throw new ApiClientError(0, 'Сервер недоступен. Попробуйте позже.')
  }
  const { data, error, response } = result
  if (error !== undefined) {
    // не-2xx: openapi-fetch кладёт в error распарсенное тело (не-JSON — строкой)
    throw new ApiClientError(response.status, messageFrom(error))
  }
  return (data === undefined ? null : data) as T
}

function messageFrom(error: unknown): string {
  if (error !== null && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) {
      return message
    }
  }
  return 'Внутренняя ошибка сервера'
}
