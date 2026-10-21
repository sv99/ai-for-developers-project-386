import { defineConfig } from '@playwright/test'

// E2E-каркас (решение тикета «E2E», план в issue-трекере): chromium only,
// стек поднимается сам — compose-БД (global-setup), Go-сервер (:3000) и
// Vite dev (:5173) — тот же путь запросов, что и в реальном dev.
// Сценарии делят одну БД и чистят её перед каждым тестом (helpers.resetDb),
// поэтому выполняются строго последовательно.

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm e2e:server',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm dev --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
