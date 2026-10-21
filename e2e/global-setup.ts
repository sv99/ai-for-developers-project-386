import { execSync } from 'node:child_process'

// Гарантируем локальную compose-БД (идемпотентный up -d --wait). В CI БД
// приходит service-контейнером, а docker на раннере недоступен — пропускаем.
export default () => {
  if (!process.env.CI) {
    execSync('pnpm db:up', { stdio: 'inherit' })
  }
}
