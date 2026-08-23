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
  // rgba() и hsl() ищутся наравне с hex: проверка на один только `#RRGGBB`
  // пропускала инлайновые стили вида
  // `style.cssText = 'background: rgba(255,153,0,0.8)'`, а это ровно тот же
  // цвет мимо темы — просто записанный иначе.
  const colors = scan(uiFiles, /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\s*\(/, (f) => f === THEME)
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

/* ══ G: объявлено — значит подключено ═══════════════════════════════════════
 *
 * Разбор готового шутера показал класс дефектов, который проходил всю приёмку
 * незамеченным: код написан, выглядит законченным и никуда не подключён.
 * Пустые модули из контракта архитектуры, события шины без слушателя, слой
 * тач-управления, ни разу не вставленный в DOM, файл балансных чисел, из
 * которого ничего не читается. Ни одна из проверок ниже не знает жанра — они
 * ловят разрыв между «объявил» и «включил» в любой игре.
 */

const codeText = codeFiles.map(read).join('\n')
const cssFiles = srcFiles.filter((f) => extname(f) === '.css')
const cssText = cssFiles.map(read).join('\n')

/* ── G1: модуль объявлен и не написан ──────────────────────────────────── */
// A3 ищет слово TODO, поэтому файл в ноль байт проходил её как «заглушек нет».
// Модуль из контракта архитектуры, созданный и не заполненный, — это и есть
// заглушка в самом чистом виде.
const thin = []
for (const file of codeFiles) {
  // Файлы деклараций и чистые реэкспорты короткие по своей природе: в них
  // нечему быть написанным.
  if (/\.d\.ts$/.test(file)) continue
  const meaningful = read(file)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*')
                 && !l.startsWith('///') && !l.startsWith('import ')
                 && !l.startsWith('export {') && !l.startsWith('export *'))
  if (meaningful.length < 3) {
    thin.push(`${relative(ROOT, file)}  ${meaningful.length} содержательных строк`)
  }
}
thin.length ? fail('G1', 'Модуль создан и не написан (файл пуст или почти пуст)', thin)
            : pass('G1', 'Пустых модулей нет')

