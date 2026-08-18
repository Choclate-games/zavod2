import { Application, Container, Text } from 'pixi.js';
import { BackgroundLayer } from './layers/BackgroundLayer.ts';
import { TerrainLayer } from './layers/TerrainLayer.ts';
import { EntityLayer } from './layers/EntityLayer.ts';
import { VfxLayer } from './layers/VfxLayer.ts';

export class Renderer {
  app!: Application;
  readonly world = new Container();
  readonly camera = new Container();
  private background: BackgroundLayer;
  private terrain: TerrainLayer;
  private entities: EntityLayer;
  private vfx: VfxLayer;
  private targetPos = { x: 0, y: 0 };
  private shake = 0;
  private readonly hudDepth: Text;
  private readonly hudOre: Text;

  constructor() {
    this.background = new BackgroundLayer();
    this.terrain = new TerrainLayer();
    this.entities = new EntityLayer();
    this.vfx = new VfxLayer();
    this.hudDepth = new Text({ text: '0 m', style: { fontFamily: 'monospace', fontSize: 18, fill: 0xffffff } });
    this.hudOre = new Text({ text: '0 ore', style: { fontFamily: 'monospace', fontSize: 18, fill: 0xffd700 } });
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      canvas,
      resizeTo: window,
      backgroundColor: 0x0a0a12,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
      powerPreference: 'high-performance'
    });

    this.app.stage.addChild(this.world);
    this.world.addChild(this.camera);
    this.camera.addChild(this.background.container);
    this.camera.addChild(this.terrain.container);
    this.camera.addChild(this.entities.container);
    this.camera.addChild(this.vfx.container);

    this.hudDepth.position.set(16, 16);
    this.hudOre.position.set(16, 42);
    this.app.stage.addChild(this.hudDepth);
    this.app.stage.addChild(this.hudOre);

    window.addEventListener('resize', () => this.onResize());
    this.onResize();
  }

  getApp(): Application {
    return this.app;
  }

  getTerrainLayer(): TerrainLayer {
    return this.terrain;
  }

  getEntityLayer(): EntityLayer {
    return this.entities;
  }

  getVfxLayer(): VfxLayer {
    return this.vfx;
  }

  cameraFollow(pos: { x: number; y: number }): void {
    this.targetPos.x = pos.x;
    this.targetPos.y = pos.y;
  }

  addScreenShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  render(_alpha: number): void {
    if (!this.app) return;
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    const cx = this.targetPos.x;
    const cy = this.targetPos.y + h * 0.3;

    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    this.camera.position.set(w * 0.5 - cx + sx, h * 0.5 - cy + sy);

    this.shake *= 0.9;
    if (this.shake < 0.5) this.shake = 0;
  }

  private onResize(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.background.resize(w, h);
  }

  updateHud(depth: number, ore: number): void {
    this.hudDepth.text = `${Math.floor(depth)} m`;
    this.hudOre.text = `${ore} ore`;
  }
}
