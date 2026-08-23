#!/usr/bin/env node
/**
 * Дымовой запуск игры: собрать, открыть в настоящем браузере, потрогать.
 *
 * `check-spec.mjs` читает исходники и ловит недописанное. Он не умеет главного:
 * запустить игру. Пакет мог проходить всю статическую приёмку и при этом не
 * открываться — падать на сборке, ронять исключение в первом кадре, рисовать
 * чёрный экран или разъезжаться на телефоне. Этот скрипт закрывает ровно эту
 * дыру и ничего больше не проверяет.
 *
 * Зависимостей нет: сборка — npm, сервер — node:http, браузер — системный
 * Chromium по протоколу DevTools через встроенный в Node WebSocket.
 *
 *   node scripts/smoke.mjs              # собрать и прогнать
 *   node scripts/smoke.mjs --skip-build # по готовому dist/
 *   node scripts/smoke.mjs --head       # с окном, чтобы посмотреть глазами
 */
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, normalize, resolve } from 'node:path'
import process from 'node:process'

const ROOT = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.')
const FLAGS = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')))
const HEADLESS = !FLAGS.has('--head')
const OVERALL_TIMEOUT_MS = 240_000

const results = []
const pass = (id, title, note = '') => results.push({ id, title, ok: true, note })
const fail = (id, title, note = '') => results.push({ id, title, ok: false, note })

// Числа, которые видит игрок, а не агент: кадры в секунду, вызовы отрисовки,
// вес сборки, задержка до первого кадра. Отчёт агента «всё работает» ничем не
// подтверждается — эти числа подтверждаются или опровергаются сами.
const metrics = {
  fps: null, framesTotal: null, draws: null, drawsMobile: null,
  bundleBytes: null, bundleFiles: null, firstFrameMs: null, firstDrawMs: null,
  consoleErrors: null, uiClickable: null, uiText: null, buildMs: null,
}

/** Суммарный вес собранной игры: сколько мегабайт качает игрок. */
function measureBundle(dir) {
  let bytes = 0
  let files = 0
  const walk = (current) => {
    if (!existsSync(current)) return
    for (const entry of readdirSync(current)) {
      const full = join(current, entry)
      const info = statSync(full)
      if (info.isDirectory()) walk(full)
      else { bytes += info.size; files++ }
    }
  }
  walk(dir)
  return { bytes, files }
}

// ---------------------------------------------------------------- сборка

function build() {
  const weigh = () => {
    const { bytes, files } = measureBundle(join(ROOT, 'dist'))
    metrics.bundleBytes = bytes
    metrics.bundleFiles = files
    return `${(bytes / 1048576).toFixed(2)} МБ в ${files} файлах`
  }
  if (FLAGS.has('--skip-build')) {
    if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
      fail('S1', 'Сборка проходит', 'dist/index.html нет, а сборку попросили пропустить')
      return false
    }
    pass('S1', 'Сборка проходит', `пропущена по --skip-build, ${weigh()}`)
    return true
  }
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const startedAt = Date.now()
  const out = spawnSync(npm, ['run', 'build'], { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' })
  metrics.buildMs = Date.now() - startedAt
  if (out.status !== 0) {
    const log = `${out.stdout || ''}${out.stderr || ''}`.trim().split('\n').slice(-14).join('\n')
    fail('S1', 'Сборка проходит', log || `npm run build вернул ${out.status}`)
    return false
  }
  pass('S1', 'Сборка проходит', weigh())
  return true
}

// ---------------------------------------------------------------- сервер

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
}

function serve(dir) {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      const raw = decodeURIComponent((req.url || '/').split('?')[0])
      let file = join(dir, normalize(raw).replace(/^(\.\.[/\\])+/, ''))
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
      if (!existsSync(file)) {
        res.writeHead(404, { 'content-type': 'text/plain' })
        res.end('not found')
        return
      }
      res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' })
      createReadStream(file).pipe(res)
    })
    server.listen(0, '127.0.0.1', () => done({ server, port: server.address().port }))
  })
}

// ---------------------------------------------------------------- браузер

function chromiumBinary() {
  const named = process.env.SMOKE_CHROME || process.env.CHROME_PATH
  if (named && existsSync(named)) return named
  const guesses = [
    process.env.PLAYWRIGHT_BROWSERS_PATH && join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium'),
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean)
  for (const g of guesses) if (existsSync(g)) return g
  for (const name of ['chromium', 'google-chrome', 'chrome']) {
    const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8' })
    const found = (which.stdout || '').trim().split('\n')[0]
    if (found && existsSync(found)) return found
  }
  return null
}

