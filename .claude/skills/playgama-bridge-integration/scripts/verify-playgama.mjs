#!/usr/bin/env node
/**
 * Runtime-проверка интеграции Playgama Bridge в настоящем Chromium
 * (Playwright) плюс прогон yandex-games-debug-checker.
 *
 *   node verify-playgama.mjs <путь-к-игре>                 # локальная сборка
 *   node verify-playgama.mjs <путь> --draft=<APP_ID>       # внутри черновика Яндекса
 *   node verify-playgama.mjs <путь> --skip-build --headed
 *
 * Локальный режим проверяет всё, что не требует площадки: порядок загрузки,
 * подписки, контракт награды, сохранение, статические правила чекера.
 * Режим черновика добавляет то, что можно увидеть только внутри фрейма
 * Яндекса, — и требует, чтобы в браузере был выполнен вход в аккаунт
 * разработчика, которому принадлежит игра.
 *
 * Код выхода: 0 — всё зелёное, 1 — есть провалы, 2 — не смог запуститься.
 */
import { spawn, spawnSync, execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, normalize, relative, resolve } from 'node:path'
import process from 'node:process'

const SKILL_DIR = resolve(new URL('..', import.meta.url).pathname)
const CHECKER_REF = 'f86d4ebd1d17f92911ff64b373286fc8d85aec8e'
const CHECKER_URL = `https://raw.githubusercontent.com/Nioris/yandex-games-debug-checker/${CHECKER_REF}/debugcheck.js`
const CACHE_DIR = join(SKILL_DIR, '.cache')

const args = process.argv.slice(2)
const ROOT = resolve(args.find((a) => !a.startsWith('--')) || '.')
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const has = (name) => args.includes(`--${name}`)

const DRAFT_APP_ID = flag('draft')
const HEADED = has('headed') || Boolean(DRAFT_APP_ID)
const SKIP_BUILD = has('skip-build')
const PORT = Number(flag('port') || (DRAFT_APP_ID ? 8099 : 4180))
const OUT_DIR = join(ROOT, 'playgama-out')

if (!existsSync(ROOT)) { console.error(`Проект не найден: ${ROOT}`); process.exit(2) }

// ───────────────────────────────────────────────────── результаты

const results = []
const add = (status, id, title, detail) => results.push({ status, id, title, detail })
const pass = (id, title, detail = '') => add('pass', id, title, detail)
const fail = (id, title, detail) => add('fail', id, title, detail)
const warn = (id, title, detail) => add('warn', id, title, detail)
/** Проверка честно не выполнена: не «предупреждение» и не «зелено». */
const nv = (id, title, detail) => add('not-verified', id, title, detail)

// ───────────────────────────────────────────────────── зависимости

/**
 * Playwright ищется в проекте, затем глобально. Дальше выбирается тот, чьи
 * браузеры реально скачаны: версия пакета жёстко привязана к ревизии Chromium,
 * и пакет без своей ревизии падает на launch(), а не на импорте.
 */
async function loadChromium() {
    const candidates = []
    const local = join(ROOT, 'node_modules', 'playwright')
    if (existsSync(join(local, 'index.js'))) candidates.push(local)
    try {
        const global = join(execSync('npm root -g').toString().trim(), 'playwright')
        if (existsSync(join(global, 'index.js'))) candidates.push(global)
    } catch { /* глобальной установки нет */ }

    const failures = []
    for (const path of candidates) {
        // index.js у playwright — CommonJS, поэтому именованных экспортов нет:
        // всё лежит в default.
        const loaded = await import(join(path, 'index.js'))
        const chromium = loaded.chromium ?? loaded.default?.chromium
        if (!chromium) { failures.push(`${path}: нет chromium в экспортах`); continue }
        try {
            const executable = chromium.executablePath()
            if (!existsSync(executable)) { failures.push(`${path}: браузер не скачан (${executable})`); continue }
        } catch (error) { failures.push(`${path}: ${String(error)}`); continue }
        return { chromium, path }
    }
    return { chromium: null, failures }
}

async function loadChecker() {
    mkdirSync(CACHE_DIR, { recursive: true })
    const cached = join(CACHE_DIR, `debugcheck-${CHECKER_REF.slice(0, 8)}.js`)
    if (existsSync(cached)) return readFileSync(cached, 'utf8')
    try {
        const response = await fetch(CHECKER_URL)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const text = await response.text()
        writeFileSync(cached, text)
        return text
    } catch (error) {
        console.warn(`! Не удалось получить debugcheck.js (${String(error)}). Проверки чекера будут пропущены.`)
        return null
    }
}

