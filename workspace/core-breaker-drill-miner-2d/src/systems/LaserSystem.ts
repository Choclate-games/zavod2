import { Game } from '../core/Game.ts';
import { Enemy } from '../entities/Enemy.ts';
import { Boss } from '../entities/Boss.ts';
import { LaserBeam } from '../rendering/layers/VfxLayer.ts';
import { eventBus } from '../core/EventBus.ts';

const LASER_RANGE = 320;
const BASE_DAMAGE = 12;
const FIRE_RATE = 0.25;

export class LaserSystem {
  private readonly game: Game;
  private cooldown = 0;
  private beams: LaserBeam[] = [];
  private ricochets = 2;
  private chainBonus = 0;

  constructor(game: Game) {
    this.game = game;
  }

  update(dt: number): void {
    this.beams = [];
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      const target = this.findTarget();
      if (target) {
        this.fireAt(target);
        this.cooldown = FIRE_RATE;
      }
    }
    this.game.renderer.getVfxLayer().render(this.beams, []);
  }

  setRicochets(value: number): void {
    this.ricochets = value;
  }

  setChainBonus(value: number): void {
    this.chainBonus = value;
  }

  getBeams(): LaserBeam[] {
    return this.beams;
  }

  private findTarget(): Enemy | Boss | null {
    const pos = this.game.player.getPosition();
    let best: Enemy | Boss | null = null;
    let bestDist = Infinity;
    for (const enemy of this.game.combat.getEnemies()) {
      const d = Math.hypot(enemy.getPosition().x - pos.x, enemy.getPosition().y - pos.y);
      if (d < LASER_RANGE && d < bestDist) {
        best = enemy;
        bestDist = d;
      }
    }
    if (this.game.combat.getBoss()?.isAlive()) {
      const boss = this.game.combat.getBoss()!;
      const d = Math.hypot(boss.getPosition().x - pos.x, boss.getPosition().y - pos.y);
      if (d < LASER_RANGE && d < bestDist) {
        best = boss;
      }
    }
    return best;
  }

  private fireAt(target: Enemy | Boss): void {
    const origin = this.game.player.getPosition();
    const targetPos = target.getPosition();
    let from = { ...origin };
    let dir = { x: targetPos.x - origin.x, y: targetPos.y - origin.y };
    const len = Math.hypot(dir.x, dir.y);
    if (len === 0) return;
    dir = { x: dir.x / len, y: dir.y / len };

    let damage = BASE_DAMAGE + this.chainBonus;
    const color = 0x00ffaa;

    for (let i = 0; i <= this.ricochets; i++) {
      const hit = this.raycast(from, dir);
      if (!hit) break;
      this.beams.push({ x1: from.x, y1: from.y, x2: hit.point.x, y2: hit.point.y, color, width: 3 + i });
      this.dealDamage(hit.body, damage);
      damage *= 0.8;

      const tileKey = this.game.terrain.isSolidAt(hit.point.x, hit.point.y);
      if (tileKey) {
        const normal = hit.normal;
        dir = this.reflect(dir, normal);
        from = { x: hit.point.x + dir.x * 2, y: hit.point.y + dir.y * 2 };
      } else {
        break;
      }
    }

    eventBus.emit('audio:laser');
  }

  private raycast(from: { x: number; y: number }, dir: { x: number; y: number }) {
    const end = { x: from.x + dir.x * LASER_RANGE, y: from.y + dir.y * LASER_RANGE };
    const hits = this.game.physics.raycast(from, end);
    let best: { point: { x: number; y: number }; normal: { x: number; y: number }; body: Matter.Body } | null = null;
    let bestT = Infinity;
    for (const h of hits) {
      if (!h.body) continue;
      const t = Math.hypot(h.point.x - from.x, h.point.y - from.y);
      if (t < bestT) {
        bestT = t;
        best = { point: h.point, normal: h.normal ?? { x: -dir.x, y: -dir.y }, body: h.body };
      }
    }
    return best;
  }

  private reflect(dir: { x: number; y: number }, normal: { x: number; y: number }): { x: number; y: number } {
    const dot = dir.x * normal.x + dir.y * normal.y;
    return {
      x: dir.x - 2 * dot * normal.x,
      y: dir.y - 2 * dot * normal.y
    };
  }

  private dealDamage(body: Matter.Body, damage: number): void {
    const entity = body.plugin?.entity;
    if (entity instanceof Enemy) {
      entity.takeDamage(damage);
    } else if (entity instanceof Boss) {
      entity.takeDamage(damage);
    }
  }
}
