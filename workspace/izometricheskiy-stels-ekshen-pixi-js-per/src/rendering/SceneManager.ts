/**
 * PixiJS v8 Isometric Scene Manager & Dynamic Night Lighting
 */

import * as PIXI from 'pixi.js';
import { SpriteFactory, ParticlePool } from './MeshPool';
import { Palette, LightSource } from './Shaders';

export class SceneManager {
  public app: PIXI.Application;
  public stage: PIXI.Container;

  // Layers
  public groundContainer: PIXI.Container;
  public runeContainer: PIXI.Container;
  public entityContainer: PIXI.Container;
  public fxContainer: PIXI.Container;
  public lightingContainer: PIXI.Container;

  // Pools & FX
  public particlePool!: ParticlePool;
  private lightGraphics!: PIXI.Graphics;

  // Camera
  public cameraX = 0;
  public cameraY = 0;
  public targetX = 0;
  public targetY = 0;
  public cameraZoom = 1.0;

  // Screen shake & hitstop
  private trauma = 0;
  private hitstopTimer = 0;

  // Map limits
  public readonly mapWidth = 2400;
  public readonly mapHeight = 2400;

  constructor() {
    this.app = new PIXI.Application();
    this.stage = this.app.stage;

    this.groundContainer = new PIXI.Container();
    this.runeContainer = new PIXI.Container();
    this.entityContainer = new PIXI.Container();
    this.fxContainer = new PIXI.Container();
    this.lightingContainer = new PIXI.Container();

    this.stage.addChild(this.groundContainer);
    this.stage.addChild(this.runeContainer);
    this.stage.addChild(this.entityContainer);
    this.stage.addChild(this.fxContainer);
    this.stage.addChild(this.lightingContainer);
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    await this.app.init({
      canvas,
      resizeTo: window,
      backgroundColor: Palette.nightSky,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 1.5),
      powerPreference: 'high-performance',
      antialias: true,
    });

    await SpriteFactory.generateAllTextures(this.app);

    this.particlePool = new ParticlePool(
      this.fxContainer,
      SpriteFactory.getTexture('particle'),
      400
    );

    // Dark forest ambient darkness layer with cutout blend
    this.lightGraphics = new PIXI.Graphics();
    this.lightingContainer.addChild(this.lightGraphics);

    this.buildGround();
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
  }

  private buildGround(): void {
    this.groundContainer.removeChildren();
    const g = new PIXI.Graphics();

    // Base dark forest mossy turf
    const tileSize = 64;
    const cols = Math.ceil(this.mapWidth / tileSize);
    const rows = Math.ceil(this.mapHeight / tileSize);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = c * tileSize - this.mapWidth / 2;
        const wy = r * tileSize - this.mapHeight / 2;
        const iso = this.worldToIso(wx, wy);

        // Pseudorandom organic grass patch variation
        const hash = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
        const rand = hash - Math.floor(hash);

        let color: number = Palette.forestGround;
        if (rand > 0.75) color = Palette.grassLight;
        else if (rand > 0.45) color = Palette.groundPath;

        g.poly([
          iso.x, iso.y - 16,
          iso.x + 32, iso.y,
          iso.x, iso.y + 16,
          iso.x - 32, iso.y,
        ]);
        g.fill({ color, alpha: 0.95 });
        g.stroke({ color: 0x0e170c, width: 1, alpha: 0.3 });
      }
    }

    this.groundContainer.addChild(g);
  }

  /**
   * Isometric projection: (x, y) -> (isoX, isoY)
   */
  worldToIso(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - y) * 0.866,
      y: (x + y) * 0.5,
    };
  }

  /**
   * Screen coordinate to World space
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const halfW = this.app.screen.width / 2;
    const halfH = this.app.screen.height / 2;

    const isoX = (screenX - halfW) / this.cameraZoom + this.cameraX;
    const isoY = (screenY - halfH) / this.cameraZoom + this.cameraY;

    // Inverse isometric projection
    const x = (isoX / 0.866 + isoY / 0.5) / 2;
    const y = (isoY / 0.5 - isoX / 0.866) / 2;

    return { x, y };
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  applyHitstop(durationSec = 0.04): void {
    this.hitstopTimer = durationSec;
  }

  update(dt: number, lightSources: LightSource[]): void {
    // Hitstop freeze
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    // Camera follow with smooth lerp
    const isoTarget = this.worldToIso(this.targetX, this.targetY);
    this.cameraX += (isoTarget.x - this.cameraX) * 0.1;
    this.cameraY += (isoTarget.y - this.cameraY) * 0.1;

    // Screen shake
    let shakeX = 0;
    let shakeY = 0;
    if (this.trauma > 0) {
      const shakePower = this.trauma * this.trauma * 16;
      shakeX = (Math.random() * 2 - 1) * shakePower;
      shakeY = (Math.random() * 2 - 1) * shakePower;
      this.trauma = Math.max(0, this.trauma - dt * 2.0);
    }

    const halfW = this.app.screen.width / 2;
    const halfH = this.app.screen.height / 2;

    const stageX = halfW - (this.cameraX + shakeX) * this.cameraZoom;
    const stageY = halfH - (this.cameraY + shakeY) * this.cameraZoom;

    this.groundContainer.position.set(stageX, stageY);
    this.runeContainer.position.set(stageX, stageY);
    this.entityContainer.position.set(stageX, stageY);
    this.fxContainer.position.set(stageX, stageY);

    this.groundContainer.scale.set(this.cameraZoom);
    this.runeContainer.scale.set(this.cameraZoom);
    this.entityContainer.scale.set(this.cameraZoom);
    this.fxContainer.scale.set(this.cameraZoom);

    // Y-sorting for all entities
    this.entityContainer.children.sort((a, b) => a.y - b.y);

    // Update particles
    this.particlePool.update(dt);

    // Dynamic Night Lighting & Fog Mask
    this.renderLighting(lightSources, stageX, stageY);
  }

  private renderLighting(lightSources: LightSource[], stageX: number, stageY: number): void {
    this.lightGraphics.clear();

    const sw = this.app.screen.width;
    const sh = this.app.screen.height;

    // Base ambient darkness
    this.lightGraphics.rect(0, 0, sw, sh);
    this.lightGraphics.fill({ color: Palette.nightSky, alpha: 0.76 });

    // Cutout circles for light sources
    for (let i = 0; i < lightSources.length; i++) {
      const src = lightSources[i];
      const iso = this.worldToIso(src.x, src.y);
      const screenX = stageX + iso.x * this.cameraZoom;
      const screenY = stageY + iso.y * this.cameraZoom;
      const radius = src.radius * this.cameraZoom;

      // Soft light halo
      this.lightGraphics.circle(screenX, screenY, radius * 1.3);
      this.lightGraphics.fill({ color: 0x384d2f, alpha: 0.15 * src.intensity });

      // Core light illumination cutout
      this.lightGraphics.circle(screenX, screenY, radius);
      this.lightGraphics.fill({ color: 0xfff9c4, alpha: 0.28 * src.intensity });

      this.lightGraphics.circle(screenX, screenY, radius * 0.5);
      this.lightGraphics.fill({ color: 0xffffff, alpha: 0.4 * src.intensity });
    }
  }

  onResize(): void {
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
  }

  destroy(): void {
    this.app.destroy(true, { children: true, texture: true });
  }
}
