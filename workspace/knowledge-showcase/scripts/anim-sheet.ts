/**
 * Снимки витрины анимаций через Playwright.
 *
 * Головные проверки ловят числа (перчатка ушла вперёд, голова поднялась), но
 * не ловят вид: вывернутое колено, залипший от мокапа поворот таза, шаг без
 * сгиба колена. Поэтому каждая анимация обязана быть ещё и снята — по шесть
 * кадров на полосу, `anim.html` рендерит их одним листом.
 *
 * Запуск: `npx tsx scripts/anim-sheet.ts [каталог]`
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.wasm': 'application/wasm',
  '.fbx': 'application/octet-stream',
};

const outDir = resolve(process.argv[2] ?? 'anim-shots');
await mkdir(outDir, { recursive: true });

const distDir = resolve('dist');
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const file = join(distDir, path === '/' ? 'index.html' : path);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise<void>((r) => server.listen(8767, r));

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1320, height: 1000 } });
page.on('pageerror', (e) => console.error('[ошибка страницы]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('[консоль]', m.text()); });

await page.goto('http://localhost:8767/anim.html');
await page.waitForFunction(() => (window as unknown as { animSheetReady?: boolean }).animSheetReady === true,
  null, { timeout: 120_000 });

const wrap = page.locator('#wrap');
let box = (await wrap.boundingBox())!;
// Окно растягивается под весь лист: обрезать скриншот за пределами вьюпорта
// Playwright не умеет, а лист высотой в пять с лишним тысяч пикселей.
await page.setViewportSize({ width: Math.ceil(box.width) + 40, height: Math.ceil(box.height) + 40 });
box = (await wrap.boundingBox())!;
// Лист режется на куски по четыре полосы: один PNG на 22 анимации нечитаем.
const ROWS_PER_SHEET = 4;
const CELL_H = 300;
const parts = Math.ceil(box.height / (ROWS_PER_SHEET * CELL_H));
for (let i = 0; i < parts; i++) {
  const y = box.y + i * ROWS_PER_SHEET * CELL_H;
  const height = Math.min(ROWS_PER_SHEET * CELL_H, box.y + box.height - y);
  const file = join(outDir, `anim-${String(i + 1).padStart(2, '0')}.png`);
  await page.screenshot({ path: file, clip: { x: box.x, y, width: box.width, height } });
  console.log(`  ${file}`);
}

await browser.close();
server.close();
console.log(`Готово: ${parts} листов в ${outDir}`);
