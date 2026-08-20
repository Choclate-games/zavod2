/**
 * Procedural Forest Generation, Night Cycle & Enemy Spawning Waves
 */

import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import { PhysicsWorld, CollisionCategory } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import { TorchInstance, HidingBushInstance, SaltCircleInstance, CollectibleInstance } from '../entities/Weapon';
import { Enemy, EnemyType } from '../entities/Enemy';
import { SpriteFactory } from '../rendering/MeshPool';
import { eventBus } from '../core/EventBus';

export interface TreeObstacle {
  x: number;
  y: number;
  type: 'tree_birch' | 'tree_pine';
  sprite: PIXI.Sprite;
  body: Matter.Body;
}

export class WaveManager {
  public currentNight = 1;
  public nightTimer = 0;
  public readonly nightDuration = 45; // 45s per night
  public isNightActive = false;
  public totalKills = 0;

  // World objects
  public trees: TreeObstacle[] = [];
  public bushes: HidingBushInstance[] = [];
  public torches: TorchInstance[] = [];
  public saltCircles: SaltCircleInstance[] = [];
  public collectibles: CollectibleInstance[] = [];
  public enemies: Enemy[] = [];

  constructor(
    private physics: PhysicsWorld,
    private sceneManager: SceneManager
  ) {}

  generateForest(): void {
    this.clearAll();

    const w = this.sceneManager.mapWidth;
    const h = this.sceneManager.mapHeight;

    // 1. Boundary Tree Walls
    const borderTrees = 40;
    for (let i = 0; i < borderTrees; i++) {
      const t = (i / borderTrees) * Math.PI * 2;
      const r = w * 0.46 + (Math.random() * 2 - 1) * 40;
      this.spawnTree(Math.cos(t) * r, Math.sin(t) * r, i % 2 === 0 ? 'tree_pine' : 'tree_birch');
    }

    // 2. Inner Forest Clusters
    const numInnerTrees = 36;
    for (let i = 0; i < numInnerTrees; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 140 + Math.random() * (w * 0.38);
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      this.spawnTree(tx, ty, Math.random() > 0.4 ? 'tree_pine' : 'tree_birch');
    }

    // 3. Hiding Bushes
    const numBushes = 22;
    for (let i = 0; i < numBushes; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * (w * 0.36);
      const bx = Math.cos(angle) * dist;
      const by = Math.sin(angle) * dist;
      const bush = new HidingBushInstance(
        `bush_${i}`,
        bx,
        by,
        this.physics,
        this.sceneManager.entityContainer
      );
      this.bushes.push(bush);
    }

    // 4. Birch Torch Stands
    const numTorches = 10;
    for (let i = 0; i < numTorches; i++) {
      const angle = (i * Math.PI * 2) / numTorches;
      const dist = 220 + (i % 2 === 0 ? 80 : 0);
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      const torch = new TorchInstance(
        `torch_${i}`,
        tx,
        ty,
        this.physics,
        this.sceneManager.entityContainer
      );
      this.torches.push(torch);
    }

    // 5. Initial Herb Nodes
    const numHerbs = 12;
    for (let i = 0; i < numHerbs; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 100 + Math.random() * (w * 0.35);
      this.spawnCollectible('herb', Math.cos(angle) * dist, Math.sin(angle) * dist, 1);
    }
  }

  private spawnTree(x: number, y: number, type: 'tree_birch' | 'tree_pine'): void {
    const sprite = new PIXI.Sprite(SpriteFactory.getTexture(type));
    sprite.anchor.set(0.5, 0.9);
    this.sceneManager.entityContainer.addChild(sprite);

    const body = Matter.Bodies.circle(x, y, 16, {
      isStatic: true,
      collisionFilter: {
        category: CollisionCategory.OBSTACLE,
        mask: CollisionCategory.PLAYER | CollisionCategory.ENEMY,
      },
    });
    this.physics.addBody(body);

    this.trees.push({ x, y, type, sprite, body });
  }

  spawnCollectible(type: 'herb' | 'coin', x: number, y: number, value = 1): void {
    const item = new CollectibleInstance(
      `drop_${Date.now()}_${Math.random()}`,
      type,
      x,
      y,
      value,
      this.physics,
      this.sceneManager.runeContainer
    );
    this.collectibles.push(item);
  }

  spawnSaltCircle(x: number, y: number, radius = 140): SaltCircleInstance {
    const circle = new SaltCircleInstance(
      `salt_${Date.now()}_${Math.random()}`,
      x,
      y,
      radius,
      35,
      this.physics,
      this.sceneManager.runeContainer
    );
    return circle;
  }

