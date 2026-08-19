import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { ParticleSystem, particleSystem } from './ParticleSystem';
import { LightingOverlay } from './LightingOverlay';
import { TextureGenerator } from './TextureGenerator';

export class SceneManager {
  private static instance: SceneManager;
  public app: Application;
  public worldContainer: Container;

  // Layer containers
  public backgroundLayer: Container;
  public terrainLayer: Container;
  public dropLayer: Container;
  public enemiesLayer: Container;
  public playerLayer: Container;
  public vfxLayer: Container;
  public lightingOverlay: LightingOverlay;

  // Parallax background elements
  private bgGraphics: Graphics;

  // Camera & Screen Shake
  public cameraX: number = 0;
  public cameraY: number = 0;
  private shakeTrauma: number = 0;
  private shakeOffset: { x: number; y: number } = { x: 0, y: 0 };
  private zoomScale: number = 1.0;
  private targetZoom: number = 1.0;

  public static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  constructor() {
    this.app = new Application();
    this.worldContainer = new Container();

    this.backgroundLayer = new Container();
    this.terrainLayer = new Container();
    this.dropLayer = new Container();
    this.enemiesLayer = new Container();
    this.playerLayer = new Container();
    this.vfxLayer = new Container();
    this.lightingOverlay = new LightingOverlay();
    this.bgGraphics = new Graphics();
  }

  public async init(containerElement: HTMLElement): Promise<void> {
    await this.app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x0d0e15,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      antialias: true,
      powerPreference: 'high-performance',
      resizeTo: window,
    });

    containerElement.appendChild(this.app.canvas);

    // Initialize procedural textures and particle pool
    TextureGenerator.init();
    particleSystem.init();

    // Assemble world layer hierarchy
    this.backgroundLayer.addChild(this.bgGraphics);
    this.vfxLayer.addChild(particleSystem.container);

    this.worldContainer.addChild(this.backgroundLayer);
    this.worldContainer.addChild(this.terrainLayer);
    this.worldContainer.addChild(this.dropLayer);
    this.worldContainer.addChild(this.enemiesLayer);
    this.worldContainer.addChild(this.playerLayer);
    this.worldContainer.addChild(this.vfxLayer);
    this.worldContainer.addChild(this.lightingOverlay.container);

    this.app.stage.addChild(this.worldContainer);

    window.addEventListener('resize', () => this.onResize());
  }

  private onResize(): void {
    if (this.app.renderer) {
      this.app.renderer.resize(window.innerWidth, window.innerHeight);
    }
  }

  public addTrauma(amount: number): void {
    this.shakeTrauma = Math.min(1.0, this.shakeTrauma + amount);
  }

  public setZoom(zoom: number): void {
    this.targetZoom = zoom;
  }

  public update(dtSeconds: number, targetX: number, targetY: number, currentDepth: number): void {
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;

    // Smooth camera lerp following player
    const lerpSpeed = 8.0;
    this.cameraX += (targetX - this.cameraX) * Math.min(1, dtSeconds * lerpSpeed);
    this.cameraY += (targetY - this.cameraY) * Math.min(1, dtSeconds * lerpSpeed);

    // Smooth zoom interpolation
    this.zoomScale += (this.targetZoom - this.zoomScale) * Math.min(1, dtSeconds * 6.0);

    // Trauma-based Screen Shake calculation
    if (this.shakeTrauma > 0) {
      const shakePower = Math.pow(this.shakeTrauma, 2);
      const maxShake = 22 * shakePower;
      this.shakeOffset.x = (Math.random() * 2 - 1) * maxShake;
      this.shakeOffset.y = (Math.random() * 2 - 1) * maxShake;
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dtSeconds * 1.8);
    } else {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
    }

    // Apply camera transform to world container (center player vertically in upper-middle area)
    const viewCenterX = screenW * 0.5;
    const viewCenterY = screenH * 0.38;

    this.worldContainer.scale.set(this.zoomScale);
    this.worldContainer.position.set(
      viewCenterX - this.cameraX * this.zoomScale + this.shakeOffset.x,
      viewCenterY - this.cameraY * this.zoomScale + this.shakeOffset.y
    );

    // Update parallax background
    this.updateBackground(this.cameraY, screenW, screenH);

    // Update dynamic headlights & lighting
    this.lightingOverlay.update(targetX, targetY, screenW, screenH, currentDepth);

    // Update VFX Particles
    particleSystem.update(dtSeconds);
  }

  private updateBackground(camY: number, screenW: number, screenH: number): void {
    this.bgGraphics.clear();

    const top = camY - screenH;
    const bot = camY + screenH * 2;
    const left = -400;
    const right = 1200;

    // Base dark strata
    this.bgGraphics.rect(left, top, right - left, bot - top);
    this.bgGraphics.fill({ color: 0x0a0c14 });

    // Vertical parallax shaft pillars & pipes
    for (let y = Math.floor(top / 120) * 120; y < bot; y += 120) {
      // Left wall support beams
      this.bgGraphics.rect(left, y, 40, 16);
      this.bgGraphics.fill({ color: 0x181e2b, alpha: 0.7 });

      // Right wall support beams
      this.bgGraphics.rect(760, y + 40, 40, 16);
      this.bgGraphics.fill({ color: 0x181e2b, alpha: 0.7 });
    }

    // Glowing magma / crystal fissures in background
    for (let y = Math.floor(top / 300) * 300; y < bot; y += 300) {
      const fissureY = y + 100;
      this.bgGraphics.rect(left + 80, fissureY, 600, 3);
      this.bgGraphics.fill({ color: 0x00f0ff, alpha: 0.15 });
    }
  }

  public clearScene(): void {
    this.terrainLayer.removeChildren();
    this.dropLayer.removeChildren();
    this.enemiesLayer.removeChildren();
    this.playerLayer.removeChildren();
    particleSystem.clear();
    this.lightingOverlay.clear();
    this.shakeTrauma = 0;
  }
}

export const sceneManager = SceneManager.getInstance();
