import { expect, test } from '@playwright/test'

import { bookingWindowEnd, dayCell, minusDays, openMonth, pickDay, resetDb, seedBooking, seedEventType } from './helpers'

test.beforeEach(resetDb)

test('журнал показывает Записи по дням, отмена через попап убирает её', async ({ page }) => {
  const type = await seedEventType('Вводный звонок', 30)
  const end = await bookingWindowEnd()
  const first = minusDays(end, 1)
  const second = minusDays(end, 2)
  await seedBooking(type.id, first, '10:00')
  await seedBooking(type.id, second, '12:00')

  await page.goto('/upcoming')

  // Дни с Записями подсвечены и посчитаны (счётчики появляются после загрузки журнала).
  await openMonth(page, first)
  await expect(dayCell(page, first)).toHaveClass(/day--has-items/)
  await expect(dayCell(page, first).locator('.day-count')).toHaveText('1 зап.')
  await expect(dayCell(page, second).locator('.day-count')).toHaveText('1 зап.')

  await pickDay(page, first)
  await expect(page.locator('.booking')).toHaveCount(1)
  await expect(page.locator('.booking-time')).toHaveText('10:00 - 10:30')
  await expect(page.locator('.booking-type')).toHaveText('Вводный звонок')
  await expect(page.locator('.booking-contact')).toHaveText('Анна, +7 900 123-45-67')

  // Детали записи и действие отмены появляются только у выбранной записи.
  await page.locator('.booking').click()
  await expect(page.locator('.details')).toContainText('+7 900 123-45-67')
  await expect(page.locator('.remove-button')).toBeVisible()

  // Попап спрашивает подтверждение; «Да, отменить» убирает Запись из журнала.
  await page.locator('.remove-button').click()
  await page.getByRole('button', { name: 'Да, отменить' }).click()

  await expect(page.locator('.booking')).toHaveCount(0)
  await expect(dayCell(page, first).locator('.day-count')).toHaveText('0 зап.')
  await expect(dayCell(page, first)).not.toHaveClass(/day--has-items/)
  // Вторая Запись (другой день) не задета.
  await expect(dayCell(page, second).locator('.day-count')).toHaveText('1 зап.')
})
