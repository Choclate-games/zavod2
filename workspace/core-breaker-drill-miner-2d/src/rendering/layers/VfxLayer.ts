import { Container, Graphics } from 'pixi.js';

export interface LaserBeam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: number;
  width: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}

export class VfxLayer {
  readonly container = new Container();
  private readonly gfx: Graphics;

  constructor() {
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  render(beams: LaserBeam[], particles: Particle[]): void {
    this.gfx.clear();
    for (const b of beams) {
      this.gfx.moveTo(b.x1, b.y1);
      this.gfx.lineTo(b.x2, b.y2);
      this.gfx.stroke({ color: b.color, width: b.width, alpha: 0.9 });
      this.gfx.circle(b.x2, b.y2, b.width * 1.5);
      this.gfx.fill({ color: b.color, alpha: 0.5 });
    }
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      this.gfx.circle(p.x, p.y, p.size);
      this.gfx.fill({ color: p.color, alpha });
    }
  }
}
