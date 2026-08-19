import { Container, Graphics } from 'pixi.js';

export class LightingOverlay {
  public container: Container;
  private gfx: Graphics;

  constructor() {
    this.container = new Container();
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  public update(playerX: number, playerY: number, screenW: number, screenH: number, depth: number): void {
    this.gfx.clear();

    // Dark underground tint
    const darknessAlpha = Math.min(0.75, 0.2 + (depth / 1500) * 0.55);
    
    // Draw dark overlay covering viewport around player
    const viewLeft = playerX - screenW;
    const viewTop = playerY - screenH;
    const viewW = screenW * 2;
    const viewH = screenH * 2;

    this.gfx.rect(viewLeft, viewTop, viewW, viewH);
    this.gfx.fill({ color: 0x05070d, alpha: darknessAlpha });

    // Headlight cone from drill front
    this.gfx.poly([
      { x: playerX - 18, y: playerY + 30 },
      { x: playerX + 18, y: playerY + 30 },
      { x: playerX + 160, y: playerY + 380 },
      { x: playerX - 160, y: playerY + 380 },
    ]);
    this.gfx.fill({ color: 0xfffae0, alpha: 0.18 });

    // Inner bright core cone
    this.gfx.poly([
      { x: playerX - 10, y: playerY + 30 },
      { x: playerX + 10, y: playerY + 30 },
      { x: playerX + 80, y: playerY + 260 },
      { x: playerX - 80, y: playerY + 260 },
    ]);
    this.gfx.fill({ color: 0xffffff, alpha: 0.22 });

    // Radial aura around drill
    this.gfx.circle(playerX, playerY, 90);
    this.gfx.fill({ color: 0x00f0ff, alpha: 0.08 });
  }

  public clear(): void {
    this.gfx.clear();
  }
}