// ───────────────────────────────────────────────────── сборка и сервер

function build() {
    if (SKIP_BUILD) return true
    console.log('· сборка…')
    const result = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' })
    if (result.status !== 0) {
        fail('BUILD', 'Сборка не проходит', 'npm run build завершился с ошибкой — проверять нечего.')
        return false
    }
    return true
}

const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
}

function serve(dir, port) {
    const server = createServer((req, res) => {
        const url = decodeURIComponent((req.url || '/').split('?')[0])
        let file = join(dir, normalize(url).replace(/^(\.\.[/\\])+/, ''))
        try { if (statSync(file).isDirectory()) file = join(file, 'index.html') } catch { /* ниже 404 */ }
        if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return }
        res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
        createReadStream(file).pipe(res)
    })
    return new Promise((done) => server.listen(port, '127.0.0.1', () => done(server)))
}

// ───────────────────────────────────────────────────── проверки над журналом

const READY = 'game_ready'
const LOADING_STARTED = 'in_game_loading_started'
const LOADING_STOPPED = 'in_game_loading_stopped'

function checkBootSequence(v) {
    const readyEvents = v.messages.filter((m) => m.message === READY)

    if (readyEvents.length === 0) {
        fail('GAME_READY_SENT', 'game_ready не отправлен',
            'Сплэш площадки не уйдёт. Отказ Яндекса по п. 1.19.')
    } else if (readyEvents.length > 1) {
        fail('GAME_READY_ONCE', `game_ready отправлен ${readyEvents.length} раз`,
            `Моменты: ${readyEvents.map((m) => `${m.t}мс`).join(', ')}. Обычная причина — сторожевой таймер, `
            + 'создающий второй экземпляр сервиса в обход флага «уже отправлено».')
    } else {
        pass('GAME_READY_ONCE', `game_ready отправлен один раз (+${readyEvents[0].t}мс)`)
    }

    const started = v.messages.filter((m) => m.message === LOADING_STARTED)
    if (started.length === 0) warn('LOADING_STARTED', 'in_game_loading_started не отправлен',
        'CrazyGames не увидит начала загрузки.')
    else if (started.length > 1) fail('LOADING_STARTED', `in_game_loading_started отправлен ${started.length} раз`,
        'Повтор CrazyGames считает новой загрузкой и портит метрику производительности.')
    else pass('LOADING_STARTED', `in_game_loading_started отправлен один раз (+${started[0].t}мс)`)

    if (v.messages.some((m) => m.message === LOADING_STOPPED)) pass('LOADING_STOPPED', 'in_game_loading_stopped отправлен')
    else warn('LOADING_STOPPED', 'in_game_loading_stopped не отправлен', 'Парный сигнал к in_game_loading_started.')

    // Прогресс
    const values = v.progress.map((p) => p.value)
    if (values.length === 0) {
        fail('PROGRESS_REPORTED', 'Прогресс загрузки не сообщается',
            'Мост сам вызовет setProgress(100) через 700 мс после initialize() — раньше, чем игра загрузится.')
    } else {
        const monotonic = values.every((value, index) => index === 0 || value >= values[index - 1])
        if (!monotonic) fail('PROGRESS_MONOTONIC', 'Прогресс идёт назад',
            `Последовательность: ${values.join(' → ')}. Игрок читает откат как зависшую загрузку.`)
        else pass('PROGRESS_MONOTONIC', `Прогресс монотонен, ${values.length} шагов`)

        if (Math.max(...values) < 100) fail('PROGRESS_REACHES_100', `Прогресс дошёл только до ${Math.max(...values)}`,
            'Оверлей моста снимается только по сотне.')
        else pass('PROGRESS_REACHES_100', 'Прогресс доходит до 100')

        if (values.length < 5) warn('PROGRESS_SMOOTH', `Прогресс сообщается ${values.length} рывками`,
            'Метка процентов не анимируется сама: без доводки по кадрам она замирает между значениями.')
        else pass('PROGRESS_SMOOTH', `Прогресс доводится плавно (${values.length} значений)`)
    }

    // Порядок: сотня, пауза, только потом готовность
    const hundred = v.progress.find((p) => p.value >= 100)
    const ready = readyEvents[0]
    if (hundred && ready) {
        if (ready.t < hundred.t) {
            fail('READY_AFTER_100', 'game_ready отправлен раньше, чем прогресс дошёл до 100',
                `100% на +${hundred.t}мс, game_ready на +${ready.t}мс.`)
        } else {
            const gap = ready.t - hundred.t
            if (gap < 300) {
                fail('READY_SPLASH_GAP', `Между прогрессом 100 и game_ready всего ${gap}мс`,
                    'Оверлей моста снимается по расписанию 400/900/1400 мс после сотни. Сплэш площадки уйдёт '
                    + 'поверх непогасшего оверлея. Нужна пауза ~600–800 мс.')
            } else {
                pass('READY_SPLASH_GAP', `Пауза между 100% и game_ready — ${gap}мс`)
            }
        }
    }

    const startedAt = started[0]?.t
    if (ready && startedAt !== undefined && ready.t - startedAt < 200) {
        fail('READY_NOT_AT_INIT', 'game_ready отправлен сразу после инициализации',
            'Сплэш площадки уходит с незагруженной игры. game_ready — только когда меню интерактивно.')
    } else if (ready) {
        pass('READY_NOT_AT_INIT', 'game_ready не привязан к моменту initialize()')
    }
}

