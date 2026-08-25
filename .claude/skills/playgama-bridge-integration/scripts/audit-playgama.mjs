#!/usr/bin/env node
/**
 * Статический аудит интеграции Playgama Bridge.
 *
 * Ловит ровно те дефекты, которые компилируются, не падают и молчат:
 * подписку на событие строкой, `await` на методе, возвращающем void,
 * второй экземпляр сервиса, самописный интерфейс вместо типов SDK,
 * спроектированные, но не подключённые плейсменты.
 *
 *   node audit-playgama.mjs <путь-к-игре> [--json]
 *
 * Код выхода: 0 — чисто, 1 — есть нарушения, 2 — не смог прочитать проект.
 */
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, extname } from 'node:path'
import process from 'node:process'

const ROOT = resolve(process.argv[2] || '.')
const JSON_ONLY = process.argv.includes('--json')

if (!existsSync(ROOT)) {
    console.error(`Проект не найден: ${ROOT}`)
    process.exit(2)
}

// ───────────────────────────────────────────────────────── сбор исходников

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const SKIP_DIR = new Set(['node_modules', 'dist', '.git', 'qa-out', 'playgama-out', 'preview', '.vite'])

function collect(dir, extensions = SOURCE_EXT, out = []) {
    let entries
    try { entries = readdirSync(dir) } catch { return out }
    for (const entry of entries) {
        if (SKIP_DIR.has(entry)) continue
        const full = join(dir, entry)
        let info
        try { info = statSync(full) } catch { continue }
        if (info.isDirectory()) collect(full, extensions, out)
        else if (extensions.has(extname(entry))) out.push(full)
    }
    return out
}

const files = collect(ROOT).map((path) => ({
    path,
    rel: relative(ROOT, path),
    text: readFileSync(path, 'utf8'),
}))

const sources = files.filter((f) => !f.rel.startsWith('tools/') && !f.rel.startsWith('scripts/'))
const allText = sources.map((f) => f.text).join('\n')

const findings = []
const add = (severity, id, title, detail, where) => findings.push({ severity, id, title, detail, where })
const fail = (id, title, detail, where) => add('fail', id, title, detail, where)
const warn = (id, title, detail, where) => add('warn', id, title, detail, where)

/** Позиция совпадения в виде `файл:строка`. */
function locate(file, index) {
    return `${file.rel}:${file.text.slice(0, index).split('\n').length}`
}

