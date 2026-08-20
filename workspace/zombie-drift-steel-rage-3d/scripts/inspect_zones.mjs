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
      console.log('Server running on port 4173');
      resolve(server);
    });
  });
}

async function run() {
  const server = await startServer();

  console.log('Launching Playwright Chromium with GPU hardware acceleration & 50% CPU limit...');
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

  // 50% CPU throttle via CDP
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });

  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Click Play
  const playBtn = page.locator('button:has-text("В БОЙ"), button:has-text("ИГРАТЬ"), #btn-play, .btn-play');
  if (await playBtn.count() > 0) {
    await playBtn.first().click();
  }

  await page.waitForTimeout(1000);

  async function snapshotZone(x, z, filename) {
    await page.evaluate(({ px, pz }) => {
      const g = window['game'];
      if (g && g.playerCar) {
        g.playerCar.physics.position.set(px, 0, pz);
        g.playerCar.physics.velocity.set(0, 0, 0);
        g.playerCar.currentHealth = 100;
        if (g.renderer && g.renderer.cameraController) {
          g.renderer.cameraController.update(0.1, g.playerCar.physics.position, g.playerCar.physics.velocity, false, 0);
        }
      }
    }, { px: x, pz: z });

    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotsDir, filename) });
    console.log(`Captured ${filename}`);
  }

  // 1. Central Roundabout Plaza
  await snapshotZone(0, 0, 'zone_01_center_roundabout.png');

  // 2. North-East Industrial Machine Shop (Car approaching from entrance)
  await snapshotZone(38, 64, 'zone_02_north_east_machine_shop.png');

  // 3. North-West Shipping Container Fortress
  await snapshotZone(-42, 62, 'zone_03_north_west_container_fort.png');

  // 4. South-East Chemical Refinery & Silos
  await snapshotZone(38, -44, 'zone_04_south_east_refinery_silos.png');

  // 5. South-West Military Sandbag Bunker
  await snapshotZone(-45, -35, 'zone_05_south_west_military_bunker.png');

  // 6. West Highway Gas Station & Diner
  await snapshotZone(-50, -12, 'zone_06_west_gas_station_diner.png');

  // 7. East Scrap Junkyard & Crane
  await snapshotZone(50, 30, 'zone_07_east_scrap_junkyard.png');

  // 8. North Highway Gateway Checkpoint
  await snapshotZone(0, 48, 'zone_08_north_gateway.png');

  // Performance validation
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

  console.log('Performance Metrics (50% CPU limit + GPU):', fpsStats);

  await browser.close();
  server.close();
  console.log('All Zone Snapshots Captured!');
}

run().catch((e) => {
  console.error('Zone inspection failed:', e);
  process.exit(1);
});