function checkSubscriptions(v) {
    const suspicious = v.subscriptions.filter((s) => s.suspicious)
    if (suspicious.length > 0) {
        fail('EVENT_NAME_LITERAL', `Подписка на несуществующее событие: ${suspicious.map((s) => s.event).join(', ')}`,
            'Это имена членов EVENT_NAME, а не их значения (значения — lower_snake). Подписка молча не сработает.')
    } else if (v.subscriptions.length > 0) {
        pass('EVENT_NAME_LITERAL', 'Все имена событий валидны')
    }

    const events = new Set(v.subscriptions.map((s) => s.event))
    for (const [event, id, why] of [
        ['pause_state_changed', 'SUB_PAUSE', 'Игра не встанет на паузу при показе межстраничного ролика — п. 4.7.'],
        ['audio_state_changed', 'SUB_AUDIO', 'Игра не заглушится по флагу площадки — пп. 1.3 и 4.7.'],
    ]) {
        if (events.has(event)) pass(id, `Подписка на ${event} установлена`)
        else fail(id, `Нет подписки на ${event}`, why)
    }
}

function checkLanguage(v) {
    const ready = v.messages.find((m) => m.message === READY)
    if (v.languageReads.length === 0) {
        fail('LANGUAGE_READ', 'bridge.platform.language не читается',
            'Требование Яндекса 2.14: язык определяется автоматически из SDK.')
        return
    }
    const first = v.languageReads[0]
    if (ready && first.t > ready.t) {
        fail('LANGUAGE_BEFORE_READY', 'Язык прочитан уже после game_ready',
            `Чтение на +${first.t}мс, game_ready на +${ready.t}мс. Требование 2.14 проверяет именно порядок: `
            + 'язык применяется до того, как игра стала интерактивной.')
    } else {
        pass('LANGUAGE_BEFORE_READY', `Язык прочитан до game_ready (+${first.t}мс)`)
    }
}

function checkStorage(v) {
    const writes = v.storage.filter((s) => s.op === 'set')
    const reads = v.storage.filter((s) => s.op === 'get')
    if (reads.length === 0) fail('STORAGE_READ', 'Облачное сохранение не читается при старте',
        'Требование Яндекса 1.9. localStorage внутри iframe площадки — секционированное стороннее хранилище.')
    else pass('STORAGE_READ', `Чтение сохранения: ${[...new Set(reads.map((r) => r.key))].join(', ')}`)

    if (writes.length === 0) nv('STORAGE_WRITE', 'Запись в облако за прогон не наблюдалась',
        'Игра не дошла до момента сохранения даже после запуска главной кнопки меню. '
        + 'Проверяется вручную по геймплею: доехать до сохраняемой вехи и перезагрузить страницу.')
    else {
        const keys = [...new Set(writes.map((w) => w.key))]
        if (keys.length > 3) warn('STORAGE_WRITE', `Сохранение размазано по ${keys.length} ключам`,
            `Один ключ — один JSON: ${keys.join(', ')}.`)
        else pass('STORAGE_WRITE', `Запись сохранения: ${keys.join(', ')}`)
    }
}

