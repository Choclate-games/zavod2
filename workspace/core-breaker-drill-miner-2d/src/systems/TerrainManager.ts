import * as Matter from 'matter-js';
import { Game } from '../core/Game.ts';
import { TerrainTile } from '../rendering/layers/TerrainLayer.ts';
import { eventBus } from '../core/EventBus.ts';

const TILE_SIZE = 32;
const CHUNK_WIDTH = 24;
const CHUNK_HEIGHT = 32;

export class TerrainManager {
  private readonly game: Game;
  private tiles = new Map<string, TerrainTile>();
  private bodies = new Map<string, Matter.Body>();
  private lowestY = 0;
  private generatedChunks = 0;

  constructor(game: Game) {
    this.game = game;
  }

  init(): void {
    this.reset();
  }

  reset(): void {
    for (const body of this.bodies.values()) {
      this.game.physics.removeBody(body);
    }
    this.tiles.clear();
    this.bodies.clear();
    this.lowestY = 0;
    this.generatedChunks = 0;
    this.generateChunk(0);
    this.carveTunnel(0, 0, 80);
    this.syncRenderer();
  }

  update(_dt: number): void {
    const playerY = this.game.player.getPosition().y;
    while (playerY + 800 > this.lowestY) {
      this.generateChunk(this.lowestY);
    }
    this.cleanup(playerY);
  }

  drillAt(x: number, y: number, dt: number): void {
    const key = this.keyAt(x, y);
    const tile = this.tiles.get(key);
    if (!tile) return;
    const damage = 80 * dt;
    tile.hp -= damage;
    eventBus.emit('camera:shake', 1);
    eventBus.emit('terrain:drilled', { x, y });
    if (tile.hp <= 0) {
      this.removeTile(key);
    }
  }

  isSolidAt(x: number, y: number): boolean {
    return this.tiles.has(this.keyAt(x, y));
  }

  getTiles(): TerrainTile[] {
    return Array.from(this.tiles.values());
  }

  private generateChunk(startY: number): void {
    const halfW = Math.floor(CHUNK_WIDTH / 2);
    for (let row = 0; row < CHUNK_HEIGHT; row++) {
      const y = startY + row * TILE_SIZE + TILE_SIZE * 0.5;
      for (let col = -halfW; col < halfW; col++) {
        const x = col * TILE_SIZE + TILE_SIZE * 0.5;
        const key = `${Math.floor(x)},${Math.floor(y)}`;
        if (this.tiles.has(key)) continue;
        const depthFactor = Math.min(1, Math.abs(y) / 1000);
        const hp = 40 + depthFactor * 160;
        const color = this.biomeColor(Math.abs(y));
        const tile: TerrainTile = { x, y, width: TILE_SIZE, height: TILE_SIZE, hp, maxHp: hp, color };
        this.tiles.set(key, tile);
        this.createBody(key, tile);
      }
    }
    this.lowestY = startY + CHUNK_HEIGHT * TILE_SIZE;
    this.generatedChunks++;
  }

  carveTunnel(cx: number, cy: number, radius: number): void {
    const keysToRemove: string[] = [];
    for (const [key, tile] of this.tiles) {
      const dx = tile.x - cx;
      const dy = tile.y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      this.removeTile(key);
    }
  }

  private createBody(key: string, tile: TerrainTile): void {
    const body = Matter.Bodies.rectangle(tile.x, tile.y, tile.width, tile.height, {
      isStatic: true,
      friction: 0.8,
      label: 'terrain'
    });
    this.bodies.set(key, body);
    this.game.physics.addBody(body);
  }

  private removeTile(key: string): void {
    const tile = this.tiles.get(key);
    const body = this.bodies.get(key);
    if (tile) this.spawnOreFromTile(tile);
    if (body) {
      this.game.physics.removeBody(body);
      this.bodies.delete(key);
    }
    this.tiles.delete(key);
    this.syncRenderer();
  }

  private cleanup(playerY: number): void {
    const limit = playerY - 1200;
    for (const [key, tile] of this.tiles) {
      if (tile.y < limit) {
        const body = this.bodies.get(key);
        if (body) {
          this.game.physics.removeBody(body);
          this.bodies.delete(key);
        }
        this.tiles.delete(key);
      }
    }
    this.syncRenderer();
  }

  private biomeColor(depth: number): number {
    if (depth < 200) return 0xd4a574;
    if (depth < 500) return 0x8b6f47;
    if (depth < 1000) return 0x5a4a6a;
    if (depth < 1500) return 0x3a2a4a;
    return 0x2a1a3a;
  }

  private keyAt(x: number, y: number): string {
    const tx = Math.floor(x / TILE_SIZE) * TILE_SIZE + TILE_SIZE * 0.5;
    const ty = Math.floor(y / TILE_SIZE) * TILE_SIZE + TILE_SIZE * 0.5;
    return `${tx},${ty}`;
  }

  private spawnOreFromTile(tile: TerrainTile): void {
    const depth = Math.abs(tile.y);
    let type: 'coal' | 'copper' | 'titanium' | 'plasma' | 'diamond' = 'coal';
    const roll = Math.random();
    if (depth > 1200 && roll < 0.05) type = 'diamond';
    else if (depth > 800 && roll < 0.15) type = 'plasma';
    else if (depth > 500 && roll < 0.3) type = 'titanium';
    else if (depth > 200 && roll < 0.5) type = 'copper';
    eventBus.emit('ore:spawn', { x: tile.x, y: tile.y, type });
  }

  private syncRenderer(): void {
    this.game.renderer.getTerrainLayer().setTiles(this.getTiles());
  }
}
