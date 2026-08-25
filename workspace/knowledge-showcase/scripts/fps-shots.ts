/**
 * Снимки вкладки FPS из настоящего браузера: вьюмодель, руки, прицел и
 * эффекты видит только рендер, а не головной прогон.
 *
 * Скрипт сам поднимает `vite preview`: по `file://` модульные скрипты билда
 * блокирует CORS, и стенд не стартует вовсе.
 *
 * Запуск: `npm run shots:fps` (после `vite build`).
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'fps-shots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const server = await preview({ preview: { port: 5311, strictPort: false } });
const base = server.resolvedUrls?.local[0] ?? 'http://localhost:5311';
await page.goto(base);
await page.waitForTimeout(2500);

/**
 * Прямой доступ к активному демо: pointer lock в headless недоступен.
 *
 * Пауза щедрая намеренно. Программный рендер выдаёт ~3 кадра в секунду, а
 * хост клампит `dt` сотней миллисекунд (иначе скрытая вкладка прокручивала
 * бы симуляцию разом). Игровое время идёт вчетверо медленнее реального, и
 * анимация смены ствола длиной 0.45 с не успевает доиграть за полсекунды
 * ожидания — кадр снимает провал анимации вместо готовой позы.
 */
async function drive(script: string): Promise<void> {
  await page.evaluate(script);
  await page.waitForTimeout(2200);
}

await page.waitForFunction('!!window.__host', null, { timeout: 20000 }).catch(() => {
  console.error('Стенд не загрузился. Ошибки страницы:');
  for (const e of errors.slice(0, 10)) console.error('  ' + e);
});
await page.evaluate(`window.__host.switchTo('fps')`);
await page.waitForTimeout(1500);

// Захват мыши эмулировать нельзя — подменяем флаг у хаба ввода.
await page.evaluate(`
  const hub = window.__host.input;
  Object.defineProperty(hub, 'isPointerLocked', { get: () => true, configurable: true });
  window.__fps = window.__host.demo;
  // Игрок на съёмке бессмертен. Иначе ответный огонь доводит HP до нуля,
  // демо перезапускается посреди серии — и кадр снимает свежую арену вместо
  // подготовленной сцены (это и выглядело как «трупы куда-то делись»).
  window.__fps.applyDamage = () => {};
`);
await page.waitForTimeout(500);

/** Имя кадра, скрипт подготовки и — если кадру нужно время — пауза, мс. */
const shots: Array<[string, string, number?]> = [
  ['01-hip', ''],
  ['02-ads', `window.__host.input.__b = new Set([2]); window.__host.input.isButtonDown = (b) => b === 2;`],
  ['03-fire', `window.__host.input.isButtonDown = (b) => b === 0;`],
  ['04-reload', `window.__host.input.isButtonDown = () => false; window.__fps.startReload();`],
  // Перед сменой ствола гасим ОБА таймера занятости: иначе `selectWeapon`
  // уходит в отказ, и кадр снимает не тот ствол, что подписан. Гасить только
  // перезарядку мало — предыдущая смена ствола ещё не доиграла, и от прогона
  // к прогону это выпадало то так, то эдак.
  ['05-shotgun', `window.__fps.reloadTimer = 0; window.__fps.swapTimer = 0; window.__fps.selectWeapon(2);`],
  ['06-pistol', `window.__fps.reloadTimer = 0; window.__fps.swapTimer = 0; window.__fps.selectWeapon(0);`],
  ['07-blast', `window.__fps.barrels[0].fuse = 0.001;`],
  // Крупный план врага: позу, хват и попадания видно только вблизи.
  ['08-enemy', `
    window.__fps.reloadTimer = 0;
    window.__fps.selectWeapon(1);
    const e = window.__fps.enemies[0];
    e.pos.set(1.4, 0, 17.0);
    // 'alert' с бесконечной реакцией: враг стоит на месте и целится, а не
    // отступает от подошедшего вплотную игрока — иначе кадр снимает спину.
    e.state = 'alert';
    e.stateTime = 0;
    e.reaction = 999;
  `],
  ['09-enemy-hit', `
    window.__host.input.isButtonDown = (b) => b === 0;
  `],
  // Рэгдолл: тело падает физикой, оружие выпадает из рук.
  ['10-ragdoll', `
    window.__host.input.isButtonDown = () => false;
    const d = window.__fps;
    d.reloadTimer = 0;
    d.swapTimer = 0;
    d.selectWeapon(1);
    // Кадр ставится целиком: и игрок, и тела. Иначе рамка зависит от того,
    // куда враги успели разбежаться за время съёмки предыдущих кадров.
    d.pos.set(0, 0, 11);
    d.yaw = 0;
    d.enemies.slice(0, 2).forEach((e, i) => {
      e.pos.set(-1.6 + i * 3.0, 0, 6.0 + i * 0.8);
      // Риг переезжает на кадре анимации, а рэгдолл снимает позу СРАЗУ, из
      // мировых матриц: без ручной синхронизации тело упало бы там, где враг
      // был до телепорта.
      e.rig.root.position.copy(e.pos);
      e.rig.root.updateMatrixWorld(true);
      // THREE в область видимости страницы не выведен, поэтому вектор
      // берётся клоном уже существующего.
      d.killEnemy(e, d.pos.clone().set(i ? 2.5 : -1.8, 0.6, -4.5), 'body');
    });
  `, 1400],
];

for (const [name, script, wait] of shots) {
  if (script) await drive(script);
  // Софтверный рендер идёт ~3 fps, и игровое время в нём течёт вчетверо
  // медленнее реального: паузы здесь длиннее, чем кажется нужным.
  await page.waitForTimeout(wait ?? 600);
  await page.screenshot({ path: resolve(outDir, `${name}.png`) });
  console.log(`  снято ${name}.png`);
}

const stats = await page.evaluate(`(() => {
  const d = window.__fps;
  const r = window.__host.renderer.info.render;
  return { calls: r.calls, tris: r.triangles, weapon: d.active.spec.name, hp: d.hp };
})()`);
console.log('  рендер:', JSON.stringify(stats));

if (errors.length) {
  console.error('Ошибки страницы:');
  for (const e of errors.slice(0, 10)) console.error('  ' + e);
}
await browser.close();
await server.close();
process.exit(errors.length ? 1 : 0);
