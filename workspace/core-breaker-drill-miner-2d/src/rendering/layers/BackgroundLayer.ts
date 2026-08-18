import { Container, Graphics } from 'pixi.js';

export class BackgroundLayer {
  readonly container = new Container();
  private readonly gfx: Graphics;
  private width = 0;
  private height = 0;

  constructor() {
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.draw();
  }

  private draw(): void {
    this.gfx.clear();
    this.gfx.rect(0, 0, this.width, this.height);
    this.gfx.fill({ color: 0x0a0a12 });

    for (let i = 0; i < 80; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const r = 1 + Math.random() * 2;
      this.gfx.circle(x, y, r);
      this.gfx.fill({ color: 0x222233, alpha: 0.4 });
    }
  }
}