function launch(binary) {
  const profile = mkdtempSync(join(tmpdir(), 'smoke-profile-'))
  const args = [
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--mute-audio', '--no-sandbox',
    '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', 'about:blank',
  ]
  if (HEADLESS) args.unshift('--headless=new')
  const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  return new Promise((done, die) => {
    let buffer = ''
    const timer = setTimeout(() => die(new Error('браузер не сообщил адрес DevTools за 30 с')), 30_000)
    child.stderr.on('data', (chunk) => {
      buffer += chunk
      const found = buffer.match(/ws:\/\/[^\s]+/)
      if (found) {
        clearTimeout(timer)
        done({ child, wsUrl: found[0] })
      }
    })
    child.on('exit', (code) => { clearTimeout(timer); die(new Error(`браузер завершился с кодом ${code}`)) })
  })
}

/** Минимальный клиент протокола DevTools поверх встроенного в Node WebSocket. */
class Devtools {
  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.waiting = new Map()
    this.listeners = []
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id && this.waiting.has(message.id)) {
        const { done, die } = this.waiting.get(message.id)
        this.waiting.delete(message.id)
        message.error ? die(new Error(message.error.message)) : done(message.result)
      } else if (message.method) {
        for (const listener of this.listeners) listener(message)
      }
    })
  }

  static connect(url) {
    return new Promise((done, die) => {
      const socket = new WebSocket(url)
      socket.addEventListener('open', () => done(new Devtools(socket)))
      socket.addEventListener('error', () => die(new Error(`не удалось подключиться к ${url}`)))
    })
  }

  on(listener) { this.listeners.push(listener) }

  send(method, params = {}, sessionId) {
    const id = this.nextId++
    const payload = { id, method, params }
    if (sessionId) payload.sessionId = sessionId
    this.socket.send(JSON.stringify(payload))
    return new Promise((done, die) => {
      this.waiting.set(id, { done, die })
      setTimeout(() => {
        if (this.waiting.delete(id)) die(new Error(`${method} не ответил за 30 с`))
      }, 30_000)
    })
  }
}

// Ставится в страницу ДО её собственных скриптов: считает кадры и вызовы
// отрисовки. Счётчик кадров отвечает на «жив ли игровой цикл», счётчик
// отрисовки — на «попало ли что-нибудь в кадр». Пустой чёрный экран отличается
// от рабочего именно вторым числом, а не отсутствием ошибок.
const PROBE = `(() => {
  const s = window.__smoke = { frames: 0, draws: 0, errors: [], gl: false,
                               t0: performance.now(), firstFrame: 0, firstDraw: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => {
    s.frames++;
    if (!s.firstFrame) s.firstFrame = Math.round(performance.now() - s.t0);
    return cb(t)
  });
  const patch = (proto) => {
    if (!proto) return;
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const original = proto[name];
      if (typeof original !== 'function') continue;
      proto[name] = function (...args) {
        s.draws++;
        if (!s.firstDraw) s.firstDraw = Math.round(performance.now() - s.t0);
        return original.apply(this, args)
      };
    }
  };
  patch(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
  patch(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const context = getContext.call(this, type, ...rest);
    if (context && /webgl/i.test(String(type))) s.gl = true;
    return context;
  };
  window.addEventListener('error', (e) => s.errors.push(String(e.message || e.error)));
  window.addEventListener('unhandledrejection', (e) => s.errors.push('unhandledrejection: ' + String(e.reason)));
})()`

// Что считается интерфейсом: видимый узел поверх сцены, на который можно нажать
// или в котором есть текст. Пустой слой-контейнер интерфейсом не является —
// именно из них и состояла игра, где меню так и не появилось.
const INTERFACE_PROBE = `(() => {
  const canvas = document.querySelector('canvas');
  const seen = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 8 && rect.height > 8 && style.display !== 'none' &&
      style.visibility !== 'hidden' && Number(style.opacity) > 0.05;
  };
  const overlay = [...document.querySelectorAll('body *')].filter((el) =>
    el !== canvas && !el.contains(canvas) && !['SCRIPT', 'STYLE', 'LINK'].includes(el.tagName) && seen(el));
  const clickable = overlay.filter((el) =>
    el.matches('button, [role="button"], a[href], input, select, textarea, [data-action]') ||
    getComputedStyle(el).cursor === 'pointer');
  const text = overlay.filter((el) => !el.children.length && (el.textContent || '').trim().length > 0);
  const emptyLayers = overlay.filter((el) => !el.children.length && !(el.textContent || '').trim()).length;
  return { overlay: overlay.length, clickable: clickable.length, text: text.length, emptyLayers };
})()`

