#!/usr/bin/env node
/**
 * Статическая часть приёмки проекта. Полный список — в ACCEPTANCE.md.
 * Запуск:  node scripts/check-spec.mjs
 * Код возврата 1, если провалилась хотя бы одна проверка.
 *
 * Зависимостей нет намеренно: скрипт обязан работать до npm install.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')
const UI = join(SRC, 'ui')
const THEME = join(UI, 'theme.css')

const results = []
const pass = (id, text) => results.push({ id, text, ok: true })
const fail = (id, text, hits = []) => results.push({ id, text, ok: false, hits })
const skip = (id, text) => results.push({ id, text, ok: null })

function walk(dir, exts) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, exts))
    else if (!exts || exts.includes(extname(full))) out.push(full)
  }
  return out
}

const read = (file) => { try { return readFileSync(file, 'utf8') } catch { return '' } }

/** Ищет регулярку по файлам, возвращает список "путь:строка  фрагмент". */
function scan(files, re, skipFile) {
  const hits = []
  for (const file of files) {
    if (skipFile && skipFile(file)) continue
    const lines = read(file).split('\n')
    lines.forEach((line, i) => {
      const m = line.match(re)
      if (m) hits.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim().slice(0, 90)}`)
    })
  }
  return hits
}

const srcFiles = walk(SRC, ['.ts', '.tsx', '.js', '.mjs', '.css'])
const uiFiles = walk(UI, ['.ts', '.tsx', '.js', '.css'])
const codeFiles = srcFiles.filter((f) => extname(f) !== '.css')

if (!srcFiles.length) {
  console.error('src/ пуст или отсутствует — проверять нечего.')
  process.exit(1)
}

/* ── A3: заглушки ──────────────────────────────────────────────────────── */
const stubs = scan(codeFiles, /\b(TODO|FIXME)\b|not implemented|Not implemented/)
stubs.length ? fail('A3', 'В коде остались TODO / FIXME / заглушки', stubs)
             : pass('A3', 'Заглушек и TODO в коде нет')

/* ── B1: литералы цвета вне темы ───────────────────────────────────────── */
if (!existsSync(THEME)) {
  fail('B1', 'Нет src/ui/theme.css — единственного места со значениями токенов')
} else {
  const colors = scan(uiFiles, /#[0-9a-fA-F]{3,8}\b/, (f) => f === THEME)
  colors.length ? fail('B1', 'Литералы цвета вне theme.css', colors)
                : pass('B1', 'Все цвета живут в theme.css')
}

/* ── B2: эмодзи в интерфейсе ───────────────────────────────────────────── */
const emoji = scan(uiFiles, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u)
emoji.length ? fail('B2', 'Эмодзи вместо иконок в интерфейсе', emoji)
             : pass('B2', 'Иконки не подменены эмодзи')

/* ── B3: браузерные диалоги ────────────────────────────────────────────── */
const dialogs = scan(codeFiles, /(^|[^.\w])(alert|confirm|prompt)\s*\(/)
dialogs.length ? fail('B3', 'Браузерные диалоги alert/confirm/prompt', dialogs)
               : pass('B3', 'Браузерных диалогов нет')

/* ── B4: z-index мимо токенов ──────────────────────────────────────────── */
const zIndex = scan(uiFiles, /z-?[Ii]ndex\s*[:=]\s*["']?\s*\d/, (f) => f === THEME)
zIndex.length ? fail('B4', 'z-index числом вместо токена --z-*', zIndex)
              : pass('B4', 'Порядок слоёв задан токенами')

/* ── B5: непрозрачная заливка поверх канваса ───────────────────────────── */
const opaque = scan(
  walk(join(UI, 'screens'), ['.ts', '.tsx', '.css']),
  /background(-?[Cc]olor)?\s*[:=]\s*["'`]?\s*(#[0-9a-fA-F]{3,8}|rgb\(|rgba\([^)]*,\s*(0?\.[6-9]\d*|1(\.0)?)\s*\))/,
)
opaque.length
  ? fail('B5', 'Экран заливает канвас непрозрачным фоном — за меню не видно игру', opaque)
  : pass('B5', 'Экраны не закрывают игровую сцену заливкой')

/* ── B6: контейнеры слоёв прозрачны для ввода ──────────────────────────── */
const layerCss = read(THEME) + uiFiles.map(read).join('\n')
const layersTransparent = /pointer-events\s*:\s*none/.test(layerCss)
if (layersTransparent) pass('B6', 'Слои объявлены прозрачными для указателя (pointer-events: none)')
else fail('B6', 'Нигде нет pointer-events: none — оверлей съест игровой ввод')

/* ── C1: game_ready ровно один раз ─────────────────────────────────────── */
const ready = scan(codeFiles, /game_ready|GAME_READY|setGameReady|gameReady/)
if (!ready.length) {
  fail('C1', 'Сигнал game_ready не найден — на площадке игра не стартует')
} else if (ready.length > 3) {
  fail('C1', 'game_ready упоминается слишком часто: он обязан отправляться ровно один раз', ready)
} else {
  pass('C1', `Сигнал game_ready на месте (${ready.length} упоминания)`)
}

/* ── C6: награда только по state === 'rewarded' ────────────────────────── */
const rewarded = scan(codeFiles, /showRewarded|REWARDED/)
if (!rewarded.length) {
  skip('C6', 'Rewarded-реклама в коде не найдена — проверьте, предусмотрена ли она спецификацией')
} else {
  const guarded = /['"]rewarded['"]/.test(codeFiles.map(read).join('\n'))
  if (guarded) pass('C6', "Награда привязана к состоянию 'rewarded'")
  else fail('C6', "Rewarded есть, а проверки state === 'rewarded' нет: награда выдастся за закрытую рекламу")
}

/* ── C5: одна точка сохранения ─────────────────────────────────────────── */
const storage = scan(codeFiles, /localStorage\.(get|set)Item/)
storage.length > 4
  ? fail('C5', 'localStorage используется вразнобой: сохранение должно идти через один сервис', storage)
  : pass('C5', 'Обращений к localStorage напрямую немного')

/* ── F1: DESIGN.md написан ─────────────────────────────────────────────── */
const DESIGN = join(ROOT, 'DESIGN.md')
if (!existsSync(DESIGN)) {
  fail('F1', 'Нет DESIGN.md — дизайн игры не описан (секция 7 мастер-промпта)')
} else {
  const design = readFileSync(DESIGN, 'utf8')
  // Пять обязательных тем. Ищем по смыслу, а не по точным заголовкам: агент
  // вправе назвать разделы по-своему, но пропустить их не вправе.
  const topics = [
    ['палитра', /палитр|palette|#[0-9a-fA-F]{6}/i],
    ['камера', /камер|camera|FOV/i],
    ['экраны', /экран|screen|меню|menu/i],
    ['сцена за меню', /сцена за меню|фон меню|живая сцена|menu scene/i],
  ]
  const missing = topics.filter(([, re]) => !re.test(design)).map(([name]) => name)
  if (design.trim().length < 400) {
    fail('F1', `DESIGN.md слишком короткий (${design.trim().length} символов): это заготовка, а не дизайн`)
  } else if (missing.length) {
    fail('F1', `В DESIGN.md не раскрыты темы: ${missing.join(', ')}`)
  } else {
    pass('F1', 'DESIGN.md на месте и покрывает обязательные темы')
  }
}

/* ── F2: решение по готовому коду записано ─────────────────────────────── */
const DEVLOG = join(ROOT, 'DEVLOG.md')
if (!existsSync(join(ROOT, 'LIBRARY.md'))) {
  skip('F2', 'LIBRARY.md отсутствует — каталог готового кода не проверяется')
} else if (!existsSync(DEVLOG)) {
  fail('F2', 'Нет DEVLOG.md — решение по готовому коду фабрики нигде не записано')
} else {
  const devlog = readFileSync(DEVLOG, 'utf8')
  const mentionsLibrary = /docs\/ref\/|knowledge-showcase|LIBRARY\.md|fetch-knowledge/.test(devlog)
  mentionsLibrary
    ? pass('F2', 'В DEVLOG.md записано, что взято из готового кода и что писалось с нуля')
    : fail('F2', 'В DEVLOG.md нет ни строки о готовом коде фабрики: взял или не взял и почему')
}

/* ── вывод ─────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => r.ok === false)
for (const r of results) {
  const mark = r.ok === null ? '· ' : r.ok ? '✅' : '❌'
  console.log(`${mark} ${r.id}  ${r.text}`)
  if (r.hits?.length) {
    for (const hit of r.hits.slice(0, 8)) console.log(`      ${hit}`)
    if (r.hits.length > 8) console.log(`      … ещё ${r.hits.length - 8}`)
  }
}

console.log('\nОстальное из ACCEPTANCE.md статически не проверяется и остаётся человеку:')
console.log('  A1 сборка · A2 консоль · B7–B12 вьюпорт и экраны · C2–C4, C7–C11 площадка · D геймплей · E кадры')

if (failed.length) {
  console.error(`\nПровалено проверок: ${failed.length}. Игра не готова.`)
  process.exit(1)
}
console.log('\nСтатическая часть приёмки пройдена.')