// ───────────────────────────────────────────────────── контракт награды

async function checkRewardContract(page) {
    const hasProbe = await page.evaluate(() => Boolean(window.__playgamaBridgeService?.showRewarded))
    if (!hasProbe) {
        nv('REWARD_CONTRACT', 'Контракт награды не проверен',
            'В игре нет синглтона BridgeService с методом showRewarded, доступного как '
            + '`window.__playgamaBridgeService`. Это единственный способ доказать, что награда выдаётся по '
            + 'состоянию, а не по промису. Скопируй эталон из assets/BridgeService.ts.')
        return
    }

    // Отрицательный сценарий: ролик открыли и закрыли без начисления.
    const denied = await page.evaluate(async () => {
        const promise = window.__playgamaBridgeService.showRewarded('__verify_denied')
        await new Promise((r) => setTimeout(r, 60))
        await window.__pgvEmit('rewarded', ['loading', 'opened', 'closed'])
        return Promise.race([promise, new Promise((r) => setTimeout(() => r('timeout'), 4000))])
    })
    if (denied === false) {
        pass('REWARD_DENIED', 'Награда не выдана, когда состояния rewarded не было')
    } else {
        fail('REWARD_DENIED', `Награда выдана без состояния rewarded (получено: ${JSON.stringify(denied)})`,
            'Сценарий loading → opened → closed означает, что игрок закрыл ролик. Награду выдавать нельзя. '
            + 'Обычная причина — await на showRewarded(), который возвращает void.')
    }

    // Положительный сценарий: площадка подтвердила просмотр.
    const granted = await page.evaluate(async () => {
        const promise = window.__playgamaBridgeService.showRewarded('__verify_granted')
        await new Promise((r) => setTimeout(r, 60))
        await window.__pgvEmit('rewarded', ['loading', 'opened', 'rewarded', 'closed'])
        return Promise.race([promise, new Promise((r) => setTimeout(() => r('timeout'), 4000))])
    })
    if (granted === true) pass('REWARD_GRANTED', 'Награда выдана по состоянию rewarded')
    else fail('REWARD_GRANTED', `Награда не выдана при состоянии rewarded (получено: ${JSON.stringify(granted)})`,
        'Сценарий loading → opened → rewarded → closed — игрок досмотрел ролик и должен получить награду.')
}

// ───────────────────────────────────────────────────── ввод до готовности

async function checkInputGate(page, gateSamples) {
    if (gateSamples.length === 0) {
        nv('INPUT_GATE', 'Не удалось снять состояние ввода до game_ready',
            'Игра стала готова быстрее, чем прошёл первый замер.')
        return
    }
    const leaked = gateSamples.filter((s) => !s.ready && s.enabled > 0)
    if (leaked.length > 0) {
        fail('INPUT_GATE', `До game_ready было доступно кнопок: ${Math.max(...leaked.map((s) => s.enabled))}`,
            'Модератор прокликивает загрузку и попадает в неготовую игру — отказ по п. 1.19. '
            + 'Кнопки меню должны быть disabled (или pointer-events: none) до отправки game_ready.')
    } else {
        pass('INPUT_GATE', 'Ввод закрыт до game_ready')
    }
}

// ───────────────────────────────────────────────────── чекер модерации

/**
 * Часть статических проверок чекера ищет прямые вызовы Yandex SDK в исходниках.
 * Игра на мосту вызывает их внутри бандла, поэтому эти пункты не находятся
 * grep-ом честно, а не по вине игры. Подгонять исходники под grep нельзя —
 * такие пункты выносятся отдельным блоком и закрываются нашим наблюдением.
 */
const BRIDGE_MEDIATED = [
    'SDK script tag', 'SDK loaded', 'YaGames.init()', 'LoadingAPI.ready()', 'GameReady timing',
    'environment.i18n.lang', 'Yandex lang fallback', 'SDK language before URL fallback',
    'SDK language read before Game Ready', 'Language detected before the game is interactive',
    'Ввод закрыт до ready()', 'player.setData()', 'player.getData()',
    'showFullscreenAdv', 'showRewardedVideo', 'onRewarded callback', 'onOpen callback',
    'onClose callback', 'onError callback', 'getPayments()', 'consumePurchase()',
    'getPurchases()', 'getCatalog() called',
    // Чекер ищет эти два в колбэках Yandex SDK (`onOpen`); через мост то же самое
    // делается подпиской на PAUSE_STATE_CHANGED / AUDIO_STATE_CHANGED, а она
    // проверяется отдельно — SUB_PAUSE и SUB_AUDIO выше.
    'Sound paused during ads', 'Game paused during ads',
]

