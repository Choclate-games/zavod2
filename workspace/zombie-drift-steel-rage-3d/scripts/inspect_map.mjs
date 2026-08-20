import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const screenshotsDir = path.join(projectRoot, 'test-screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

function startServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mp3',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
  };

  const distDir = path.join(projectRoot, 'dist');
  const server = http.createServer((req, res) => {
    let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Server error');
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
        });
        res.end(content);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(4173, '127.0.0.1', () => {
      console.log('Test server running at http://127.0.0.1:4173');
      resolve(server);
    });
  });
}

async function run() {
  const server = await startServer();

  console.log('Launching Chromium with GPU acceleration and 50% CPU limit...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--enable-gpu',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--enable-accelerated-2d-canvas',
      '--enable-accelerated-video-decode',
      '--disable-software-rasterizer',
      '--renderer-process-limit=1',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // Enforce 50% CPU limit via CDP session
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('Browser Error:', msg.text());
    }
  });

  console.log('Navigating to game...');
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  // Click Play
  const playBtn = page.locator('button:has-text("В БОЙ"), button:has-text("ИГРАТЬ"), #btn-play, .btn-play');
  if (await playBtn.count() > 0) {
    await playBtn.first().click();
  } else {
    await page.keyboard.press('Space');
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '01_spawn_center_roundabout.png') });
  console.log('Captured 01_spawn_center_roundabout.png');

  // 1. Accelerate straight North up North Highway
  console.log('Accelerating North up North Highway...');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(screenshotsDir, '02_north_highway.png') });

  // 2. Turn right into North-East Machine Shop Plaza
  console.log('Turning into North-East Machine Shop...');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(screenshotsDir, '03_machine_shop_plaza.png') });

  // 3. Drift South towards East Junkyard
  console.log('Drifting towards East Junkyard Compound...');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1400);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(screenshotsDir, '04_east_junkyard_compound.png') });

  // 4. Nitro Boost South to Chemical Refinery & Silos
  console.log('Nitro boosting South to Refinery Silos...');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('ShiftLeft'); // Nitro
  await page.waitForTimeout(1800);
  await page.keyboard.up('ShiftLeft');
  await page.screenshot({ path: path.join(screenshotsDir, '05_south_refinery_silos.png') });

  // 5. Turn West towards Gas Station
  console.log('Driving West to Highway Gas Station & Diner...');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(screenshotsDir, '06_west_gas_station_diner.png') });

  // 6. Return to Central Roundabout and do a continuous 360 drift
  console.log('Entering Central Roundabout for 360 drift...');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: path.join(screenshotsDir, '07_central_roundabout_drift.png') });

  // Measure WebGL FPS & Frame Stats
  const fpsStats = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      function count() {
        frames++;
        if (performance.now() - start < 1000) {
          requestAnimationFrame(count);
        } else {
          resolve({
            fps: frames,
            elapsedMs: performance.now() - start,
          });
        }
      }
      requestAnimationFrame(count);
    });
  });

  console.log('Measured FPS (at 50% CPU limit + GPU):', fpsStats);

  await browser.close();
  server.close();
  console.log('Map Inspection Tour Complete!');
}

run().catch((e) => {
  console.error('Inspection script failed:', e);
  process.exit(1);
});