  startNight(nightIndex: number): void {
    this.currentNight = nightIndex;
    this.nightTimer = this.nightDuration;
    this.isNightActive = true;

    // Clear old dead enemies
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].destroy(this.physics);
    }
    this.enemies.length = 0;

    // Spawn wave composition
    let numWisps = 3 + nightIndex * 2;
    let numWolves = 1 + nightIndex;
    const isBossNight = nightIndex >= 3;

    if (isBossNight) {
      this.spawnEnemy('leshy', 0, -320);
    }

    for (let i = 0; i < numWisps; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 280 + Math.random() * 400;
      this.spawnEnemy('wisp', Math.cos(angle) * dist, Math.sin(angle) * dist);
    }

    for (let i = 0; i < numWolves; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 320 + Math.random() * 400;
      this.spawnEnemy('wolf', Math.cos(angle) * dist, Math.sin(angle) * dist);
    }

    eventBus.emit('wave:start', {
      waveIndex: nightIndex,
      title: isBossNight ? `НОЧЬ ${nightIndex}: ЯВЛЕНИЕ ЛЕШЕГО` : `НОЧЬ ${nightIndex}: ТЕНИ ЛЕСА`,
      enemyCount: this.enemies.length,
    });
    eventBus.emit('audio:sfx', { name: isBossNight ? 'leshy_roar' : 'wisp_alert' });
  }

  private spawnEnemy(type: EnemyType, x: number, y: number): void {
    const enemy = new Enemy(
      `enemy_${Date.now()}_${Math.random()}`,
      type,
      x,
      y,
      this.physics,
      this.sceneManager.entityContainer
    );
    this.enemies.push(enemy);
  }

  update(
    dt: number,
    playerX: number,
    playerY: number,
    isPlayerHidden: boolean
  ): void {
    // 1. Update Torches
    for (let i = 0; i < this.torches.length; i++) {
      this.torches[i].update(dt);
      const iso = this.sceneManager.worldToIso(this.torches[i].x, this.torches[i].y);
      this.torches[i].sprite.position.set(iso.x, iso.y);
    }

    // 2. Update Salt Circles
    for (let i = this.saltCircles.length - 1; i >= 0; i--) {
      const sc = this.saltCircles[i];
      const alive = sc.update(dt);
      const iso = this.sceneManager.worldToIso(sc.x, sc.y);
      sc.sprite.position.set(iso.x, iso.y);
      if (!alive) {
        sc.destroy(this.physics);
        this.saltCircles.splice(i, 1);
      }
    }

    // 3. Update Bushes & Trees Positions
    for (let i = 0; i < this.bushes.length; i++) {
      const b = this.bushes[i];
      const iso = this.sceneManager.worldToIso(b.x, b.y);
      b.sprite.position.set(iso.x, iso.y);
    }

    for (let i = 0; i < this.trees.length; i++) {
      const t = this.trees[i];
      const iso = this.sceneManager.worldToIso(t.x, t.y);
      t.sprite.position.set(iso.x, iso.y);
    }

    // 4. Update Collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const item = this.collectibles[i];
      const alive = item.update(dt, playerX, playerY);
      const iso = this.sceneManager.worldToIso(item.x, item.y);
      item.sprite.position.set(iso.x, iso.y);

      if (!alive) {
        // Player collected item!
        if (item.type === 'herb') {
          eventBus.emit('action:collect_herb', { x: item.x, y: item.y, amount: item.value });
          eventBus.emit('audio:sfx', { name: 'herb' });
          eventBus.emit('ui:fct', {
            text: `🌿 +${item.value} Трава`,
            x: item.x,
            y: item.y - 20,
            color: '#76ff03',
          });
        } else {
          eventBus.emit('audio:sfx', { name: 'coin' });
          eventBus.emit('ui:fct', {
            text: `🪙 +${item.value}`,
            x: item.x,
            y: item.y - 20,
            color: '#ffd54f',
          });
        }
        item.destroy(this.physics);
        this.collectibles.splice(i, 1);
      }
    }

    // 5. Update Enemies
    const obstacleBodies = this.trees.map((t) => t.body);
    let activeEnemies = 0;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.isDead) {
        this.totalKills++;
        this.spawnCollectible('coin', enemy.body.position.x, enemy.body.position.y, enemy.type === 'leshy' ? 10 : 2);
        enemy.destroy(this.physics);
        this.enemies.splice(i, 1);
        continue;
      }

      activeEnemies++;
      enemy.update(
        dt,
        playerX,
        playerY,
        isPlayerHidden,
        this.torches,
        this.saltCircles,
        obstacleBodies,
        this.physics
      );

      const iso = this.sceneManager.worldToIso(enemy.body.position.x, enemy.body.position.y);
      enemy.sprite.position.set(iso.x, iso.y);
    }

    // 6. Night Timer & Dawn Condition
    if (this.isNightActive) {
      this.nightTimer -= dt;
      if (this.nightTimer <= 0 || activeEnemies === 0) {
        this.isNightActive = false;
        const rewardCoins = 15 + this.currentNight * 10;
        eventBus.emit('wave:dawn', { waveIndex: this.currentNight });
        eventBus.emit('wave:clear', { waveIndex: this.currentNight, rewardCoins });
        eventBus.emit('audio:sfx', { name: 'dawn' });
      }
    }
  }

  clearAll(): void {
    for (let i = 0; i < this.trees.length; i++) this.physics.removeBody(this.trees[i].body);
    this.trees.length = 0;

    for (let i = 0; i < this.bushes.length; i++) this.bushes[i].destroy(this.physics);
    this.bushes.length = 0;

    for (let i = 0; i < this.torches.length; i++) this.torches[i].destroy(this.physics);
    this.torches.length = 0;

    for (let i = 0; i < this.saltCircles.length; i++) this.saltCircles[i].destroy(this.physics);
    this.saltCircles.length = 0;

    for (let i = 0; i < this.collectibles.length; i++) this.collectibles[i].destroy(this.physics);
    this.collectibles.length = 0;

    for (let i = 0; i < this.enemies.length; i++) this.enemies[i].destroy(this.physics);
    this.enemies.length = 0;
  }
}
