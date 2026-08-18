import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { TextureFactory } from './TextureFactory';
import { eventBus } from '../core/EventBus';

interface Particle {
  active: boolean;
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  scaleStart: number;
  scaleEnd: number;
  alphaStart: number;
  alphaEnd: number;
}

interface FloatingText {
  active: boolean;
  textObj: Text;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
}

export class VFXSystem {
  private container: Container;
  private shockwaveGraphics: Graphics;

  // Particle pool
  private readonly MAX_PARTICLES = 250;
  private particles: Particle[] = [];

  // Floating text pool
  private readonly MAX_TEXTS = 30;
  private texts: FloatingText[] = [];

  // Shockwaves
  private shockwaves: { x: number; y: number; radius: number; maxRadius: number; life: number; color: number }[] = [];

  // Screen shake
  public shakeIntensity = 0;
  public shakeDuration = 0;
  public shakeOffsetX = 0;
  public shakeOffsetY = 0;

  constructor(parentContainer: Container) {
    this.container = new Container();
    this.shockwaveGraphics = new Graphics();
    this.container.addChild(this.shockwaveGraphics);
    parentContainer.addChild(this.container);

    this.initPools();
    this.setupListeners();
  }

  private initPools(): void {
    // Particle pool
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      const sprite = new Sprite(TextureFactory.getVFXTexture('spark'));
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.container.addChild(sprite);

      this.particles.push({
        active: false,
        sprite,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        scaleStart: 1,
        scaleEnd: 0,
        alphaStart: 1,
        alphaEnd: 0
      });
    }

    // Text pool
    const style = new TextStyle({
      fontFamily: 'Segoe UI, sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: '#55eeff',
      stroke: { color: '#000000', width: 3 },
      dropShadow: {
        alpha: 0.8,
        angle: Math.PI / 6,
        blur: 4,
        color: '#000000',
        distance: 2
      }
    });

    for (let i = 0; i < this.MAX_TEXTS; i++) {
      const textObj = new Text({ text: '', style });
      textObj.anchor.set(0.5);
      textObj.visible = false;
      this.container.addChild(textObj);

      this.texts.push({
        active: false,
        textObj,
        x: 0,
        y: 0,
        vy: -35,
        life: 0,
        maxLife: 1
      });
    }
  }

  private setupListeners(): void {
    eventBus.on('vfx:explosion', (payload) => {
      this.spawnExplosion(payload.x, payload.y, payload.radius, payload.color);
    });

    eventBus.on('vfx:sparks', (payload) => {
      this.spawnSparks(payload.x, payload.y, payload.count, payload.color);
    });

    eventBus.on('vfx:text', (payload) => {
      this.spawnFloatingText(payload.text, payload.x, payload.y, payload.color);
    });

    eventBus.on('camera:shake', (payload) => {
      this.triggerShake(payload.intensity, payload.durationMs);
    });
  }

  public triggerShake(intensity: number, durationMs: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = durationMs / 1000;
  }

  public spawnSparks(x: number, y: number, count = 5, color?: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;

      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0;
      p.maxLife = 0.25 + Math.random() * 0.2;
      p.scaleStart = 0.8;
      p.scaleEnd = 0.1;
      p.alphaStart = 1;
      p.alphaEnd = 0;
      p.sprite.texture = TextureFactory.getVFXTexture('spark');
      p.sprite.tint = color || 0xffffaa;
      p.sprite.visible = true;
    }
  }

  public spawnExplosion(x: number, y: number, radius = 80, color = 0xffaa00): void {
    // Shockwave ring
    this.shockwaves.push({
      x,
      y,
      radius: 5,
      maxRadius: radius,
      life: 1.0,
      color
    });

    // Sparks & acid droplets
    for (let i = 0; i < 20; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;

      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0;
      p.maxLife = 0.4 + Math.random() * 0.4;
      p.scaleStart = 1.2;
      p.scaleEnd = 0.2;
      p.alphaStart = 1;
      p.alphaEnd = 0;
      p.sprite.texture = Math.random() < 0.5 ? TextureFactory.getVFXTexture('acid') : TextureFactory.getVFXTexture('spark');
      p.sprite.tint = color;
      p.sprite.visible = true;
    }
  }

  public spawnFloatingText(text: string, x: number, y: number, color = '#55eeff'): void {
    const t = this.getFreeText();
    if (!t) return;

    t.active = true;
    t.textObj.text = text;
    t.textObj.style.fill = color;
    t.x = x;
    t.y = y;
    t.life = 0;
    t.maxLife = 1.0;
    t.vy = -40;
    t.textObj.visible = true;
  }

  public update(dt: number): void {
    // Screen shake update
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      this.shakeOffsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeOffsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      if (this.shakeDuration <= 0) {
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }
    }

    // Particles update
    for (const p of this.particles) {
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }

      const progress = p.life / p.maxLife;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;

      const scale = p.scaleStart + (p.scaleEnd - p.scaleStart) * progress;
      const alpha = p.alphaStart + (p.alphaEnd - p.alphaStart) * progress;

      p.sprite.position.set(p.x, p.y);
      p.sprite.scale.set(scale);
      p.sprite.alpha = alpha;
    }

    // Floating texts update
    for (const t of this.texts) {
      if (!t.active) continue;

      t.life += dt;
      if (t.life >= t.maxLife) {
        t.active = false;
        t.textObj.visible = false;
        continue;
      }

      const progress = t.life / t.maxLife;
      t.y += t.vy * dt;

      t.textObj.position.set(t.x, t.y);
      t.textObj.alpha = 1.0 - progress * 0.8;
      t.textObj.scale.set(1.0 + progress * 0.15);
    }

    // Shockwaves render
    this.shockwaveGraphics.clear();
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt * 2.5;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      const progress = 1.0 - sw.life;
      sw.radius = sw.maxRadius * progress;

      this.shockwaveGraphics.circle(sw.x, sw.y, sw.radius);
      this.shockwaveGraphics.stroke({
        width: 3 * sw.life,
        color: sw.color,
        alpha: sw.life * 0.8
      });
    }
  }

  private getFreeParticle(): Particle | null {
    return this.particles.find((p) => !p.active) || null;
  }

  private getFreeText(): FloatingText | null {
    return this.texts.find((t) => !t.active) || null;
  }
}
