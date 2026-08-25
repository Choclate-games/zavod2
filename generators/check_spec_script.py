"""Скрипт статической приёмки, который уезжает в каждый пакет игры.

Приёмка, написанная прозой, не проверяется никем: «Playgama Bridge полностью
интегрирован» нельзя ни подтвердить, ни опровергнуть, и кодовый агент
отчитывается о готовности по ощущению. Часть пунктов `ACCEPTANCE.md`
проверяется чтением исходников — эта часть здесь и живёт.

Скрипт намеренно без зависимостей: он обязан запускаться в свежем проекте до
`npm install`. Всё, что требует браузера (кадры, размеры кнопок, живая сцена за
меню), он не проверяет и честно перечисляет в конце как оставшееся человеку.
"""

CHECK_SPEC_MJS = r"""#!/usr/bin/env node
/**
 * Статическая часть приёмки проекта. Полный список — в ACCEPTANCE.md.
 * Запуск:  node scripts/check-spec.mjs
 * Код возврата 1, если провалилась хотя бы одна проверка.
 *
 * Зависимостей нет намеренно: скрипт обязан работать до npm install.
 */
import { readdirSync, readFileSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
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

/* ── A5: импорт не-кода объявлен ───────────────────────────────────────── */
// Живой случай: main.ts начинался с `import './ui/theme.css'`, объявления
// модуля в проекте не было, и `tsc` валил сборку на первой строке. Через
// `npm run dev` игра при этом открывалась — vite типы не проверяет, — поэтому
// поломку замечали только при попытке собрать релиз.
const importText = codeFiles.map(read).join('\n')
const assetImports = [...importText.matchAll(/(?:^|\n)\s*import\s+(?:[^'"\n]*from\s+)?['"]([^'"]+\.(?:css|scss|glsl|vert|frag|png|jpg|svg|json5))['"]/g)]
  .map((m) => m[1])
if (!assetImports.length) {
  pass('A5', 'Импортов не-кода нет — объявлять нечего')
} else {
  // extname('vite-env.d.ts') — это '.ts', поэтому фильтр по суффиксу, а не по расширению.
  const declarations = walk(SRC, ['.ts']).filter((f) => f.endsWith('.d.ts')).map(read).join('\n')
  const declared = /vite\/client/.test(declarations) || /declare\s+module\s+['"][^'"]*\*/.test(declarations)
  declared
    ? pass('A5', `Импорты не-кода объявлены (${assetImports.length})`)
    : fail('A5', 'Импорт не-кода без объявления — tsc уронит сборку: нужен src/vite-env.d.ts с /// <reference types="vite/client" />',
           [...new Set(assetImports)].map((i) => `import '${i}'`))
}

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

/* ── C12: конфиг моста лежит в сборке ──────────────────────────────────── */
// Живой случай: игра звала bridge.initialize(), мост шёл за
// ./playgama-bridge-config.json, получал 404 и валился. Файл описан в базе
// знаний, но его никто не требовал, и в пакет он не попал ни разу.
const bridgeText = codeFiles.map(read).join('\n')
const usesBridge = /@playgama\/bridge|playgama-bridge/.test(bridgeText)
if (!usesBridge) {
  skip('C12', 'Мост площадки не подключён — конфигу взяться неоткуда')
} else {
  const config = ['public/playgama-bridge-config.json', 'playgama-bridge-config.json',
                  'dist/playgama-bridge-config.json']
    .map((rel) => join(ROOT, rel)).find((file) => existsSync(file))
  config
    ? pass('C12', `Конфиг моста на месте (${relative(ROOT, config)})`)
    : fail('C12', 'Нет public/playgama-bridge-config.json — bridge.initialize() поймает 404 и площадка не ответит')
}

/* ── C13: мост площадки настоящий, а не одноимённый сервис ─────────────── */
// Живой случай, стоивший этой проверки: игра «Снайпер: Призрачный Контракт»
// имела `src/platform/BridgeService.ts`, звала его из `main.ts` на каждом шаге
// загрузки и записала в DEVLOG.md, что «bootstrap с Playgama Bridge запущен и
// функционирует». Никакого моста при этом не было: `@playgama/bridge` не стоял
// в зависимостях и не подключался скриптом. Сервис вызывал сам себя, игра на
// площадке не авторизовала бы никого и не сохранила бы ничего, а статическая
// приёмка была полностью зелёной — C12 честно пропускал проверку, потому что
// моста «нет», а того, что игра его изображает, не смотрел никто.
const pkgRaw = read(join(ROOT, 'package.json'))
let deps = {}
try {
  const parsed = JSON.parse(pkgRaw || '{}')
  deps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) }
} catch { deps = {} }
const bridgeDeclared = Object.keys(deps).some((name) => /playgama/i.test(name))
const indexHtml = read(join(ROOT, 'index.html')) + read(join(ROOT, 'dist', 'index.html'))
const bridgeScripted = /playgama[^"']*\.js|bridge\.js/i.test(indexHtml)
// «Изображает мост» — это собственный сервис с таким именем или обращения к
// его API. Одного слова в комментарии мало, поэтому смотрим на код.
const claimsBridge = usesBridge ||
  /BridgeService|PlaygamaService|playgama/i.test(bridgeText) ||
  existsSync(join(ROOT, 'PLAYGAMA_INTEGRATION.md'))

if (!claimsBridge) {
  skip('C13', 'Игра не заявляет интеграцию с площадкой — подключать нечего')
} else if (bridgeDeclared || bridgeScripted) {
  pass('C13', bridgeDeclared
    ? 'Мост площадки объявлен зависимостью проекта'
    : 'Мост площадки подключён скриптом в index.html')
} else {
  fail('C13',
    'Мост площадки только изображён: свой сервис есть, а @playgama/bridge не объявлен ' +
    'ни в package.json, ни скриптом в index.html — на площадке не будет ни авторизации, ' +
    'ни облачного сохранения, ни рекламы',
    scan(codeFiles, /BridgeService|PlaygamaService/).slice(0, 4))
}

/* ── C16: мост ставится из форка студии, а не из реестра npm ────────────── */
// В реестре npm лежит апстримовский Playgama Bridge. Игры студии обязаны
// собираться с форком: там настоящая авторизация VK, платежи через
// VKWebAppShowOrderBox, OK поверх VK Bridge, GameMonetize, Android, свой экран
// загрузки и интервал межстраничной в 80 секунд. Имя пакета у форка то же
// самое, поэтому C13 («мост объявлен») зелёный в обоих случаях и подмены не
// видит — отличается только источник, и смотреть надо на него.
//
// Ожидаемый адрес приносит фабрика в `.factory/bridge-source.json`: держать его
// внутри скрипта значило бы править скрипт на каждый релиз форка.
{
  let expected = null
  try {
    expected = JSON.parse(read(join(ROOT, '.factory', 'bridge-source.json')) || 'null')
  } catch { expected = null }

  if (!expected || !expected.name || !expected.source) {
    skip('C16', 'Фабрика не сказала, откуда ставить мост — проверять нечего')
  } else if (!Object.prototype.hasOwnProperty.call(deps, expected.name)) {
    // Мост не объявлен вовсе: это провал C13, и дублировать его тут незачем.
    skip('C16', `Пакет ${expected.name} в зависимостях не объявлен — см. C13`)
  } else {
    const actual = String(deps[expected.name] || '').trim()
    const remote = /^(https?:|git\+|git:|github:|file:|link:)/.test(actual)
    if (actual === expected.source) {
      pass('C16', `Мост ставится из форка студии (${expected.tag || expected.repo || 'релиз'})`)
    } else if (!remote) {
      fail('C16',
        `"${expected.name}": "${actual}" — это установка из реестра npm, то есть апстримовский ` +
        'мост. Правки форка (авторизация и платежи VK, OK через VK Bridge, GameMonetize, ' +
        'Android, свой экран загрузки) в игру не попадут. Строка обязана быть такой:\n' +
        `      "${expected.name}": "${expected.source}"`,
        [`package.json  "${expected.name}": "${actual}"`])
    } else {
      fail('C16',
        `Мост ставится не из того источника. Ожидается ${expected.tag || 'релиз форка'}:\n` +
        `      "${expected.name}": "${expected.source}"`,
        [`package.json  "${expected.name}": "${actual}"`])
    }
  }
}

/* ── C14: имена событий берутся из EVENT_NAME, а не пишутся руками ──────── */
// Живой случай: игра «Тайга: Экспедиция» подписывалась на паузу и звук так —
// `platform.on('PAUSE_STATE_CHANGED', onPause)` — со строкой, набранной вручную
// по названию константы. У Bridge v2 сами значения строчные и через
// подчёркивание ('pause_state_changed'), а тип на месте вызова был собственным
// interface с сигнатурой `(event: string, ...) => void`, поэтому опечатка
// прошла сборку не моргнув. Подписка не срабатывала никогда: игра не вставала
// на паузу под интерстишлом и не глушила звук по флагу площадки — молча, без
// единой ошибки в консоли.
const knownEventNames = [
  'PAUSE_STATE_CHANGED', 'AUDIO_STATE_CHANGED', 'REWARDED_STATE_CHANGED',
  'INTERSTITIAL_STATE_CHANGED', 'BANNER_STATE_CHANGED', 'ADVANCED_BANNERS_STATE_CHANGED',
  'ORIENTATION_STATE_CHANGED', 'SCREEN_SIZE_CHANGED', 'PLATFORM_MESSAGE_SENT',
  'PLATFORM_STORAGE_AVAILABILITY_CHANGED',
]
// `on` тоже вызывают через опциональную цепочку (`platform?.on?.(...)`), а не
// только напрямую — оба варианта обязаны попадать в проверку.
const literalEventNames = scan(codeFiles, new RegExp(`\\.on\\??\\.?\\(\\s*['"\`](${knownEventNames.join('|')})['"\`]`))
if (literalEventNames.length) {
  fail('C14',
    "Имя события подписки набрано строкой руками вместо EVENT_NAME.<...> — у Bridge v2 " +
    "реальные значения строчные с подчёркиванием ('pause_state_changed'), подписка на " +
    "литерал 'PAUSE_STATE_CHANGED' не сработает никогда, и это не всплывёт ни в консоли, ни в сборке",
    literalEventNames)
} else {
  pass('C14', 'Подписки на события платформы не используют строковый литерал вместо EVENT_NAME')
}

/* ── C15: реклама объявлена в сервисе, но реально вызывается из игры ────── */
// Тот же живой случай: `PlaygamaService.rewarded()` и `.interstitial()` были
// написаны целиком — включая правильную сигнатуру — но ни разу не вызывались
// ни из main.ts, ни из Game.ts, ни из UI. C6 это не ловил: он ищет
// `showRewarded` где угодно в коде, а сама реализация лежала в том же файле,
// что и её определение. За сессию не показывалось ни одной рекламы.
const platformDirAbs = join(SRC, 'platform')
const isInsidePlatformDir = (f) => !relative(platformDirAbs, f).startsWith('..')
const adCallSites = scan(codeFiles, /\.(showRewarded|showInterstitial)\s*\(/, isInsidePlatformDir)
const adDefined = /showRewarded|showInterstitial/.test(bridgeText)
if (!adDefined) {
  skip('C15', 'Реклама (rewarded/interstitial) в коде не найдена — проверьте, предусмотрена ли она спецификацией')
} else if (!adCallSites.length) {
  fail('C15',
    'showRewarded/showInterstitial объявлены только внутри src/platform — ни один файл геймплея ' +
    'или UI их не вызывает, реклама не триггерится за всю сессию',
    scan(codeFiles, /\.(showRewarded|showInterstitial)\s*\(/))
} else {
  pass('C15', `Реклама вызывается из игры (${adCallSites.length} место(а) вне src/platform)`)
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

/* ── G11: обе схемы управления и переключение по устройству ────────────── */
// Две готовые игры подряд уехали с одной «универсальной» раскладкой: тач-слой
// создавался безусловно, а рядом висели keydown и pointer lock. На ПК кнопки
// перехватывали мышь, на телефоне действия оставались на клавишах, которых
// там нет. Проверяем ровно это: есть ли обе схемы и решает ли устройство,
// какая из них работает.  CRITICAL_RULES §83–86.
const hasKeyboard = /addEventListener\(\s*['"`]key(down|up)['"`]/.test(codeText)
const hasTouchScheme = touchFiles.length > 0 ||
  /pointerType\s*===\s*['"`]touch['"`]|setPointerCapture/.test(codeText)
// Тип устройства спрашивают у моста; браузерные признаки допустимы только как
// запасной вариант, поэтому засчитываем их лишь вместе с обращением к мосту.
const asksDevice = /device\s*(\?\.)?\s*\.\s*type|deviceType|DEVICE_TYPE/.test(codeText)
const switchesOnDevice = asksDevice &&
  /['"`](mobile|tablet|desktop)['"`]/.test(codeText)

if (!hasKeyboard && !hasTouchScheme) {
  fail('G11', 'В коде нет ни клавиатурной, ни экранной схемы управления — играть нечем')
} else if (!hasKeyboard) {
  fail('G11', 'Есть только экранное управление: на ПК игру не во что играть — нужна схема клавиатура + мышь',
       ['CRITICAL_RULES §83 — схем управления всегда две'])
} else if (!hasTouchScheme) {
  fail('G11', 'Есть только клавиатура и мышь: на телефоне игра неуправляема — нужна экранная схема',
       ['CRITICAL_RULES §83 — схем управления всегда две'])
} else if (!switchesOnDevice) {
  fail('G11', 'Обе схемы написаны, но устройство ни разу не спрошено: активна всегда одна и та же раскладка',
       ['Режим берётся из bridge.device.type — CRITICAL_RULES §84',
        'Рецепт целиком: knowledge/ux/input_scheme_switching.md'])
} else {
  pass('G11', 'Есть обе схемы управления, режим выбирается по типу устройства')
}

/* ── G12: pointer lock не запрашивается в мобильной схеме ──────────────── */
// requestPointerLock на телефоне либо не делает ничего, либо съедает первый
// тап, а подсказка «кликните, чтобы захватить курсор» там невыполнима.
const lockFiles = codeFiles.filter((f) => /requestPointerLock/.test(read(f)))
if (!lockFiles.length) {
  skip('G12', 'Pointer lock не используется — проверять нечего')
} else {
  // Запрос обязан стоять под проверкой режима: рядом в файле должно быть
  // упоминание десктопной ветки или типа устройства.
  const guarded = lockFiles.every((f) => {
    const body = read(f)
    return /desktop|device\s*(\?\.)?\s*\.\s*type|deviceType|inputMode|isTouch|isMobile/.test(body)
  })
  guarded
    ? pass('G12', 'Pointer lock запрашивается только в десктопной схеме')
    : fail('G12', 'Pointer lock запрашивается без проверки режима — на телефоне он съедает первый тап',
           lockFiles.map((f) => relative(ROOT, f)))
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

/* ── O1: заказ пользователя закрыт ─────────────────────────────────────── */
// Раздел 0 приёмки — то, что пользователь назвал сам. Оставленный пустым, он
// означает ровно то, что уже случалось: игра сделана хорошо и не про то.
// Отказ здесь тоже допустим, но только вслух: `- [~]` и строка причины.
if (!existsSync(ACCEPTANCE)) {
  skip('O1', 'ACCEPTANCE.md отсутствует — заказ проверить негде')
} else {
  const orderSection = read(ACCEPTANCE).split(/^## 0\. /m)[1]
  if (!orderSection) {
    skip('O1', 'Пользователь не называл жанр — раздела заказа в приёмке нет')
  } else {
    const body = orderSection.split(/^## /m)[0]
    const open = body.split('\n').filter((l) => /^\s*-\s*\[\s*\]/.test(l))
    const done = (body.match(/^\s*-\s*\[[xX]\]/gm) || []).length
    const waived = (body.match(/^\s*-\s*\[~\]/gm) || []).length
    open.length
      ? fail('O1', `Заказ пользователя не закрыт: ${open.length} пункт(ов) без отметки`,
             open.slice(0, 6).map((l) => l.trim().replace(/^-\s*\[\s*\]\s*/, '')))
      : pass('O1', `Заказ пользователя закрыт: сделано ${done}, объяснённых отказов ${waived}`)
  }
}

/* ── вывод ─────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => r.ok === false)

// Отчёт на диск: по нему фабрика решает, что вернуть кодовому агенту на
// доработку. Раньше приёмка существовала только в виде текста в терминале —
// прочитать её мог человек и никто больше.
try {
  mkdirSync(join(ROOT, '.factory'), { recursive: true })
  writeFileSync(join(ROOT, '.factory', 'spec-report.json'), JSON.stringify({
    kind: 'spec',
    at: new Date().toISOString(),
    ok: failed.length === 0,
    failed: failed.map((r) => r.id),
    checks: results.map(({ id, text, ok, hits }) => ({ id, text, ok, hits: (hits || []).slice(0, 8) })),
  }, null, 2), 'utf8')
} catch (error) {
  console.error(`(отчёт .factory/spec-report.json не записан: ${error && error.message})`)
}
for (const r of results) {
  const mark = r.ok === null ? '· ' : r.ok ? '✅' : '❌'
  console.log(`${mark} ${r.id}  ${r.text}`)
  if (r.hits?.length) {
    for (const hit of r.hits.slice(0, 8)) console.log(`      ${hit}`)
    if (r.hits.length > 8) console.log(`      … ещё ${r.hits.length - 8}`)
  }
}

console.log('\nСборку, консоль, живой кадр и телефон проверяет не этот скрипт:')
console.log('  node scripts/smoke.mjs — A1, A2 и S1–S6. Зелёный check-spec без зелёного smoke ничего не значит.')
console.log('\nОстальное из ACCEPTANCE.md не проверяется машиной и остаётся человеку:')
console.log('  B7–B12 вьюпорт и экраны · C2–C4, C7–C11 площадка · D геймплей · E кадры · G8–G10 глаголы, вертикаль и мёртвые методы · G13 обе раскладки глазами')

if (failed.length) {
  console.error(`\nПровалено проверок: ${failed.length}. Игра не готова.`)
  process.exit(1)
}
console.log('\nСтатическая часть приёмки пройдена.')
"""
