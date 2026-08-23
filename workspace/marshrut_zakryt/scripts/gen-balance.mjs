#!/usr/bin/env node
/**
 * Генерирует src/generated/balanceValues.ts из balance.yaml.
 *
 * Код игры читает числа из этого файла, сам файл — только из balance.yaml
 * (npm run gen:balance). Так правка баланса остаётся правкой yaml, а числа
 * физически присутствуют в исходниках и попадают в проверку G5.
 *
 * Парсер понимает ровно ту структуру, что сложилась в balance.yaml:
 * вложенные словари по отступам, строки вида `value: <число> <единица>`
 * и инлайновые числовые скаляры `target_fps: 60`. Строки пропускаются.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'balance.yaml')
const TARGET = join(ROOT, 'src', 'generated', 'balanceValues.ts')

const lines = readFileSync(SOURCE, 'utf8').split('\n')
const root = {}
// Стек пар [отступ, узел]: корень — псевдоузел с отступом -1.
const stack = [[-1, root]]

for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('_')) continue
  const match = trimmed.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/)
  if (!match) continue
  const [, key, rest] = match
  const indent = line.length - line.trimStart().length
  while (stack.length > 1 && stack[stack.length - 1][0] >= indent) stack.pop()
  const parent = stack[stack.length - 1][1]

  // Строка `value: <число> <единица>` — значение текущего узла-параметра.
  if (key === 'value') {
    const num = rest.match(/^(-?\d+(?:\.\d+)?)/)
    if (num && typeof parent === 'object') {
      delete parent.value_node
      Object.assign(parent, { value: Number(num[1]) })
    }
    continue
  }
  if (rest === '' || rest === '|' || rest === '>') {
    const node = {}
    parent[key] = node
    stack.push([indent, node])
    continue
  }
  const num = rest.match(/^-?'?"?\s*(-?\d+(?:\.\d+)?)\s*(?:[секмградусйзпрохода].*)?'?\"?$/)
  if (num) parent[key] = Number(num[1])
}

const render = (node, depth) => {
  const pad = '  '.repeat(depth)
  let out = ''
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'number') out += `${pad}${k}: ${v},\n`
    else {
      const inner = render(v, depth + 1)
      if (inner.trim()) out += `${pad}${k}: {\n${inner}${pad}},\n`
    }
  }
  return out
}

const banner = [
  '/** Автогенерировано из balance.yaml командой `npm run gen:balance`. Не править руками. */',
  'export const BALANCE = {',
]
const body = render(root, 1)
const footer = '} as const\n\nexport type Balance = typeof BALANCE\n'
mkdirSync(dirname(TARGET), { recursive: true })
writeFileSync(TARGET, [...banner, body.trimEnd(), footer].join('\n'), 'utf8')

const count = (body.match(/: \d/g) || []).length
console.log(`src/generated/balanceValues.ts записан: ${count} числовых значений.`)
