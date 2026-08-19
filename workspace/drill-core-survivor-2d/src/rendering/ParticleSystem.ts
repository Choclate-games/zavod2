import { Container, Sprite, Texture } from 'pixi.js';
import { TextureGenerator } from './TextureGenerator';

export interface Particle {
  sprite: Sprite;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  rotationSpeed: number;
  scaleSpeed: number;
  alphaSpeed: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private static instance: ParticleSystem;
  public container: Container;
  private pool: Particle[] = [];
  private readonly POOL_SIZE = 600;

  public static getInstance(): ParticleSystem {
    if (!ParticleSystem.instance) {
      ParticleSystem.instance = new ParticleSystem();
    }
    return ParticleSystem.instance;
  }

  constructor() {
    this.container = new Container();
  }

  public init(): void {
    // Pre-allocate full pool of sprites
    const sparkTex = TextureGenerator.get('fx_spark');
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const sprite = new Sprite(sparkTex);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.container.addChild(sprite);

      this.pool.push({
        sprite,
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        gravity: 0,
        rotationSpeed: 0,
        scaleSpeed: 0,
        alphaSpeed: 0,
        life: 0,
        maxLife: 1,
      });
    }
  }

  private getFreeParticle(): Particle | null {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      if (!this.pool[i].active) {
        return this.pool[i];
      }
    }
    return null;
  }

  public emitSparks(x: number, y: number, count: number = 8, dirAngle: number = -Math.PI / 2): void {
    const tex = TextureGenerator.get('fx_spark');
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      const spread = (Math.random() - 0.5) * 1.2;
      const angle = dirAngle + spread;
      const speed = 120 + Math.random() * 220;

      p.sprite.texture = tex;
      p.sprite.visible = true;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.gravity = 180;
      p.rotationSpeed = 0;
      p.scaleSpeed = -1.2;
      p.alphaSpeed = -2.5;
      p.life = 0;
      p.maxLife = 0.25 + Math.random() * 0.2;

      p.sprite.scale.set(0.8 + Math.random() * 0.6);
      p.sprite.alpha = 1.0;
      p.sprite.position.set(x, y);
    }
  }

  public emitDebris(x: number, y: number, count: number = 6): void {
    const tex = TextureGenerator.get('fx_debris');
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;

      p.sprite.texture = tex;
      p.sprite.visible = true;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 60;
      p.gravity = 350;
      p.rotationSpeed = (Math.random() - 0.5) * 12;
      p.scaleSpeed = -0.3;
      p.alphaSpeed = -1.2;
      p.life = 0;
      p.maxLife = 0.5 + Math.random() * 0.3;

      p.sprite.scale.set(0.7 + Math.random() * 0.6);
      p.sprite.alpha = 1.0;
      p.sprite.rotation = Math.random() * Math.PI * 2;
      p.sprite.position.set(x, y);
    }
  }

  public emitExplosion(x: number, y: number, isBig: boolean = false): void {
    // 1. Shockwave ring
    const sw = this.getFreeParticle();
    if (sw) {
      sw.sprite.texture = TextureGenerator.get('fx_shockwave');
      sw.sprite.visible = true;
      sw.active = true;
      sw.x = x;
      sw.y = y;
      sw.vx = 0;
      sw.vy = 0;
      sw.gravity = 0;
      sw.rotationSpeed = 0;
      sw.scaleSpeed = isBig ? 6.0 : 4.0;
      sw.alphaSpeed = isBig ? -2.0 : -3.5;
      sw.life = 0;
      sw.maxLife = 0.35;
      sw.sprite.scale.set(0.1);
      sw.sprite.alpha = 1.0;
      sw.sprite.position.set(x, y);
    }

    // 2. Smoke puffs
    const smokeCount = isBig ? 12 : 6;
    const smokeTex = TextureGenerator.get('fx_smoke');
    for (let i = 0; i < smokeCount; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 90;

      p.sprite.texture = smokeTex;
      p.sprite.visible = true;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.gravity = -20; // rises slightly
      p.rotationSpeed = (Math.random() - 0.5) * 4;
      p.scaleSpeed = 1.2;
      p.alphaSpeed = -1.4;
      p.life = 0;
      p.maxLife = 0.5 + Math.random() * 0.3;

      p.sprite.scale.set(0.4 + Math.random() * 0.4);
      p.sprite.alpha = 0.8;
      p.sprite.position.set(x, y);
    }

    // 3. Dense sparks
    this.emitSparks(x, y, isBig ? 24 : 14);
    this.emitDebris(x, y, isBig ? 16 : 8);
  }

  public update(dtSeconds: number): void {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life += dtSeconds;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }

      // Physics update
      p.vy += p.gravity * dtSeconds;
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;

      // Transform update
      p.sprite.position.set(p.x, p.y);
      p.sprite.rotation += p.rotationSpeed * dtSeconds;

      const currentScale = Math.max(0, p.sprite.scale.x + p.scaleSpeed * dtSeconds);
      p.sprite.scale.set(currentScale);

      const currentAlpha = Math.max(0, p.sprite.alpha + p.alphaSpeed * dtSeconds);
      p.sprite.alpha = currentAlpha;
    }
  }

  public clear(): void {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      this.pool[i].active = false;
      this.pool[i].sprite.visible = false;
    }
  }
}

export const particleSystem = ParticleSystem.getInstance();