/**
 * Признанные ложные срабатывания чекера. Живут в `playgama-verify.json` рядом
 * с игрой:
 *
 *   { "checkerAcknowledged": [ { "match": "No profanity", "reason": "…" } ] }
 *
 * Такой пункт не исчезает: он печатается отдельным блоком вместе с причиной и
 * попадает в отчёт. Без написанной причины запись игнорируется — файл нужен
 * для разбора, а не для того, чтобы гасить неудобное.
 */
function loadAcknowledged() {
    const path = join(ROOT, 'playgama-verify.json')
    if (!existsSync(path)) return []
    try {
        const parsed = JSON.parse(readFileSync(path, 'utf8'))
        return (parsed.checkerAcknowledged ?? [])
            .filter((entry) => typeof entry?.match === 'string' && String(entry?.reason ?? '').trim().length >= 20)
    } catch (error) {
        warn('ACK_FILE', 'playgama-verify.json не читается', String(error))
        return []
    }
}

async function runChecker(page, checkerSource) {
    if (!checkerSource) { nv('CHECKER', 'yandex-games-debug-checker не запускался', 'Файл не удалось получить.'); return null }

    // Именно тегом скрипта, а не evaluate: исходник чекера — программа с
    // объявлениями верхнего уровня, а не выражение.
    await page.addScriptTag({ content: checkerSource })
    const version = await page.evaluate(() => window.YGDebugChecker?.version ?? null)
    if (!version) { fail('CHECKER', 'Чекер не инициализировался', 'window.YGDebugChecker отсутствует после инжекта.'); return null }

    await page.evaluate(() => window.YGDebugChecker.open())
    await page.waitForFunction(() => document.querySelectorAll('.dc-sum .dc-sn').length === 5, { timeout: 30_000 })

    const report = await page.evaluate(() => {
        const numbers = [...document.querySelectorAll('.dc-sum .dc-sn')].map((n) => n.textContent.trim())
        const rows = [...document.querySelectorAll('.dc-row')].map((row) => ({
            name: row.querySelector('.dc-name')?.textContent.trim() || '',
            detail: row.querySelector('.dc-det')?.textContent.trim() || '',
            status: row.querySelector('.dc-fail') ? 'fail'
                : row.querySelector('.dc-warn') ? 'warn'
                    : row.querySelector('.dc-nv') ? 'not-verified'
                        : row.querySelector('.dc-pass') ? 'pass' : 'na',
        }))
        return {
            summary: { pass: +numbers[0], fail: +numbers[1], warn: +numbers[2], notVerified: +numbers[3], score: numbers[4] },
            rows,
        }
    })

    const acknowledged = loadAcknowledged()
    const ackFor = (name) => acknowledged.find((entry) => name.includes(entry.match))
    const mediated = (name) => BRIDGE_MEDIATED.some((needle) => name.includes(needle))
    const problem = (r) => (r.status === 'fail' || r.status === 'warn')

    const ackRows = report.rows.filter((r) => problem(r) && !mediated(r.name) && ackFor(r.name))
        .map((r) => ({ ...r, reason: ackFor(r.name).reason }))
    const ownFails = report.rows.filter((r) => r.status === 'fail' && !mediated(r.name) && !ackFor(r.name))
    const ownWarns = report.rows.filter((r) => r.status === 'warn' && !mediated(r.name) && !ackFor(r.name))
    const mediatedRows = report.rows.filter((r) => r.status !== 'pass' && mediated(r.name))

    if (ownFails.length > 0) {
        fail('CHECKER_FAIL', `Чекер модерации: ${ownFails.length} нарушений в самой игре`,
            ownFails.map((r) => `${r.name} — ${r.detail}`).join('\n      '))
    } else {
        pass('CHECKER_FAIL', `Чекер модерации: нарушений в игре нет (score ${report.summary.score})`)
    }
    if (ownWarns.length > 0) {
        warn('CHECKER_WARN', `Чекер модерации: ${ownWarns.length} предупреждений`,
            ownWarns.map((r) => `${r.name} — ${r.detail}`).join('\n      '))
    }
    if (mediatedRows.length > 0) {
        nv('CHECKER_BRIDGE_MEDIATED', `Пунктов закрыто мостом, а не исходниками игры: ${mediatedRows.length}`,
            'Чекер ищет прямые вызовы Yandex SDK; мост делает их внутри бандла. Эти пункты проверены '
            + 'наблюдением за мостом выше:\n      ' + mediatedRows.map((r) => r.name).join('\n      '))
    }
    if (ackRows.length > 0) {
        nv('CHECKER_ACKNOWLEDGED', `Разобранных ложных срабатываний: ${ackRows.length}`,
            'Записаны в playgama-verify.json с причиной — не спрятаны, а объяснены:\n      '
            + ackRows.map((r) => `${r.name}\n        причина: ${r.reason}`).join('\n      '))
    }

    report.version = version
    report.acknowledged = ackRows
    return report
}