const IGNORED_ERRORS = [/favicon\.ico/i, /\bDevTools\b/i, /Autofill\./i]
const wait = (ms) => new Promise((done) => setTimeout(done, ms))

async function evaluate(cdp, session, expression) {
  const { result } = await cdp.send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  }, session)
  return result?.value
}

/** Нажать самую заметную кнопку: игра почти всегда начинается из меню. */
async function pressPlay(cdp, session) {
  const spot = await evaluate(cdp, session, `(() => {
    const clickable = [...document.querySelectorAll('button, [role="button"], .btn, [data-action]')]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 40 && rect.height > 24 && style.display !== 'none' &&
          style.visibility !== 'hidden' && Number(style.opacity) > 0.1 &&
          rect.bottom > 0 && rect.top < innerHeight;
      });
    if (!clickable.length) return null;
    const best = clickable.sort((a, b) => {
      const area = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height };
      return area(b) - area(a);
    })[0];
    const rect = best.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, label: (best.textContent || '').trim().slice(0, 40) };
  })()`)
  if (!spot) return ''
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cdp.send('Input.dispatchMouseEvent', {
      type, x: spot.x, y: spot.y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0,
    }, session)
  }
  return spot.label
}

/** Клавиши, мышь и палец: игра обязана пережить ввод, а не только показ. */
async function pokeControls(cdp, session, { touch }) {
  const keys = [
    { key: ' ', code: 'Space', windowsVirtualKeyCode: 32 },
    { key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 },
    { key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 },
    { key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 },
    { key: 's', code: 'KeyS', windowsVirtualKeyCode: 83 },
    { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 },
  ]
  for (const key of keys) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...key }, session)
    await wait(60)
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key }, session)
  }

  const metrics = await evaluate(cdp, session, '({ w: innerWidth, h: innerHeight })')
  const cx = Math.round(metrics.w / 2)
  const cy = Math.round(metrics.h / 2)

  if (touch) {
    const points = (y) => [{ x: cx, y }]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(cy + 120) }, session)
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(cy + 120 - step * 30) }, session)
      await wait(16)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, session)
  } else {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1, buttons: 1 }, session)
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx + step * 12, y: cy - step * 8, button: 'left', buttons: 1 }, session)
      await wait(16)
    }
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx + 72, y: cy - 48, button: 'left', clickCount: 1, buttons: 0 }, session)
  }
}

async function openSession(cdp, url, viewport) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  await cdp.send('Runtime.enable', {}, sessionId)
  await cdp.send('Log.enable', {}, sessionId)
  await cdp.send('Page.enable', {}, sessionId)
  if (viewport) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.scale || 2,
      mobile: Boolean(viewport.mobile),
    }, sessionId)
    if (viewport.mobile) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId)
  }
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE }, sessionId)
  await cdp.send('Page.navigate', { url }, sessionId)
  return sessionId
}

// ---------------------------------------------------------------- прогон

