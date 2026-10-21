import { expect, test } from '@playwright/test'

import { resetDb } from './helpers'

test.beforeEach(resetDb)

test('имя календаря сохраняется и переживает перезагрузку страницы', async ({ page }) => {
  await page.goto('/admin')
  // После reset настройки пусты — сервер отдаёт дефолт.
  await expect(page.locator('input[placeholder="Имя календаря"]')).toHaveValue('Владелец')

  await page.locator('input[placeholder="Имя календаря"]').fill('Моя звонилка')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.locator('.form-success')).toHaveText('Имя календаря сохранено.')

  await page.reload()
  await expect(page.locator('input[placeholder="Имя календаря"]')).toHaveValue('Моя звонилка')
})

test('созданный тип события появляется в списке и на странице записи', async ({ page }) => {
  await page.goto('/admin')

  await page.locator('input[placeholder="Название"]').fill('Созвон 45 минут')
  await page.locator('input[placeholder="Описание"]').fill('Проверка создания типа (e2e)')
  const duration = page.locator('input[role="spinbutton"]')
  await duration.fill('45')
  await duration.blur() // el-input-number синхронизирует v-model по change
  await page.getByRole('button', { name: 'Добавить тип' }).click()

  await expect(page.locator('.type-list')).toContainText('Созвон 45 минут')
  await expect(page.locator('.type-list')).toContainText('45 мин')

  // Тип реально доступен визитору: карточка на странице типов ведёт на бронирование.
  await page.goto('/events')
  await expect(page.locator('.type-card')).toHaveCount(1)
  await page.locator('.type-card').click()
  await expect(page).toHaveURL(/\/booking\?type=/)
  await expect(page.locator('.page-title')).toHaveText('Запись на звонок')
  await expect(page.locator('.page-empty')).toHaveCount(0)
})