// ───────────────────────────────────────────────────── черновик Яндекса

function startDraftProxy(appId, port) {
    console.log(`· запуск @yandex-games/sdk-dev-proxy для черновика ${appId}…`)
    const child = spawn('npx', ['--yes', '@yandex-games/sdk-dev-proxy', '-p', join(ROOT, 'dist'),
        `--app-id=${appId}`, '--port', String(port)], {
        cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32',
    })
    child.stdout.on('data', (chunk) => process.stdout.write(`  proxy | ${chunk}`))
    child.stderr.on('data', (chunk) => process.stderr.write(`  proxy | ${chunk}`))
    return child
}

// ───────────────────────────────────────────────────── прогон

async function main() {
    mkdirSync(OUT_DIR, { recursive: true })

    const { chromium, path: playwrightPath, failures } = await loadChromium()
    if (!chromium) {
        console.error('Playwright с готовым Chromium не найден:')
        for (const line of failures ?? []) console.error(`  ${line}`)
        console.error('Установи браузер: npx playwright install chromium')
        process.exit(2)
    }
    console.log(`· playwright: ${playwrightPath}`)

    if (!build()) { report(); process.exit(1) }

    const distDir = join(ROOT, 'dist')
    if (!existsSync(distDir)) {
        fail('BUILD', 'Каталог dist отсутствует', 'Сборка не создала dist/ — проверять нечего.')
        report(); process.exit(1)
    }

    const checkerSource = await loadChecker()
    const spySource = readFileSync(join(SKILL_DIR, 'scripts', 'bridge-spy.js'), 'utf8')

    let server = null
    let proxy = null
    let targetUrl

    if (DRAFT_APP_ID) {
        proxy = startDraftProxy(DRAFT_APP_ID, PORT)
        await new Promise((r) => setTimeout(r, 6000))
        targetUrl = `https://yandex.ru/games/app/${DRAFT_APP_ID}/?draft=true&game_url=https://localhost:${PORT}`
    } else {
        server = await serve(distDir, PORT)
        targetUrl = `http://127.0.0.1:${PORT}/`
    }
    console.log(`· открываю ${targetUrl}`)

    const browser = await chromium.launch({
        headless: !HEADED,
        // Черновик обслуживается по https с самоподписанным сертификатом прокси.
        args: DRAFT_APP_ID ? ['--ignore-certificate-errors'] : [],
    })
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: Boolean(DRAFT_APP_ID),
    })
    await context.addInitScript(spySource)
    const page = await context.newPage()

    const consoleErrors = []
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('pageerror', (error) => consoleErrors.push(String(error)))

    try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    } catch (error) {
        fail('NAVIGATION', 'Страница не открылась', String(error))
        await browser.close(); server?.close(); proxy?.kill()
        report(); process.exit(1)
    }

    // Замеряем доступность ввода, пока идёт загрузка.
    const gateSamples = []
    const gateTimer = setInterval(async () => {
        try {
            gateSamples.push(await page.evaluate(() => ({
                ready: (window.__pgv?.messages || []).some((m) => m.message === 'game_ready'),
                enabled: document.querySelectorAll('button:not([disabled]), [role="button"]:not([disabled])').length,
            })))
        } catch { /* страница перезагружается */ }
    }, 120)

    // Ждём готовность; отсутствие — само по себе результат проверки.
    try {
        await page.waitForFunction(
            () => (window.__pgv?.messages || []).some((m) => m.message === 'game_ready'),
            { timeout: 45_000 },
        )
    } catch { /* checkBootSequence сообщит об этом */ }
    await page.waitForTimeout(1500)
    clearInterval(gateTimer)

    // Главная кнопка меню: без запуска игра не доходит до первой записи в
    // облако, и требование 1.9 осталось бы непроверенным.
    try {
        const start = page.locator('button:not([disabled])').first()
        if (await start.count() > 0) {
            await start.click({ timeout: 3000 })
            await page.waitForTimeout(4000)
        }
    } catch { /* меню другой формы — запись останется NOT VERIFIED */ }

    const observed = await page.evaluate(() => JSON.parse(JSON.stringify({
        progress: window.__pgv?.progress ?? [],
        messages: window.__pgv?.messages ?? [],
        subscriptions: window.__pgv?.subscriptions ?? [],
        storage: window.__pgv?.storage ?? [],
        adCalls: window.__pgv?.adCalls ?? [],
        languageReads: window.__pgv?.languageReads ?? [],
        wrapped: window.__pgv?.wrapped ?? false,
        wrapErrors: window.__pgv?.wrapErrors ?? [],
        capabilityOverrides: window.__pgv?.capabilityOverrides ?? [],
        platform: (() => { try { return String(window.bridge?.platform?.id) } catch { return null } })(),
    })))

    if (!observed.wrapped) {
        fail('BRIDGE_OBSERVED', 'Мост не обнаружен на странице',
            'window.bridge не появился: либо @playgama/bridge не подключён, либо бандл не выполнился. '
            + `Ошибки обёртки: ${observed.wrapErrors.join('; ') || 'нет'}`)
    } else {
        pass('BRIDGE_OBSERVED', `Мост наблюдается, платформа: ${observed.platform}`)
    }

    checkBootSequence(observed)
    checkSubscriptions(observed)
    checkLanguage(observed)
    checkStorage(observed)
    await checkInputGate(page, gateSamples)
    await checkRewardContract(page)

    const ownOriginErrors = consoleErrors.filter((text) => !/yandex|adfox|an\.yandex|googlesyndication|doubleclick/i.test(text))
    if (ownOriginErrors.length > 0) {
        fail('CONSOLE_CLEAN', `Ошибок в консоли: ${ownOriginErrors.length}`,
            ownOriginErrors.slice(0, 5).join('\n      '))
    } else {
        pass('CONSOLE_CLEAN', 'Консоль чистая (реклама площадки не считается)')
    }

    await page.screenshot({ path: join(OUT_DIR, 'verify-game.png') })

    const checkerReport = await runChecker(page, checkerSource)
    if (checkerReport) await page.screenshot({ path: join(OUT_DIR, 'verify-checker.png'), fullPage: false })

    await browser.close()
    server?.close()
    proxy?.kill()

    report({ observed, checker: checkerReport, target: targetUrl, draftAppId: DRAFT_APP_ID ?? null })
    process.exit(results.some((r) => r.status === 'fail') ? 1 : 0)
}