async function run() {
  if (!build()) return

  const { server, port } = await serve(join(ROOT, 'dist'))
  const url = `http://127.0.0.1:${port}/`
  const binary = chromiumBinary()
  if (!binary) {
    server.close()
    fail('S2', 'Игра открывается без ошибок', 'Chromium не найден: задайте SMOKE_CHROME=путь к браузеру')
    return
  }

  const { child, wsUrl } = await launch(binary)
  const cdp = await Devtools.connect(wsUrl)

  const noise = []
  cdp.on((message) => {
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails
      noise.push(details.exception?.description || details.text || 'исключение без описания')
    } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      noise.push(message.params.args.map((a) => a.description ?? a.value ?? '').join(' '))
    } else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      const entry = message.params.entry
      noise.push(entry.url ? entry.text + ' (' + entry.url + ')' : entry.text)
    }
  })

  try {
    // --- десктоп
    const desktop = await openSession(cdp, url, { width: 1280, height: 720, scale: 1 })
    await wait(3500)

    // Интерфейс меряется ДО нажатия: если меню не появилось, нажимать нечего.
    // Живой случай: слои интерфейса созданы и вставлены в документ, экраны
    // зарегистрированы в роутере, роутер честно зовёт show() — и ничего не
    // видно, потому что корни экранов никто не вставил в слой. Сцена рисуется,
    // ошибок нет, статика зелёная, играть нельзя.
    const ui = await evaluate(cdp, desktop, INTERFACE_PROBE)
    if (!ui) {
      fail('S7', 'Интерфейс появился', 'страница не ответила')
    } else if (!ui.clickable && !ui.text) {
      fail('S7', 'Интерфейс появился',
        `поверх сцены нет ни кнопок, ни текста (пустых слоёв: ${ui.emptyLayers}). ` +
        'Экраны созданы, но их корни не вставлены в документ')
    } else {
      pass('S7', 'Интерфейс появился', `${ui.clickable} нажимаемых, ${ui.text} текстовых узлов`)
    }
    if (ui) { metrics.uiClickable = ui.clickable; metrics.uiText = ui.text }

    const label = await pressPlay(cdp, desktop)
    await wait(1500)
    const before = await evaluate(cdp, desktop, 'window.__smoke && { ...window.__smoke, now: performance.now() }')
    const noiseBeforeInput = noise.length
    const errorsBeforeInput = (before?.errors || []).length
    await pokeControls(cdp, desktop, { touch: false })
    await wait(2000)
    const after = await evaluate(cdp, desktop, 'window.__smoke && { ...window.__smoke, now: performance.now() }')

    const errors = [...noise, ...(after?.errors || [])]
      .filter((line) => line && !IGNORED_ERRORS.some((skip) => skip.test(line)))
    metrics.consoleErrors = new Set(errors).size
    if (errors.length) {
      fail('S2', 'Игра открывается без ошибок', [...new Set(errors)].slice(0, 6).join(' | '))
    } else {
      pass('S2', 'Игра открывается без ошибок')
    }

    if (!after) {
      fail('S3', 'Игровой цикл идёт', 'страница не отдала счётчики — скрипт игры не выполнился')
      fail('S4', 'В кадр что-то попадает', 'счётчиков нет')
    } else {
      const frames = after.frames - (before?.frames || 0)
      const windowMs = Math.max(1, (after.now || 0) - (before?.now || 0))
      metrics.fps = Math.round((frames / windowMs) * 1000)
      metrics.framesTotal = after.frames
      metrics.draws = after.draws
      metrics.firstFrameMs = after.firstFrame || null
      metrics.firstDrawMs = after.firstDraw || null
      if (after.frames < 30) fail('S3', 'Игровой цикл идёт', `кадров за 7 секунд: ${after.frames}`)
      else if (frames < 10) fail('S3', 'Игровой цикл идёт', `цикл встал после ввода: ${frames} кадров за 2 секунды`)
      else pass('S3', 'Игровой цикл идёт', `${after.frames} кадров, из них ${frames} после ввода`)

      const draws = after.draws - (before?.draws || 0)
      if (!after.gl) fail('S4', 'В кадр что-то попадает', 'контекст WebGL не создан')
      else if (after.draws === 0) fail('S4', 'В кадр что-то попадает', 'ни одного вызова отрисовки: экран пустой')
      else if (draws === 0) fail('S4', 'В кадр что-то попадает', 'после ввода отрисовка прекратилась')
      else pass('S4', 'В кадр что-то попадает', `${after.draws} вызовов отрисовки${label ? `, нажата «${label}»` : ''}`)
    }

    // Ввод — отдельная проверка, а не побочный эффект: игра может открыться
    // безупречно и умереть на первом же нажатии, и это ровно то, что видит игрок.
    const alive = await evaluate(cdp, desktop, '!!document.querySelector("canvas")')
    const afterInput = [...noise.slice(noiseBeforeInput), ...(after?.errors || []).slice(errorsBeforeInput)]
      .filter((line) => line && !IGNORED_ERRORS.some((skip) => skip.test(line)))
    if (!alive) fail('S5', 'Игра пережила ввод', 'канвас исчез со страницы')
    else if (afterInput.length) fail('S5', 'Игра пережила ввод', [...new Set(afterInput)].slice(0, 4).join(' | '))
    else pass('S5', 'Игра пережила ввод', 'клавиши, мышь и палец не уронили игру')
    await cdp.send('Target.closeTarget', { targetId: (await cdp.send('Target.getTargetInfo', {}, desktop)).targetInfo.targetId })

    // --- телефон
    noise.length = 0
    const phone = await openSession(cdp, url, { width: 390, height: 844, scale: 3, mobile: true })
    await wait(3500)
    await pressPlay(cdp, phone)
    await wait(1200)
    await pokeControls(cdp, phone, { touch: true })
    await wait(1500)
    const layout = await evaluate(cdp, phone, `(() => {
      const root = document.documentElement;
      const overflowing = [...document.querySelectorAll('body *')]
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.right > innerWidth + 2 && getComputedStyle(el).position !== 'fixed';
        })
        .slice(0, 3)
        .map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/)[0] : ''));
      return {
        scrollWidth: root.scrollWidth, clientWidth: root.clientWidth,
        scrollTop: document.scrollingElement ? document.scrollingElement.scrollTop : 0,
        overflowing, draws: window.__smoke ? window.__smoke.draws : 0,
      };
    })()`)

    if (layout) metrics.drawsMobile = layout.draws
    if (!layout) {
      fail('S6', 'На телефоне ничего не разъехалось', 'страница не ответила')
    } else if (layout.scrollWidth > layout.clientWidth + 2) {
      fail('S6', 'На телефоне ничего не разъехалось',
        `ширина страницы ${layout.scrollWidth} px при экране ${layout.clientWidth} px` +
        (layout.overflowing.length ? `; вылезли: ${layout.overflowing.join(', ')}` : ''))
    } else if (!layout.draws) {
      fail('S6', 'На телефоне ничего не разъехалось', 'на телефоне сцена не рисуется вовсе')
    } else {
      pass('S6', 'На телефоне ничего не разъехалось', `390×844, ${layout.draws} вызовов отрисовки`)
    }
  } finally {
    try { child.kill() } catch {}
    server.close()
  }
}