/* ── G2: событие объявлено, а половины связи нет ───────────────────────── */
const emitted = new Set()
const listened = new Set()
for (const m of codeText.matchAll(/\.emit\(\s*['"`]([A-Za-z_][\w:.-]*)['"`]/g)) emitted.add(m[1])
for (const m of codeText.matchAll(/\.(?:on|once|addListener|subscribe)\(\s*['"`]([A-Za-z_][\w:.-]*)['"`]/g)) listened.add(m[1])
if (!emitted.size && !listened.size) {
  skip('G2', 'Шины событий в проекте нет — проверять нечего')
} else {
  const orphans = [
    ...[...emitted].filter((e) => !listened.has(e)).map((e) => `${e} — отправляется, никто не слушает`),
    ...[...listened].filter((e) => !emitted.has(e)).map((e) => `${e} — слушается, никто не отправляет`),
  ]
  orphans.length ? fail('G2', 'События шины подключены с одной стороны', orphans)
                 : pass('G2', 'У каждого события есть и отправитель, и слушатель')
}

/* ── G3: состояние отправлено и нигде не разобрано ─────────────────────── */
// `events.emit('GAME_STATE_CHANGED', 'PAUSED')` при обработчике, который знает
// только 'PLAYING' и 'MENU': пауза площадки уходила в никуда, и игра
// продолжала крутиться под рекламой.
const payloads = new Set()
for (const call of codeText.matchAll(/\.emit\(\s*['"`][^'"`]+['"`]\s*,([^)\n]*)\)/g)) {
  // Аргумент бывает тернарным (`isPaused ? 'PAUSED' : 'PLAYING'`), поэтому
  // берём все строки-константы из аргументов, а не только первую.
  for (const lit of call[1].matchAll(/['"`]([A-Z][A-Z_0-9]{2,})['"`]/g)) payloads.add(lit[1])
}
if (!payloads.size) {
  skip('G3', 'Состояний-строк в событиях нет — проверять нечего')
} else {
  // «Разобрано» — это сравнение или ветка, а не упоминание в объявлении типа:
  // union в описании шины перечисляет все состояния и потому не доказывает
  // ничего.
  const unhandled = []
  for (const state of payloads) {
    const handled = new RegExp(
      `[=!]==?\\s*['"\`]${state}['"\`]|case\\s+['"\`]${state}['"\`]|['"\`]${state}['"\`]\\s*:(?!\\s*[A-Za-z])`
    ).test(codeText)
    if (!handled) unhandled.push(`${state} — отправляется, но ни одна ветка кода его не проверяет`)
  }
  unhandled.length ? fail('G3', 'Состояние уходит в шину и нигде не разбирается', unhandled)
                   : pass('G3', 'Каждое отправленное состояние где-то разбирается')
}

/* ── G4: слой тач-управления вставлен в DOM ────────────────────────────── */
// Слой собирался целиком — стик, зона обзора, четыре кнопки — и оставался
// висеть без родителя: `show()` ставил `display:block` элементу, которого нет
// в документе. На телефоне игра оказалась без единой кнопки.
const touchFiles = codeFiles.filter((f) => /touch/i.test(relative(ROOT, f)))
if (!touchFiles.length) {
  skip('G4', 'Отдельного модуля тач-управления нет — проверить вставку в DOM нечем')
} else {
  // Слой считается вставленным, если модуль сам цепляет его к чему-то внешнему
  // (документ, найденный узел, слой интерфейса, переданный родитель) — либо
  // если это делает кто-то другой.
  const mountsItself = touchFiles.some((f) =>
    /(document\.body|getElementById\([^)]*\)|ui\.\w+|\b(controlsLayer|root|parent|container|host|mount|target)\b)\s*\.\s*(appendChild|append|prepend|replaceChildren)\s*\(/.test(read(f)))
  const mountedElsewhere = codeFiles
    .filter((f) => !touchFiles.includes(f))
    .some((f) => /\.(appendChild|append|prepend|replaceChildren)\s*\([^)]*touch/i.test(read(f)))
  mountsItself || mountedElsewhere
    ? pass('G4', 'Слой тач-управления вставлен в документ')
    : fail('G4', 'Слой тач-управления создан, но ни разу не вставлен в DOM — на телефоне играть нечем',
           touchFiles.map((f) => relative(ROOT, f)))
}

/* ── G5: числа баланса читаются кодом ──────────────────────────────────── */
// Имена ключей в balance.yaml транслитерированы дизайнером и в коде не
// встречаются никогда, поэтому сверяем не имена, а сами числа: значение,
// продуманное вместе с объяснением «что сломается, если отклониться», обязано
// доехать до кода. Единицы иногда пересчитывают (units/s → м/с), поэтому порог
// мягкий: он ловит не расхождение в паре чисел, а игру, где баланс придуман
// заново на месте.
const BALANCE = join(ROOT, 'balance.yaml')
if (!existsSync(BALANCE)) {
  skip('G5', 'balance.yaml в пакете нет — числа проверять негде')
} else {
  const designed = [...new Set(
    [...read(BALANCE).matchAll(/^\s*value:\s*'?"?\s*(-?\d+(?:\.\d+)?)/gm)].map((m) => m[1])
  )].filter((n) => n !== '0' && n !== '1')
  const missing = designed.filter((n) => !new RegExp(`(?<![\\d.])${n.replace('.', '\\.')}(?![\\d])`).test(codeText))
  const landed = designed.length - missing.length
  if (designed.length < 4) {
    skip('G5', 'В balance.yaml почти нет числовых значений — сверять нечего')
  } else if (landed * 3 < designed.length) {
    fail('G5', `Баланс придуман заново в коде: из ${designed.length} продуманных чисел доехало ${landed}`,
         missing.slice(0, 12).map((n) => `${n} — нет в src/`))
  } else {
    pass('G5', `Числа баланса доезжают до кода (${landed} из ${designed.length})`)
  }
}

/* ── G6: переменная, посчитанная в JS, читается в CSS ──────────────────── */
// `--ui-scale` считался на каждый resize, писался в :root и не участвовал ни в
// одном правиле. Вся адаптивность существовала и ничего не делала.
const written = [...codeText.matchAll(/setProperty\(\s*['"`](--[\w-]+)['"`]/g)].map((m) => m[1])
if (!written.length) {
  skip('G6', 'JS не пишет CSS-переменных — проверять нечего')
} else {
  const dead = [...new Set(written)].filter((v) => !new RegExp(`var\\(\\s*${v}\\b`).test(cssText))
  dead.length ? fail('G6', 'JS пишет CSS-переменную, которую не читает ни одно правило', dead)
              : pass('G6', 'Посчитанные в JS переменные участвуют в вёрстке')
}

/* ── G7: интерфейс переживает узкий экран ──────────────────────────────── */
const breakpoints = (cssText.match(/@media/g) || []).length
if (!cssFiles.length) {
  skip('G7', 'CSS в проекте нет — брейкпоинты проверять негде')
} else if (breakpoints) {
  pass('G7', `Брейкпоинты в вёрстке есть (${breakpoints})`)
} else {
  fail('G7', 'Ни одного @media во всём CSS: интерфейс свёрстан под один размер экрана')
}

/* ── H: чек-листы базы знаний отработаны ───────────────────────────────── */
// Пункты едут в промпт с просьбой «закрой или объясни». Просьба, которую никто
// не проверяет, ничем не отличается от её отсутствия: документ на 726 строк уже
// доезжал в пакет, назывался в промпте и не был открыт ни разу.
const ACCEPTANCE = join(ROOT, 'ACCEPTANCE.md')
if (!existsSync(ACCEPTANCE)) {
  skip('H1', 'ACCEPTANCE.md отсутствует — чек-листы базы проверить негде')
} else {
  const accepted = read(ACCEPTANCE)
  const section = accepted.split(/^## H\./m)[1]
  if (!section) {
    skip('H1', 'В ACCEPTANCE.md нет раздела H — пакет собран старой версией фабрики')
  } else {
    const body = section.split(/^## /m)[0]
    const open = body.split('\n').filter((l) => /^\s*-\s*\[\s*\]/.test(l))
    const done = (body.match(/^\s*-\s*\[[xX]\]/gm) || []).length
    const waived = (body.match(/^\s*-\s*\[~\]/gm) || []).length
    if (!done && !waived && !open.length) {
      skip('H1', 'Чек-листов у отобранных документов нет — проверять нечего')
    } else if (open.length) {
      fail('H1', `Пункты чек-листов базы не отработаны: ${open.length} без отметки (сделано ${done}, отказов ${waived})`,
           open.slice(0, 10).map((l) => l.trim().replace(/^-\s*\[\s*\]\s*/, '')))
    } else {
      pass('H1', `Чек-листы базы отработаны: сделано ${done}, осознанных отказов ${waived}`)
    }
  }
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
console.log('  A1 сборка · A2 консоль · B7–B12 вьюпорт и экраны · C2–C4, C7–C11 площадка · D геймплей · E кадры · G8–G10 глаголы, вертикаль и мёртвые методы')

if (failed.length) {
  console.error(`\nПровалено проверок: ${failed.length}. Игра не готова.`)
  process.exit(1)
}
console.log('\nСтатическая часть приёмки пройдена.')