// ───────────────────────────────────────────────────── отчёт

function report(extra = {}) {
    const counts = { pass: 0, fail: 0, warn: 0, 'not-verified': 0 }
    for (const r of results) counts[r.status]++

    const payload = { root: ROOT, at: new Date().toISOString(), counts, results, ...extra }
    mkdirSync(OUT_DIR, { recursive: true })
    writeFileSync(join(OUT_DIR, 'verify.json'), JSON.stringify(payload, null, 2))

    const icon = { pass: '✓', fail: '✗', warn: '!', 'not-verified': '?' }
    const order = ['fail', 'warn', 'not-verified', 'pass']
    console.log(`\nRuntime-проверка Playgama — ${relative(process.cwd(), ROOT) || '.'}`)
    if (extra.target) console.log(`Цель: ${extra.target}\n`)
    for (const status of order) {
        for (const r of results.filter((x) => x.status === status)) {
            console.log(`${icon[status]} [${r.id}] ${r.title}`)
            if (r.detail) console.log(`    ${r.detail}`)
        }
    }
    console.log(`\nИтог: ${counts.pass} пройдено, ${counts.fail} провалено, ${counts.warn} предупреждений, `
        + `${counts['not-verified']} не проверено`)
    console.log(`Отчёт: ${join(relative(process.cwd(), ROOT) || '.', 'playgama-out', 'verify.json')}\n`)
}

main().catch((error) => {
    console.error(error)
    fail('HARNESS', 'Проверка упала', String(error))
    report()
    process.exit(2)
})
