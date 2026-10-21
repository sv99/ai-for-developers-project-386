import { expect, test } from '@playwright/test'

import { API, bookingWindowEnd, minusDays, pickDay, resetDb, seedBooking, seedEventType } from './helpers'

test.beforeEach(resetDb)

const BOOKING_INPUT = (eventTypeId: string, date: string, startTime: string) => ({
  eventTypeId,
  date,
  startTime,
  contact: { name: 'Анна', phone: '+7 900 123-45-67' },
})

test('занятый слот недоступен: статусы в UI совпадают с данными API', async ({ page }) => {
  const type = await seedEventType('Встреча 30 минут', 30)
  const date = minusDays(await bookingWindowEnd(), 1)
  await seedBooking(type.id, date, '09:00')

  await page.goto(`/booking?type=${type.id}`)
  await pickDay(page, date)

  await expect(page.locator('.slot', { hasText: '09:00' })).toHaveClass(/slot--taken/)
  await expect(page.locator('.slot', { hasText: '09:00' })).toBeDisabled()
  await expect(page.locator('.slot--taken')).toHaveCount(1)
  await expect(page.locator('.info-value').nth(2)).toHaveText('17')
})

test('конфликт: слот заняли, пока заполняли контакт — контрактное сообщение и возврат к сетке', async ({
  page,
}) => {
  const type = await seedEventType('Встреча 30 минут', 30)
  const date = minusDays(await bookingWindowEnd(), 1)

  await page.goto(`/booking?type=${type.id}`)
  await pickDay(page, date)
  await page.locator('.slot', { hasText: '09:00' }).click()
  await page.getByRole('button', { name: 'Продолжить' }).click()

  // Пока визитор заполняет контакт, слот заняли «снаружи» — через API.
  await seedBooking(type.id, date, '09:00')

  await page.locator('input[placeholder="Имя"]').fill('Анна')
  await page.locator('input[placeholder="Телефон"]').fill('+7 900 123-45-67')
  await page.getByRole('button', { name: 'Подтвердить запись' }).click()

  await expect(page.locator('.form-error')).toHaveText(
    'Это время уже занято. Выберите другое время.',
  )
  // Возврат к обновлённой сетке: занятое время отрисовано занятым.
  await expect(page.locator('.slot', { hasText: '09:00' })).toHaveClass(/slot--taken/)
  await expect(page.locator('.slot--selected')).toHaveCount(0)
})

test('прошедшая дата вне окна регистрации: сервер не бронирует — 400', async () => {
  const type = await seedEventType('Встреча 30 минут', 30)
  // Вчерашняя дата (последний день окна + 1) — прошла безусловно, независимо
  // от того, в котором часу UTC исполняется тест. Через UI такой день недостижим
  // (календарь не листает в прошлое), правило проверяем на границе с сервером;
  // точечное «start ≤ now — прошло» для сегодняшнего дня покрыто тестом хендлеров.
  const yesterday = minusDays(await bookingWindowEnd(), 14)

  const response = await fetch(`${API}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(BOOKING_INPUT(type.id, yesterday, '09:00')),
  })

  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({ message: 'Выберите дату из окна регистрации' })
})
