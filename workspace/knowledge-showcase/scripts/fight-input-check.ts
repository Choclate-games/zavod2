/**
 * Проверка раскладки в НАСТОЯЩЕМ браузере через Playwright.
 *
 * Зачем отдельный скрипт, когда таблица «кнопка → приём» уже проверена
 * головно (`fighting-check.ts`): головная проверка знает только про
 * `resolveInput`. Между ней и игроком лежит всё то, что головным прогоном не
 * воспроизводится и что как раз и ломается, — правая кнопка мыши открывает
 * системное меню вместо удара, `ctrlKey` не доходит до обработчика, буфер
 * ввода съедает нажатие, подписка не снимается при уходе с вкладки.
 *
 * Поэтому здесь кликают по канвасу настоящими pointer-событиями и читают,
 * какой приём объявил HUD. Замер физический: не «обработчик вызвался», а
 * «в бойце пошёл именно тот приём, который написан в подсказке».
 *
 * Запуск: `npx tsx scripts/fight-input-check.ts` (нужен собранный `dist/`).
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { MOVES, resolveInput, type Limb, type Stance, type Strength } from '../src/game/fightingMoves';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name} ${detail}`); }
}

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.wasm': 'application/wasm',
  '.fbx': 'application/octet-stream',
};

const distDir = resolve('dist');
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const body = await readFile(join(distDir, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise<void>((r) => server.listen(8768, r));

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
page.on('pageerror', (e) => console.error('[ошибка страницы]', e.message));

await page.goto('http://localhost:8768/index.html');

/** Открыть вкладку так же, как её открывает человек: каталог → поиск → карточка. */
async function openDemo(query: string, marker: string): Promise<void> {
  await page.click('#demo-catalog-trigger');
  await page.fill('#catalog-search', query);
  await page.waitForTimeout(300);
  await page.locator('.demo-card').first().click();
  await page.waitForFunction(
    (m) => (document.getElementById('demo-status')?.textContent ?? '').includes(m),
    marker, { timeout: 120_000 },
  );
}
// Клик по карточке, а не вызов внутренней функции: так заодно проверяется,
// что вкладка вообще поднимается со всеми моделями и мокапом.
await openDemo('файтинг', 'состояние');

/** Дать игре прожевать ввод: буфер держит нажатие несколько кадров. */
async function settle(ms = 420): Promise<void> {
  await page.waitForTimeout(ms);
}

/**
 * Нажать кнопку мыши на канвасе и вернуть приём, который объявил HUD.
 *
 * События шлются как настоящие: `pointerdown` с нужным `button` и `ctrlKey`.
 * `page.mouse` тут не годится — она не умеет модификатор без отдельного
 * `keyboard.down`, а нам нужно проверить именно то поле события, которое
 * читает демо.
 */
async function strike(button: number, ctrl: boolean, hold?: string): Promise<string> {
  // Раунд сбрасывается перед каждым нажатием: бот бьёт в ответ, и уже к
  // третьему замеру игрок стоит в стане или лежит — тогда кнопка честно не
  // делает ничего, и проверка меряла бы не раскладку, а ход матча.
  await page.keyboard.press('KeyR');
  await page.waitForFunction(
    () => /состояние: <b>idle/.test(document.getElementById('demo-status')?.innerHTML ?? ''),
    null, { timeout: 10_000 },
  );
  if (hold) await page.keyboard.down(hold);
  if (hold) await page.waitForTimeout(120);
  // Ожидание ставится ДО нажатия и крутится в самой странице по кадрам:
  // джеб живёт 14 кадров (233 мс), и опрос из скрипта через round-trip
  // успевал промахнуться мимо этого окна — проверка мигала.
  const waiting = page.waitForFunction(() => {
    const html = document.getElementById('demo-status')?.innerHTML ?? '';
    return /приём: <b>([^<]+)<\/b>/.exec(html)?.[1] ?? null;
  }, null, { polling: 'raf', timeout: 5000 }).then((h) => h.jsonValue() as Promise<string>)
    .catch(() => '');

  await page.evaluate(({ b, c }) => {
    const canvas = document.getElementById('game-canvas')!;
    const base = {
      bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse',
      clientX: 400, clientY: 400, button: b, buttons: b === 2 ? 2 : 1, ctrlKey: c,
    };
    canvas.dispatchEvent(new PointerEvent('pointerdown', base));
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...base, buttons: 0 }));
  }, { b: button, c: ctrl });

  const label = await waiting;
  if (hold) await page.keyboard.up(hold);
  await settle(150);
  return label;
}

/** Приём читается из HUD по русской подписи — её же видит игрок. */
function labelOf(strength: Strength, limb: Limb, stance: Stance): string {
  return MOVES[resolveInput(strength, limb, stance)].label[0];
}

console.log('\nМышь в браузере:');

// Правая кнопка обязана бить, а не открывать меню браузера. Проверяется
// тем, что `contextmenu` отменён: иначе поверх канваса встаёт системное
// меню и следующий клик уходит в него.
const menuDefault = await page.evaluate(() => {
  const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  document.getElementById('game-canvas')!.dispatchEvent(ev);
  return ev.defaultPrevented;
});
check('правая кнопка не открывает меню браузера', menuDefault);

const cases: Array<[string, number, boolean, string | undefined, Stance]> = [
  ['ЛКМ — слабый рукой', 0, false, undefined, 'stand'],
  ['ПКМ — сильный рукой', 2, false, undefined, 'stand'],
  ['Ctrl+ЛКМ — слабый ногой', 0, true, undefined, 'stand'],
  ['Ctrl+ПКМ — сильный ногой', 2, true, undefined, 'stand'],
  ['S+ЛКМ — присед меняет приём', 0, false, 'KeyS', 'crouch'],
  ['S+Ctrl+ПКМ — тяжёлая нога из приседа', 2, true, 'KeyS', 'crouch'],
];
for (const [name, button, ctrl, hold, stance] of cases) {
  const strength: Strength = button === 2 ? 'heavy' : 'light';
  const limb: Limb = ctrl ? 'kick' : 'punch';
  const want = labelOf(strength, limb, stance);
  const got = await strike(button, ctrl, hold);
  check(`${name} → ${want}`, got === want, `в HUD «${got}»`);
}

// Связка теми же кнопками здесь не проверяется намеренно: отмена открывается
// только по ПОПАДАНИЮ, то есть замер зависел бы от того, дошёл ли удар до
// бота, — а это ход матча, а не раскладка. Цепочку проверяет
// `fighting-check.ts` на `resolveCancel`, где попадание задано.

// Подписка обязана сниматься: если демо ушло с экрана, а обработчик остался,
// клики продолжат бить в невидимого бойца (и в чужой демо).
await openDemo('ЗиЛ', 'Скорость');
await page.waitForTimeout(500);
const afterLeave = await page.evaluate(() => {
  const canvas = document.getElementById('game-canvas')!;
  canvas.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1,
  }));
  return (document.getElementById('demo-status')?.innerHTML ?? '');
});
check('после ухода с вкладки клики в файтинг не идут', !afterLeave.includes('приём:'),
  afterLeave.slice(0, 80));

await browser.close();
server.close();
console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
