#!/usr/bin/env node
// Сгенерировать клиентский SDK из закоммиченного контракта `docs/openapi.yaml`.
//
// Usage:
//   node scripts/generate-sdk.mjs [--check]
//
// SDK — типизированный транспорт на рантайме `openapi-fetch`: по каждой операции
// контракта эмитится функция с именем `operationId`, пути и методы живут только здесь,
// в рукописных модулях `src/api` их дублирования больше нет. Сгенерированный файл
// коммитится; повторный запуск даёт побайтово тот же результат.
//
// Регенерация всего SDK (типы + клиент) — `pnpm api:sdk` (прогоняет и `api:types`).

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CONTRACT = join(ROOT, 'docs', 'openapi.yaml')
const TARGET = join(ROOT, 'src', 'api', 'generated', 'sdk.ts')

const checkOnly = process.argv.includes('--check')
const doc = parse(readFileSync(CONTRACT, 'utf8'))

const METHODS = ['get', 'post', 'put', 'patch', 'delete']
const operations = []

for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
  for (const method of METHODS) {
    const op = pathItem?.[method]
    if (!op?.operationId) {
      continue
    }
    const parameters = op.parameters ?? []
    operations.push({
      id: op.operationId,
      method: method.toUpperCase(),
      path,
      description: (op.description ?? '').trim().replaceAll('*/', '* /'),
      pathParams: parameters.filter((p) => p.in === 'path').map((p) => p.name),
      queryParams: parameters.filter((p) => p.in === 'query').map((p) => p.name),
      bodyRef: op.requestBody?.content?.['application/json']?.schema?.$ref ?? null,
    })
  }
}

if (operations.length === 0) {
  console.error('Ошибка: в контракте не нашлось ни одной операции — генерировать нечего.')
  process.exit(1)
}

// Тип тела запроса: имя схемы из $ref (названия схем — валидные идентификаторы TS).
const schemaType = (ref) => {
  const name = ref.split('/').pop()
  return `components['schemas']['${name}']`
}

const emitOperation = (op) => {
  const args = []
  const options = []
  if (op.pathParams.length > 0) {
    args.push(...op.pathParams.map((name) => `${name}: string`))
    options.push(`params: { path: { ${op.pathParams.join(', ')} } }`)
  }
  if (op.queryParams.length > 0) {
    args.push(...op.queryParams.map((name) => `${name}: string`))
    options.push(`params: { query: { ${op.queryParams.join(', ')} } }`)
  }
  if (op.bodyRef) {
    args.push(`body: ${schemaType(op.bodyRef)}`)
    options.push('body')
  }
  const call = `client.${op.method}('${op.path}'${options.length > 0 ? `, { ${options.join(', ')} }` : ''})`
  const jsdoc = op.description ? `/** ${op.description} */\n  ` : ''
  return `  ${jsdoc}${op.id}: (${args.join(', ')}) => ${call},`
}

const usesBodies = operations.some((op) => op.bodyRef)
const imports = [
  "import createClient from 'openapi-fetch'",
  usesBodies ? "import type { components, paths } from './schema'" : "import type { paths } from './schema'",
].join('\n')

const output = `// Сгенерировано scripts/generate-sdk.mjs из docs/openapi.yaml — не редактировать руками.
${imports}

/** Типизированный SDK «Календаря звонков»: пути и методы запросов — из контракта. */
export const createSdk = (baseUrl: string) => {
  const client = createClient<paths>({ baseUrl })
  return {
${operations.map(emitOperation).join('\n')}
  }
}

export type Sdk = ReturnType<typeof createSdk>
`

if (checkOnly) {
  if (existsSync(TARGET) && readFileSync(TARGET, 'utf8') === output) {
    console.log('✓ src/api/generated/sdk.ts актуален')
    process.exit(0)
  }
  console.error('✗ src/api/generated/sdk.ts устарел — перегенерируйте: pnpm api:sdk')
  process.exit(1)
}

writeFileSync(TARGET, output)
console.log(`✓ SDK записан в ${TARGET.slice(ROOT.length + 1)}`)
console.log('  Источник: docs/openapi.yaml (операций: ' + operations.length + ')')
