import { Game } from '../core/Game.ts';
import { Enemy, EnemyType } from '../entities/Enemy.ts';
import { Boss } from '../entities/Boss.ts';
import { Ore, OreType } from '../entities/Ore.ts';
import { Particle } from '../rendering/layers/VfxLayer.ts';
import { eventBus } from '../core/EventBus.ts';

export class CombatSystem {
  private readonly game: Game;
  private enemies: Enemy[] = [];
  private ores: Ore[] = [];
  private particles: Particle[] = [];
  private boss: Boss | null = null;
  private readonly enemyLayer;

  constructor(game: Game) {
    this.game = game;
    this.enemyLayer = game.renderer.getEntityLayer();
    eventBus.on('enemy:died', (pos: { x: number; y: number; type: EnemyType }) => this.onEnemyDied(pos));
    eventBus.on('ore:spawn', (data: { x: number; y: number; type: OreType }) => this.spawnOre(data.x, data.y, 1, data.type));
    eventBus.on('terrain:drilled', (pos: { x: number; y: number }) => this.spawnDrillParticles(pos));
  }

  reset(): void {
    for (const e of this.enemies) e.destroy();
    for (const o of this.ores) o.collect();
    this.boss?.destroy();
    this.enemies = [];
    this.ores = [];
    this.particles = [];
    this.boss = null;
  }

  update(dt: number): void {
    for (const e of this.enemies) e.update(dt);
    for (const o of this.ores) o.update(dt);

    this.enemies = this.enemies.filter((e) => e.isAlive());
    this.ores = this.ores.filter((o) => o.isAlive());

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    this.renderEntities();
    this.game.renderer.getVfxLayer().render(this.game.lasers.getBeams(), this.particles);
  }

  spawnEnemy(type: EnemyType, x: number, y: number): void {
    const enemy = new Enemy(this.game, type, x, y);
    enemy.getBody().plugin = { ...enemy.getBody().plugin, entity: enemy };
    this.enemies.push(enemy);
  }

  spawnBoss(x: number, y: number): void {
    if (this.boss) return;
    this.boss = new Boss(this.game, x, y);
    this.boss.getBody().plugin = { ...this.boss.getBody().plugin, entity: this.boss };
  }

  spawnOre(x: number, y: number, count: number, forcedType?: OreType): void {
    for (let i = 0; i < count; i++) {
      const type = forcedType ?? this.randomOreType();
      const ox = x + (Math.random() - 0.5) * 24;
      const oy = y + (Math.random() - 0.5) * 24;
      const ore = new Ore(this.game, type, ox, oy);
      this.ores.push(ore);
    }
  }

  spawnDrillParticles(pos: { x: number; y: number }): void {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: pos.x,
        y: pos.y,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        color: 0xffaa00,
        size: 2 + Math.random() * 2
      });
    }
  }

  getEnemies(): Enemy[] {
    return this.enemies;
  }

  getBoss(): Boss | null {
    return this.boss;
  }

  getParticles(): Particle[] {
    return this.particles;
  }

  private onEnemyDied(pos: { x: number; y: number; type: EnemyType }): void {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: pos.x,
        y: pos.y,
        vx: (Math.random() - 0.5) * 250,
        vy: (Math.random() - 0.5) * 250,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        color: 0xff5555,
        size: 2 + Math.random() * 3
      });
    }
  }

  private randomOreType(): OreType {
    const r = Math.random();
    if (r < 0.5) return 'coal';
    if (r < 0.8) return 'copper';
    if (r < 0.95) return 'titanium';
    return 'plasma';
  }

  private renderEntities(): void {
    const visuals = [];
    for (const e of this.enemies) {
      visuals.push({
        id: `enemy-${e.getBody().id}`,
        x: e.getPosition().x,
        y: e.getPosition().y,
        radius: e.getRadius(),
        color: e.getColor(),
        angle: 0,
        alpha: 1
      });
    }
    for (const o of this.ores) {
      visuals.push({
        id: `ore-${o.getBody().id}`,
        x: o.getPosition().x,
        y: o.getPosition().y,
        radius: o.getRadius(),
        color: o.getColor(),
        angle: 0,
        alpha: 1
      });
    }
    if (this.boss?.isAlive()) {
      visuals.push({
        id: 'boss',
        x: this.boss.getPosition().x,
        y: this.boss.getPosition().y,
        radius: this.boss.getRadius(),
        color: 0xff0055,
        angle: 0,
        alpha: 1
      });
    }
    const p = this.game.player;
    visuals.push({
      id: 'player',
      x: p.getPosition().x,
      y: p.getPosition().y,
      radius: p.getRadius(),
      color: 0x00aaff,
      angle: p.getAngle(),
      alpha: 1
    });
    this.enemyLayer.render(visuals);
  }
}