/** Все совпадения регулярки по всем исходникам. */
function scan(regex) {
    const hits = []
    for (const file of sources) {
        const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`)
        let match
        while ((match = re.exec(file.text)) !== null) {
            hits.push({ file, index: match.index, match, where: locate(file, match.index) })
        }
    }
    return hits
}

const usesBridge = /@playgama\/bridge|playgama-bridge|window\.bridge|playgamaBridge/.test(allText)
    || existsSync(join(ROOT, 'package.json')) && /playgama/.test(readFileSync(join(ROOT, 'package.json'), 'utf8'))

if (!usesBridge) {
    console.log('Playgama Bridge в проекте не используется — аудит пропущен.')
    process.exit(0)
}

// ───────────────────────────────────────────── 1. события подписаны строкой

const EVENT_MEMBERS = [
    'PAUSE_STATE_CHANGED', 'AUDIO_STATE_CHANGED', 'REWARDED_STATE_CHANGED',
    'INTERSTITIAL_STATE_CHANGED', 'BANNER_STATE_CHANGED', 'ADVANCED_BANNERS_STATE_CHANGED',
    'ORIENTATION_STATE_CHANGED', 'SCREEN_SIZE_CHANGED', 'VISIBILITY_STATE_CHANGED',
    'PLATFORM_MESSAGE_SENT', 'STORAGE_SET',
]
for (const hit of scan(new RegExp(`\\.(?:on|off|once|addListener)\\s*\\?\\.?\\s*\\(\\s*['"\`](${EVENT_MEMBERS.join('|')})['"\`]`))) {
    fail('EVENT_NAME_LITERAL',
        'Событие подписано строкой с именем константы',
        `'${hit.match[1]}' — это имя члена EVENT_NAME, а его значение '${hit.match[1].toLowerCase()}'. `
        + 'Подписка молча не сработает. Импортируй EVENT_NAME из @playgama/bridge и передай константу.',
        hit.where)
}

// Значение верное, но написано строкой: работает, но ломается при смене версии SDK.
for (const hit of scan(new RegExp(`\\.(?:on|off|once)\\s*\\?\\.?\\s*\\(\\s*['"\`](${EVENT_MEMBERS.map((m) => m.toLowerCase()).join('|')})['"\`]`))) {
    warn('EVENT_NAME_RAW_VALUE',
        'Событие подписано строковым значением вместо константы',
        'Значение верное, но привязка к литералу переживёт не всякое обновление SDK. Используй EVENT_NAME.',
        hit.where)
}

// ───────────────────────────────────────────── 2. await на void-методах

const VOID_AD_METHODS = ['showRewarded', 'showInterstitial', 'showBanner', 'hideBanner',
    'showAdvancedBanners', 'hideAdvancedBanners', 'preloadRewarded', 'preloadInterstitial']
for (const hit of scan(new RegExp(`await\\s+[\\w$.?()\\[\\]]*\\b(${VOID_AD_METHODS.join('|')})\\s*\\(`))) {
    fail('AWAIT_VOID_AD',
        `await на ${hit.match[1]}() — метод возвращает void`,
        'await undefined завершается мгновенно. Для rewarded это значит выдачу награды без просмотра рекламы. '
        + 'Исход берётся из EVENT_NAME.REWARDED_STATE_CHANGED / INTERSTITIAL_STATE_CHANGED.',
        hit.where)
}
// Тот же дефект через сохранённую ссылку: `const show = ad.showRewarded; await show(...)`
for (const hit of scan(/(?:const|let|var)\s+(\w+)\s*=\s*[^;=\n]*?\.\s*(showRewarded|showInterstitial)\b\s*(?![(.])/)) {
    const name = hit.match[1]
    if (new RegExp(`await\\s+${name}\\s*\\(`).test(hit.file.text)) {
        fail('AWAIT_VOID_AD_ALIAS',
            `await на псевдониме ${hit.match[2]}()`,
            `Метод сохранён в '${name}' и ожидается через await. Возвращаемого промиса нет — исход берётся из события.`,
            hit.where)
    }
}

// ───────────────────────────────────────────── 3. награда без проверки состояния

const grantsRewardFromPromise = scan(/showRewarded\s*\(/).length > 0
    && !/REWARDED_STATE_CHANGED/.test(allText)
if (grantsRewardFromPromise) {
    fail('REWARD_WITHOUT_STATE',
        'Rewarded вызывается, но REWARDED_STATE_CHANGED нигде не слушается',
        'Награду нечем подтвердить: единственный источник истины — состояние rewarded. '
        + 'Игрок получит награду, не увидев рекламы.',
        'проект целиком')
}
if (/REWARDED_STATE_CHANGED/.test(allText) && !/['"`]rewarded['"`]|REWARDED_STATE\.REWARDED/.test(allText)) {
    fail('REWARD_STATE_NOT_CHECKED',
        'Подписка на REWARDED_STATE_CHANGED есть, но состояние rewarded не проверяется',
        'Награда должна выдаваться только при state === REWARDED_STATE.REWARDED, не на opened/closed.',
        'проект целиком')
}

// ───────────────────────────────────────────── 4. самописные типы моста

for (const hit of scan(/\b(?:interface|type)\s+(\w*(?:Bridge|Platform|Advertisement|PlaygamaSDK)\w*)\s*[={]/)) {
    const name = hit.match[1]
    if (/^(?:PlatformBridgeContract|BridgeCapabilities)$/.test(name)) continue
    warn('HANDROLLED_BRIDGE_TYPE',
        `Самописный тип моста: ${name}`,
        'Собственный интерфейс с `event: string` и `show*(): Promise<void>` описывает мост неверно и прячет '
        + 'обе главные ловушки от компилятора. Импортируй типы из @playgama/bridge.',
        hit.where)
}
for (const hit of scan(/(?:on|off)\s*\?\s*:\s*\(\s*\w+\s*:\s*string/)) {
    fail('EVENT_PARAM_IS_STRING',
        'Подписка объявлена как (event: string)',
        'Такой тип принимает любую строку и пропускает опечатку в имени события. Тип события — EventName из SDK.',
        hit.where)
}
for (const hit of scan(new RegExp(`(${VOID_AD_METHODS.join('|')})\\s*\\??\\s*:\\s*\\([^)]*\\)\\s*=>\\s*Promise`))) {
    fail('VOID_METHOD_TYPED_AS_PROMISE',
        `${hit.match[1]} объявлен как возвращающий Promise`,
        'В реальном SDK метод синхронный и возвращает void. Ложное объявление и есть причина «награды без рекламы».',
        hit.where)
}

// ───────────────────────────────────────────── 5. API из v1

const V1 = [
    [/bridge\s*\.\s*game\s*\.\s*setLoadingProgress/, 'bridge.game.setLoadingProgress', 'в v2 это bridge.setGameLoadingProgress()'],
    [/bridge\s*\.\s*game\s*\.\s*on\s*\(/, 'bridge.game.on', 'в v2 события живут на bridge.platform / bridge.advertisement'],
    [/\bleaderboard\s*\.\s*(?:setScore|getEntries|showNativePopup)/, 'bridge.leaderboard', 'в v2 множественное число: bridge.leaderboards'],
    [/storage\s*\.\s*(?:get|set)\s*\([^)]*StorageType/, 'storage.get/set со StorageType', 'в v2 аргумента типа хранилища нет'],
    [/consumePurchase\s*\(\s*\w*(?:[Tt]oken)/, 'consumePurchase(token)', 'в v2 передаётся productId, не токен покупки'],
]
for (const [regex, name, hint] of V1) {
    for (const hit of scan(regex)) fail('V1_API', `API первой версии: ${name}`, hint, hit.where)
}

// ───────────────────────────────────────────── 6. синглтон и game_ready

const serviceClass = /class\s+(\w*(?:Bridge|Playgama)\w*Service)\b/.exec(allText)?.[1]
if (serviceClass) {
    const instantiations = scan(new RegExp(`new\\s+${serviceClass}\\s*\\(`))
    if (instantiations.length > 1) {
        fail('MULTIPLE_SERVICE_INSTANCES',
            `${serviceClass} создаётся ${instantiations.length} раз`,
            'Каждый экземпляр — свой флаг readySent, свой дебаунсер сохранения и своя подписка на pagehide. '
            + 'Итог: дублирующийся game_ready и потерянный прогресс. Нужен один модульный синглтон.',
            instantiations.map((h) => h.where).join(', '))
    }
}

const readySites = scan(/\b(?:sendReady|signalReady|gameReady)\s*\(/)
    .concat(scan(/sendMessage\s*\(\s*(?:PLATFORM_MESSAGE\.GAME_READY|['"`]game_ready['"`])/))
if (readySites.length === 0) {
    fail('NO_GAME_READY',
        'game_ready не отправляется нигде',
        'Без него сплэш площадки не уходит — отказ Яндекса по п. 1.19.',
        'проект целиком')
}
if (!/readySent|_gameReadySent|isReady|hasSentReady/.test(allText) && readySites.length > 0) {
    warn('NO_READY_GUARD',
        'Нет флага «game_ready уже отправлен»',
        'Сторожевой таймер или повторный бутстрап отправят его второй раз.',
        'проект целиком')
}

// ───────────────────────────────────────────── 7. прогресс и таймаут инициализации

if (!/setGameLoadingProgress/.test(allText)) {
    fail('NO_PROGRESS',
        'Прогресс загрузки не сообщается',
        'Мост сам вызовет setProgress(100) через 700 мс после initialize() — то есть до того, как игра загрузится. '
        + 'На закэшированной перезагрузке это видно как «оверлей исчез → пустой экран → меню».',
        'проект целиком')
}
if (/bridge\s*\.\s*initialize\s*\(/.test(allText) && !/Promise\s*\.\s*race/.test(allText)) {
    fail('INIT_WITHOUT_TIMEOUT',
        'bridge.initialize() без таймаута',
        'Если sdk.js заблокирован блокировщиком рекламы или недоступен CDN, необёрнутый await — вечный чёрный экран. '
        + 'Оберни в Promise.race с таймаутом 10 с.',
        'проект целиком')
}

// ───────────────────────────────────────────── 8. жизненный цикл

if (!/PAUSE_STATE_CHANGED/.test(allText)) {
    fail('NO_PAUSE_SUBSCRIPTION',
        'Нет подписки на PAUSE_STATE_CHANGED',
        'visibilitychange не сообщает об открывшемся межстраничном ролике: игра продолжит идти под рекламой '
        + '— отказ Яндекса по п. 4.7.',
        'проект целиком')
}
if (!/AUDIO_STATE_CHANGED/.test(allText)) {
    fail('NO_AUDIO_SUBSCRIPTION',
        'Нет подписки на AUDIO_STATE_CHANGED',
        'Площадка глушит игру своим флагом; без подписки звук продолжит играть — п. 1.3 и 4.7.',
        'проект целиком')
}
if (!/GAMEPLAY_STARTED|gameplay_started/.test(allText)) {
    warn('NO_GAMEPLAY_MARKERS',
        'Нет разметки gameplay_started / gameplay_stopped',
        'На Яндексе это GameplayAPI.start/stop — площадка не знает, когда показывать свою рекламу.',
        'проект целиком')
}

// ───────────────────────────────────────────── 9. язык

if (!/platform\s*\.\s*language|resolveLanguage/.test(allText)) {
    fail('NO_LANGUAGE_DETECTION',
        'Язык не берётся из bridge.platform.language',
        'Требование Яндекса 2.14: язык определяется автоматически из SDK. Хардкод — отказ модерации.',
        'проект целиком')
} else {
    // Яндекс всегда добавляет &lang= в URL: если URL проверяется раньше SDK, чтение SDK становится мёртвым кодом.
    const langFile = sources.find((f) => /platform\s*\.\s*language/.test(f.text))
    if (langFile) {
        const sdkAt = langFile.text.search(/platform\s*\.\s*language/)
        const urlAt = langFile.text.search(/searchParams\s*\.\s*get\s*\(\s*['"`]lang/)
        if (urlAt !== -1 && urlAt < sdkAt) {
            warn('URL_LANG_BEFORE_SDK',
                'URL-параметр lang проверяется раньше bridge.platform.language',
                'Яндекс всегда добавляет &lang= в адрес, поэтому ветка SDK никогда не выполнится.',
                locate(langFile, urlAt))
        }
    }
}

// ───────────────────────────────────────────── 10. UI без проверки поддержки

const gatedFlags = ['isRewardedSupported', 'isInterstitialSupported', 'isBannerSupported',
    'isAuthorizationSupported']
for (const [flag, method] of [['isRewardedSupported', 'showRewarded'], ['isInterstitialSupported', 'showInterstitial'], ['isBannerSupported', 'showBanner']]) {
    if (new RegExp(`\\b${method}\\s*\\(`).test(allText) && !new RegExp(`\\b${flag}|capabilities`).test(allText)) {
        fail('UNGATED_AD_UI',
            `${method}() вызывается без проверки ${flag}`,
            'На площадке без этой рекламы кнопка выглядит сломанной. Каждый элемент гейтится флагом поддержки.',
            'проект целиком')
    }
}
void gatedFlags

// ───────────────────────────────────────────── 11. хранилище

// Доступ к хранилищу может идти и через обёртку: `this.activeBridge().storage?.set(...)`.
const usesCloudStorage = /\bstorage\s*(?:\?\.|\.)\s*(?:get|set|delete)\s*(?:\?\.|)\s*\(/.test(allText)
if (usesCloudStorage) {
    if (!/pagehide/.test(allText)) {
        warn('NO_SAVE_FLUSH',
            'Нет флаша сохранения на pagehide',
            'Дебаунс без флаша теряет последние секунды прогресса при закрытии вкладки.',
            'проект целиком')
    }
    const keys = new Set(scan(/storage\s*(?:\?\.|\.)\s*(?:set|get)\s*(?:\?\.|)\s*\(\s*['"`]([\w.-]+)['"`]/).map((h) => h.match[1]))
    if (keys.size > 3) {
        warn('TOO_MANY_SAVE_KEYS',
            `Сохранение размазано по ${keys.size} ключам`,
            `Один ключ — один JSON-объект. Найдено: ${[...keys].join(', ')}.`,
            'проект целиком')
    }
} else {
    fail('NO_CLOUD_SAVE',
        'Облачное сохранение не используется',
        'Требование Яндекса 1.9: прогресс сохраняется. localStorage внутри iframe площадки — '
        + 'секционированное сторонее хранилище, на него полагаться нельзя.',
        'проект целиком')
}

// ───────────────────────────────────────────── 12. спроектированное, но не подключённое

const designDocs = ['MONETIZATION.md', 'PLAYGAMA_INTEGRATION.md', 'GAME_DATA.yaml']
    .map((name) => join(ROOT, name))
    .filter((path) => existsSync(path))
    .map((path) => ({ name: relative(ROOT, path), text: readFileSync(path, 'utf8') }))

/** Явно снятый товар/плейсмент: документ сам говорит, что его нет в игре. */
const REMOVAL_MARKER = /снят|снята|снято|убран|убрана|removed|deprecated|не прода|отсутствует|вернуть, когда/i

const declaredPlacements = new Set()
for (const doc of designDocs) {
    const lines = doc.text.split('\n')
    for (const match of doc.text.matchAll(/`([a-z][a-z0-9]*(?:_[a-z0-9]+){1,4})`/g)) {
        const id = match[1]
        // Ключи сохранения и настройки — не плейсменты.
        if (/^(?:player_|settings_|leaderboard_|high_score|selected_|unlocked_|truck_upgrades)/.test(id)) continue
        // Абзац, в котором стоит упоминание: снятое из витрины не считается
        // неподключённым — документ уже объяснил, почему кода нет.
        const lineIndex = doc.text.slice(0, match.index).split('\n').length - 1
        const around = lines.slice(Math.max(0, lineIndex - 3), lineIndex + 4).join('\n')
        if (REMOVAL_MARKER.test(around)) continue
        declaredPlacements.add(id)
    }
}
const missingPlacements = [...declaredPlacements].filter((id) => !allText.includes(id))
if (declaredPlacements.size > 0 && missingPlacements.length > 0) {
    fail('PLACEMENTS_NOT_WIRED',
        `Плейсменты описаны в документах, но не встречаются в коде: ${missingPlacements.length}`,
        `${missingPlacements.join(', ')}. Спроектированная монетизация, которой нет в коде, — это дефект, `
        + 'а не «не входило в задачу». Подключи либо убери из документа.',
        designDocs.map((d) => d.name).join(', '))
}

// ───────────────────────────────────────────── 13. защита страницы (пп. 1.6.2.7 / 1.10.2)

const cssFiles = collect(ROOT, new Set(['.css'])).map((p) => readFileSync(p, 'utf8'))
const htmlFiles = collect(ROOT, new Set(['.html'])).map((p) => readFileSync(p, 'utf8'))
const indexHtml = existsSync(join(ROOT, 'index.html')) ? readFileSync(join(ROOT, 'index.html'), 'utf8') : ''
// Правило может стоять и в CSS, и в инлайновом стиле разметки, и выставляться из кода.
const styleText = [...cssFiles, ...htmlFiles, allText].join('\n')

const styleRules = [
    [/overscroll-behavior\s*:\s*(?:none|contain)/, 'overscroll-behavior', '1.10.2 — swipe-to-refresh и bounce'],
    [/user-select\s*:\s*none/, 'user-select: none', '1.6.2.7 — выделение текста'],
    [/-webkit-touch-callout\s*:\s*none/, '-webkit-touch-callout: none', '1.6.2.7 — меню по долгому тапу на iOS'],
    [/overflow\s*:\s*hidden/, 'overflow: hidden', '1.10.2 — прокрутка страницы'],
    [/touch-action\s*:\s*(?:none|manipulation)/, 'touch-action', 'жесты браузера поверх игры'],
]
for (const [regex, name, why] of styleRules) {
    if (!regex.test(styleText)) {
        fail('MISSING_PAGE_GUARD_CSS',
            `В CSS игры нет ${name}`,
            `${why}. Мост ставит это сам, но только после initialize() и внутри своего бандла — `
            + 'до инициализации страница беззащитна, а статический анализ чекера туда не заглядывает.',
            'CSS игры')
    }
}
if (!/contextmenu/.test(allText + indexHtml)) {
    fail('NO_CONTEXTMENU_GUARD',
        'Контекстное меню не блокируется в коде игры',
        'Требование 1.6.2.7. Мост блокирует его сам, но чекер модерации этого не видит.',
        'проект целиком')
}
if (!/viewport-fit\s*=\s*cover/.test(indexHtml)) {
    warn('NO_VIEWPORT_FIT',
        'В meta viewport нет viewport-fit=cover',
        'Требование 1.6.1.1: игра занимает весь экран на мобильном.',
        'index.html')
}

// ───────────────────────────────────────────── 14. запрещённое

for (const [regex, id, title] of [
    [/(?<![.\w])alert\s*\(/, 'ALERT', 'alert() запрещён модерацией'],
    [/(?<![.\w])confirm\s*\(/, 'CONFIRM', 'confirm() запрещён модерацией'],
    [/(?<![.\w])prompt\s*\(/, 'PROMPT', 'prompt() запрещён модерацией'],
    [/document\s*\.\s*write\s*\(/, 'DOCUMENT_WRITE', 'document.write() запрещён'],
    [/https?:\/\/[^\s'"`]*(?:storage\.yandexcloud|s3\.amazonaws)/, 'ABSOLUTE_ASSET_URL', 'Требование 1.7: только относительные пути'],
    [/location\s*\.\s*(?:host|href)\s*(?:===?|!==?)\s*['"`]/, 'DOMAIN_GATING', 'Требование 1.18: нет привязки к домену'],
]) {
    for (const hit of scan(regex)) fail(id, title, 'Убрать из релизной сборки.', hit.where)
}

// Управление по e.key ломается в русской раскладке: 'w' там 'ц'.
for (const hit of scan(/\.\s*key\s*===?\s*['"`][a-zA-Z]['"`]/)) {
    warn('KEY_INSTEAD_OF_CODE',
        'Управление читает e.key вместо e.code',
        'В русской раскладке e.key для клавиши W — «ц», управление отваливается. Используй e.code === "KeyW".',
        hit.where)
}

// ───────────────────────────────────────────────────────── отчёт

const failures = findings.filter((f) => f.severity === 'fail')
const warnings = findings.filter((f) => f.severity === 'warn')
const report = {
    root: ROOT,
    checkedFiles: sources.length,
    fail: failures.length,
    warn: warnings.length,
    findings,
}

const outDir = join(ROOT, 'playgama-out')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'audit.json'), JSON.stringify(report, null, 2))

if (JSON_ONLY) {
    console.log(JSON.stringify(report, null, 2))
} else {
    const icon = { fail: '✗', warn: '!' }
    console.log(`\nСтатический аудит Playgama — ${relative(process.cwd(), ROOT) || '.'}`)
    console.log(`Просмотрено файлов: ${sources.length}\n`)
    for (const f of [...failures, ...warnings]) {
        console.log(`${icon[f.severity]} [${f.id}] ${f.title}`)
        console.log(`    ${f.detail}`)
        console.log(`    → ${f.where}\n`)
    }
    console.log(failures.length === 0 && warnings.length === 0
        ? '✓ Нарушений не найдено.'
        : `Итого: ${failures.length} нарушений, ${warnings.length} предупреждений.`)
    console.log(`Отчёт: ${join(relative(process.cwd(), ROOT) || '.', 'playgama-out', 'audit.json')}\n`)
}

process.exit(failures.length > 0 ? 1 : 0)
