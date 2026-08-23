#!/usr/bin/env node
/**
 * Генерирует src/config/balance.gen.ts из balance.yaml.
 * Числа игры живут в balance.yaml; код читает их отсюда и не содержит литералов.
 * Запускается автоматически перед dev/build.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'balance.yaml')
const OUT = join(ROOT, 'src', 'config', 'balance.gen.ts')

const text = readFileSync(SRC, 'utf8')
const entries = new Map()
let lastKey = null

for (const line of text.split(/\r?\n/)) {
  const kv = line.match(/^(\s*)([A-Za-z0-9_]+):\s?(.*)$/)
  if (!kv) continue
  const [, , key, rest] = kv
  if (key === 'value') {
    const num = rest.replace(/^['"]/, '').match(/^-?\d+(?:\.\d+)?/)
    if (num && lastKey !== null) entries.set(lastKey, Number(num[0]))
  } else if (/^-?\d+(?:\.\d+)?$/.test(rest.trim())) {
    // performance-секция: ключ сразу с числом
    entries.set(key, Number(rest.trim()))
  } else if (key === '_readme' || key === 'name' || key === 'note' || key === 'parameters') {
    // служебные ключи — источник для lastKey не меняют
  } else {
    lastKey = key
  }
}

if (entries.size < 10) {
  console.error(`gen-balance: распознано только ${entries.size} значений — проверьте balance.yaml`)
  process.exit(1)
}

const body = [...entries.entries()]
  .map(([key, value]) => `  ${key}: ${value},`)
  .join('\n')

const file = `/* eslint-disable */
// Сгенерировано из balance.yaml скриптом scripts/gen-balance.mjs — не править руками.
// Правьте balance.yaml, числа приедут сюда сами при dev/build.

export const BALANCE = {
${body}
} as const

export type BalanceKey = keyof typeof BALANCE
`

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, file, 'utf8')
console.log(`gen-balance: ${entries.size} значений balance.yaml -> src/config/balance.gen.ts`)