const guard = setTimeout(() => {
  console.error('\n❌ Дымовой запуск не уложился в 4 минуты и был прерван.')
  process.exit(1)
}, OVERALL_TIMEOUT_MS)

/**
 * Отчёт на диск. Фабрика читает его сама и по нему решает, чинить игру дальше
 * или выпускать: пересказ агента о собственной работе таким основанием не был
 * никогда. Пишется всегда — и на зелёном прогоне, и на упавшем.
 */
function writeReport(broken) {
  try {
    const dir = join(ROOT, '.factory')
    mkdirSync(dir, { recursive: true })
    const report = {
      kind: 'smoke',
      at: new Date().toISOString(),
      ok: broken.length === 0,
      failed: broken.map((r) => r.id),
      checks: results.map(({ id, title, ok, note }) => ({ id, title, ok, note })),
      metrics,
    }
    writeFileSync(join(dir, 'smoke-report.json'), JSON.stringify(report, null, 2), 'utf8')
  } catch (error) {
    console.error(`(отчёт .factory/smoke-report.json не записан: ${error && error.message})`)
  }
}

/** Числа игрока одной строкой: их же фабрика кладёт в карточку проекта. */
function printMetrics() {
  const mb = metrics.bundleBytes == null ? '—' : `${(metrics.bundleBytes / 1048576).toFixed(2)} МБ`
  const parts = [
    `кадров в секунду: ${metrics.fps ?? '—'}`,
    `вызовов отрисовки: ${metrics.draws ?? '—'}`,
    `вес сборки: ${mb}`,
    `первый кадр: ${metrics.firstFrameMs != null ? metrics.firstFrameMs + ' мс' : '—'}`,
    `ошибок в консоли: ${metrics.consoleErrors ?? '—'}`,
  ]
  console.log(`Числа игрока: ${parts.join(' · ')}`)
}

run()
  .catch((error) => fail('S0', 'Дымовой запуск состоялся', String(error && error.message || error)))
  .finally(() => {
    clearTimeout(guard)
    console.log('')
    // Печатаем по номерам, а не по порядку выполнения: читать отчёт
    // проще, когда S2 всегда стоит между S1 и S3.
    results.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
    for (const r of results) {
      console.log(`${r.ok ? '✅' : '❌'} ${r.id.padEnd(3)} ${r.title}${r.note ? `\n       ${r.note}` : ''}`)
    }
    const broken = results.filter((r) => !r.ok)
    printMetrics()
    writeReport(broken)
    console.log('')
    if (broken.length) {
      console.log(`Игра не прошла дымовой запуск: ${broken.map((r) => r.id).join(', ')}.`)
      console.log('Статическая приёмка тут не поможет — это то, что видит игрок.')
      process.exit(1)
    }
    console.log('Игра собирается, открывается, рисует и переживает ввод — на десктопе и на телефоне.')
    process.exit(0)
  })
