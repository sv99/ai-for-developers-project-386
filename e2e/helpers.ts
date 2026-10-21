import { execSync } from 'node:child_process'

import { expect, type Page } from '@playwright/test'

// API Go-сервера напрямую, мимо UI. Сидирование и проверка данных через API —
// осознанное решение: быстро и надёжно, при этом пользовательские потоки
// гоняются через настоящий интерфейс (клики, формы, попапы).
export const API = 'http://localhost:3000'

/** Чистит БД: каждый тест стартует с пустым календарём и дефолтными настройками. */
export const resetDb = () => {
  execSync('pnpm e2e:reset', { stdio: 'pipe' })
}

export type ApiEventType = {
  id: string
  name: string
  description: string
  durationMinutes: number
}

const post = async (path: string, body: unknown): Promise<Record<string, unknown>> => {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as Record<string, unknown>
  if (!response.ok) {
    throw new Error(`${path} → ${response.status}: ${JSON.stringify(payload)}`)
  }
  return payload
}

export const seedEventType = async (name: string, durationMinutes: number): Promise<ApiEventType> =>
  (await post('/event-types', {
    name,
    description: `${name} (e2e)`,
    durationMinutes,
  })) as ApiEventType

export const seedBooking = async (
  eventTypeId: string,
  date: string,
  startTime: string,
): Promise<void> => {
  await post('/bookings', {
    eventTypeId,
    date,
    startTime,
    contact: { name: 'Анна', phone: '+7 900 123-45-67' },
  })
}

export const bookingWindowEnd = async (): Promise<string> => {
  const response = await fetch(`${API}/booking-window-end`)
  const body = (await response.json()) as { date: string }
  return body.date
}

/** windowEnd минус N дней — наивная арифметика YYYY-MM-DD без часовых поясов. */
export const minusDays = (iso: string, days: number): string => {
  const [year = 1970, month = 1, day = 1] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10)
}

const MONTHS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
]

/** Листает календарь к месяцу даты (вид по умолчанию — текущий месяц, окно шире). */
export const openMonth = async (page: Page, iso: string) => {
  const label = `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)} г.`
  const monthLabel = page.locator('.calendar-month')
  await expect(monthLabel).toBeVisible()
  while ((await monthLabel.innerText()) !== label) {
    await page.locator('button[aria-label="Следующий месяц"]').click()
    await expect(monthLabel).toHaveText(label)
  }
}

/** Ячейка дня внутри месяца (дни соседних месяцев помечены .day--outside). */
export const dayCell = (page: Page, iso: string) =>
  page.locator('.day:not(.day--outside)').filter({
    has: page.locator('.day-number', { hasText: new RegExp(`^${Number(iso.slice(8, 10))}$`) }),
  })

/** Выбирает дату в календаре: листает к месяцу и кликает день. */
export const pickDay = async (page: Page, iso: string) => {
  await openMonth(page, iso)
  await dayCell(page, iso).click()
}
