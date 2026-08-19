import { Block, BlockType, BLOCK_CONFIGS } from '../entities/Block';
import { DropItem } from '../entities/DropItem';
import { particleSystem } from '../rendering/ParticleSystem';
import { audioManager } from '../audio/AudioManager';
import { sceneManager } from '../rendering/SceneManager';
import { gameState } from '../core/GameState';

export interface Chunk {
  chunkIndex: number;
  startY: number;
  blocks: Block[];
}

export class ChunkManager {
  public static readonly COLS = 10;
  public static readonly BLOCK_SIZE = 48;
  public static readonly CHUNK_ROWS = 14;

  public activeChunks: Map<number, Chunk> = new Map();
  public destroyedBlocksCount: number = 0;

  constructor() {}

  public init(): void {
    this.clear();
    // Pre-generate initial 4 chunks (0m to ~400m)
    for (let i = 0; i < 4; i++) {
      this.generateChunk(i);
    }
  }

  public update(playerY: number, drops: DropItem[]): void {
    const currentChunkIdx = Math.floor(playerY / (ChunkManager.CHUNK_ROWS * ChunkManager.BLOCK_SIZE));

    // Generate upcoming chunks ahead of player
    for (let i = currentChunkIdx - 1; i <= currentChunkIdx + 3; i++) {
      if (i >= 0 && !this.activeChunks.has(i)) {
        this.generateChunk(i);
      }
    }

    // Clean up old chunks far above player (> 1200px above)
    for (const [idx, chunk] of this.activeChunks.entries()) {
      if (chunk.startY + ChunkManager.CHUNK_ROWS * ChunkManager.BLOCK_SIZE < playerY - 1000) {
        this.destroyChunk(idx);
      }
    }
  }

  private generateChunk(chunkIdx: number): void {
    const startRow = chunkIdx * ChunkManager.CHUNK_ROWS;
    const chunkBlocks: Block[] = [];
    const depthMeters = Math.floor((startRow * ChunkManager.BLOCK_SIZE) / 25);

    // Guaranteed path column (carves a passable path through the chunk)
    const guaranteedCol = Math.floor(Math.sin(chunkIdx * 1.7) * 3 + 4.5);

    for (let r = 0; r < ChunkManager.CHUNK_ROWS; r++) {
      const gridY = startRow + r;
      for (let gridX = 0; gridX < ChunkManager.COLS; gridX++) {
        // Skip some blocks in the start area (0-50m) to allow player a clean drop start
        if (gridY < 4) continue;

        const type = this.determineBlockType(gridX, gridY, depthMeters, guaranteedCol);
        if (type !== null) {
          const block = new Block(gridX, gridY, type);
          chunkBlocks.push(block);
        }
      }
    }

    this.activeChunks.set(chunkIdx, {
      chunkIndex: chunkIdx,
      startY: startRow * ChunkManager.BLOCK_SIZE,
      blocks: chunkBlocks,
    });
  }

  private determineBlockType(gridX: number, gridY: number, depthMeters: number, pathCol: number): BlockType | null {
    // Leave some empty caves on the path
    if (Math.abs(gridX - pathCol) <= 1 && Math.random() < 0.25 && gridY > 6) {
      return null;
    }

    const rand = Math.random();

    // Biome 0: Basalt (0 - 300m)
    if (depthMeters < 300) {
      if (rand < 0.08) return 'tnt';
      if (rand < 0.18) return 'ore_gold';
      if (rand < 0.26) return 'ore_crystal';
      if (rand < 0.65) return 'basalt';
      return 'granite';
    }
    // Biome 1: Crystal Caverns (300 - 700m)
    else if (depthMeters < 700) {
      if (rand < 0.07) return 'tnt';
      if (rand < 0.16) return 'cryo';
      if (rand < 0.32) return 'ore_crystal';
      if (rand < 0.44) return 'ore_gold';
      if (rand < 0.78) return 'granite';
      return 'obsidian';
    }
    // Biome 2: Magma Abyss (700 - 1200m)
    else if (depthMeters < 1200) {
      if (rand < 0.10) return 'tnt';
      if (rand < 0.28) return 'magma';
      if (rand < 0.45) return 'ore_crystal';
      if (rand < 0.55) return 'ore_gold';
      return 'obsidian';
    }
    // Biome 3: Bio-Hive / Core (1200m+)
    else {
      if (rand < 0.12) return 'tnt';
      if (rand < 0.25) return 'magma';
      if (rand < 0.38) return 'cryo';
      if (rand < 0.60) return 'ore_crystal';
      return 'obsidian';
    }
  }

  public getBlocksInRadius(x: number, y: number, radius: number): Block[] {
    const result: Block[] = [];
    const rSq = radius * radius;

    for (const chunk of this.activeChunks.values()) {
      for (const b of chunk.blocks) {
        if (b.isDestroyed) continue;
        const dx = b.x - x;
        const dy = b.y - y;
        if (dx * dx + dy * dy <= rSq) {
          result.push(b);
        }
      }
    }
    return result;
  }

  public damageBlock(block: Block, damage: number, drops: DropItem[]): void {
    if (block.isDestroyed) return;

    const destroyed = block.takeDamage(damage);
    particleSystem.emitSparks(block.x, block.y, 4);

    if (destroyed) {
      this.destroyedBlocksCount++;
      gameState.runStats.blocksDestroyed++;
      particleSystem.emitDebris(block.x, block.y, 6);
      audioManager.playRockCrumble(BLOCK_CONFIGS[block.type]?.hardness || 1);

      // Handle TNT explosive cascade
      if (block.type === 'tnt') {
        this.triggerTntExplosion(block.x, block.y, drops);
      }
      // Handle Cryo freeze burst
      else if (block.type === 'cryo') {
        particleSystem.emitExplosion(block.x, block.y, false);
        audioManager.playDraftAppear();
      }
      // Drops
      else if (block.type === 'ore_gold') {
        drops.push(new DropItem(block.x, block.y, 'gold'));
        drops.push(new DropItem(block.x, block.y, 'gold'));
      } else if (block.type === 'ore_crystal') {
        drops.push(new DropItem(block.x, block.y, 'crystal'));
        drops.push(new DropItem(block.x, block.y, 'crystal'));
        if (Math.random() < 0.3) drops.push(new DropItem(block.x, block.y, 'crystal'));
      } else {
        if (Math.random() < 0.15) drops.push(new DropItem(block.x, block.y, 'crystal'));
      }

      block.destroy();
    }
  }

  public triggerTntExplosion(x: number, y: number, drops: DropItem[]): void {
    sceneManager.addTrauma(0.65);
    particleSystem.emitExplosion(x, y, true);
    audioManager.playExplosion(true);

    const radius = 140;
    const nearby = this.getBlocksInRadius(x, y, radius);
    for (const b of nearby) {
      if (!b.isDestroyed) {
        this.damageBlock(b, 500, drops);
      }
    }
  }

  private destroyChunk(chunkIdx: number): void {
    const chunk = this.activeChunks.get(chunkIdx);
    if (chunk) {
      for (const b of chunk.blocks) {
        if (!b.isDestroyed) {
          b.destroy();
        }
      }
      this.activeChunks.delete(chunkIdx);
    }
  }

  public clear(): void {
    for (const chunkIdx of Array.from(this.activeChunks.keys())) {
      this.destroyChunk(chunkIdx);
    }
    this.activeChunks.clear();
    this.destroyedBlocksCount = 0;
  }
}
