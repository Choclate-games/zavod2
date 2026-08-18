import { Container, Graphics } from 'pixi.js';

export interface TerrainTile {
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  color: number;
}

export class TerrainLayer {
  readonly container = new Container();
  private readonly gfx: Graphics;
  private tiles = new Map<string, TerrainTile>();

  constructor() {
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  setTiles(tiles: TerrainTile[]): void {
    this.tiles.clear();
    for (const t of tiles) {
      this.tiles.set(`${Math.floor(t.x)},${Math.floor(t.y)}`, t);
    }
    this.draw();
  }

  updateTiles(tiles: TerrainTile[]): void {
    for (const t of tiles) {
      this.tiles.set(`${Math.floor(t.x)},${Math.floor(t.y)}`, t);
    }
    this.draw();
  }

  removeTiles(keys: string[]): void {
    for (const k of keys) this.tiles.delete(k);
    this.draw();
  }

  clear(): void {
    this.tiles.clear();
    this.gfx.clear();
  }

  private draw(): void {
    this.gfx.clear();
    for (const t of this.tiles.values()) {
      const alpha = 0.4 + 0.6 * (t.hp / t.maxHp);
      this.gfx.rect(t.x - t.width * 0.5, t.y - t.height * 0.5, t.width, t.height);
      this.gfx.fill({ color: t.color, alpha });
      this.gfx.stroke({ color: 0x000000, width: 1, alpha: 0.3 });
    }
  }
}
