import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wasm': 'application/wasm',
};

async function main(): Promise<void> {
  console.log('Building project for inspection...');
  const { execSync } = await import('child_process');
  execSync('npx vite build', { stdio: 'inherit' });

  const distDir = join(process.cwd(), 'dist');
  const server = createServer(async (req, res) => {
    try {
      const urlPath = (req.url || '/').split('?')[0];
      const filePath = join(distDir, urlPath === '/' ? 'index.html' : urlPath);
      const ext = extname(filePath);
      const content = await readFile(filePath);
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise<void>((resolve) => server.listen(8765, resolve));
  console.log('Inspection server listening on http://localhost:8765');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-gpu-rasterization',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--use-angle=default',
      '--disable-background-timer-throttling',
    ],
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });

  page.on('console', (msg) => console.log(`[Browser] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (err) => console.error(`[Browser Error] ${err.message}`));

  await page.goto('http://localhost:8765/');
  await page.waitForTimeout(1000);

  // Set low quality if available
  const tierBtn = page.locator('#quality-btn, .tier-btn, #quality-badge');
  if (await tierBtn.count() > 0) {
    console.log('Setting quality to Low...');
    await page.evaluate(() => {
      const host = (window as unknown as { host?: { setTier?: (t: string) => void } }).host;
      if (host?.setTier) host.setTier('low');
    });
  }

  // Switch to Racing Demo
  console.log('Switching to Racing demo...');
  await page.evaluate(async () => {
    const mainSelect = (window as unknown as { selectDemo?: (id: string) => Promise<void> }).selectDemo;
    const host = (window as unknown as { host?: { switchTo: (id: string) => Promise<void> } }).host;
    if (mainSelect) await mainSelect('racing');
    else if (host) await host.switchTo('racing');
  });

  // If selectDemo is not exposed on window, click next button until title matches
  let isRacing = false;
  for (let i = 0; i < 15; i++) {
    const title = await page.locator('#current-demo-title').innerText().catch(() => '');
    if (title.includes('Гонка') || title.includes('Racing')) {
      isRacing = true;
      break;
    }
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(300);
  }
  console.log(`Current demo active: ${isRacing ? 'Racing' : 'Other'}`);

  // Wait 3 seconds for race countdown and physics step
  await page.waitForTimeout(3000);

  const outDir = 'C:\\Users\\1\\.gemini\\antigravity-ide\\brain\\a842aa2d-f7e3-423b-84d8-3806a84590e3';

  // 1. Screenshot of start line / grid (Chase View)
  await page.screenshot({ path: join(outDir, 'inspect-racing-start.png') });
  console.log('Saved inspect-racing-start.png');

  // 2. Switch camera to top-down view (Press KeyC twice)
  await page.keyboard.press('KeyC');
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyC');
  await page.waitForTimeout(400);

  // Take top-down screenshot of the start grid & layout
  await page.screenshot({ path: join(outDir, 'inspect-racing-topdown.png') });
  console.log('Saved inspect-racing-topdown.png');

  // 3. Drive forward for 4.5 seconds to see bots driving and Turn 1
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(4500);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(400);

  await page.screenshot({ path: join(outDir, 'inspect-racing-turn1.png') });
  console.log('Saved inspect-racing-turn1.png');

  // 4. Switch back to chase cam
  await page.keyboard.press('KeyC');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, 'inspect-racing-chase-racing.png') });
  console.log('Saved inspect-racing-chase-racing.png');

  // 5. Automated race drive for 15 seconds to verify lap progression
  console.log('Driving through circuit for lap progression test...');
  for (let step = 0; step < 30; step++) {
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(500);
  }
  await page.keyboard.up('KeyW');

  const statusText = await page.evaluate(() => {
    return document.getElementById('demo-hint')?.innerText || '';
  });
  console.log(`Race status after driving: ${statusText}`);

  await browser.close();
  server.close();
  console.log('Inspection complete!');
}

main().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
