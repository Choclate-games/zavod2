import { Container, Graphics } from 'pixi.js';

export interface EntityVisual {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: number;
  alpha?: number;
}

export class EntityLayer {
  readonly container = new Container();
  private readonly gfx: Graphics;

  constructor() {
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  render(entities: EntityVisual[]): void {
    this.gfx.clear();
    for (const e of entities) {
      this.gfx.circle(e.x, e.y, e.radius);
      this.gfx.fill({ color: e.color, alpha: e.alpha ?? 1 });
      this.gfx.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
    }
  }
}
