import { expect, test } from '@playwright/test'

import { API, bookingWindowEnd, minusDays, pickDay, resetDb, seedEventType } from './helpers'

test.beforeEach(resetDb)

test('визитор бронирует звонок: тип → дата → слот → контакт → подтверждение', async ({ page }) => {
  const type = await seedEventType('Вводный звонок', 30)
  const date = minusDays(await bookingWindowEnd(), 1)

  await page.goto('/events')
  // После reset настройки пусты — сервер отдаёт дефолтное имя календаря.
  await expect(page.locator('.host-name')).toHaveText('Владелец')

  await page.locator('.type-card').click()
  await expect(page).toHaveURL(new RegExp(`/booking\\?type=${type.id}`))

  await pickDay(page, date)
  // На чистой БД день целиком свободен: 18 слотов сетки 09:00–18:00 с шагом 30 минут.
  await expect(page.locator('.day--selected .day-count')).toHaveText('18 св.')

  await page.locator('.slot', { hasText: '09:00' }).click()
  await expect(page.locator('.slot--selected .slot-time')).toHaveText('09:00 - 09:30')
  await expect(page.locator('.info-value').nth(2)).toHaveText('18')

  await page.getByRole('button', { name: 'Продолжить' }).click()
  await page.locator('input[placeholder="Имя"]').fill('Анна')
  await page.locator('input[placeholder="Телефон"]').fill('+7 900 123-45-67')
  await page.getByRole('button', { name: 'Подтвердить запись' }).click()

  await expect(page.locator('.done-title')).toHaveText('Бронь подтверждена. До встречи!')
  await expect(page.locator('.done-list')).toContainText('Анна')

  // Слот ушёл из продажи: возврат к календарю показывает на один свободный меньше,
  // а забранное время отрисовано занятым.
  await page.getByRole('button', { name: 'Забронировать ещё' }).click()
  await pickDay(page, date)
  await expect(page.locator('.day--selected .day-count')).toHaveText('17 св.')
  await expect(page.locator('.slot', { hasText: '09:00' })).toHaveClass(/slot--taken/)

  const slots = (await fetch(`${API}/slots?date=${date}`).then((r) => r.json())) as Array<{
    status: string
  }>
  expect(slots.filter((slot) => slot.status === 'free')).toHaveLength(17)
})
