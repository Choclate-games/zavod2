import { EntityManager } from '../entities/EntityManager';
import { Player, PlayerInputState } from '../entities/Player';
import { BALANCE } from '../balance';
import { AudioManager } from '../audio/AudioManager';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { SceneManager } from '../rendering/SceneManager';
import { EventBus } from '../core/EventBus';

export class CombatSystem {
  private entities: EntityManager;
  private player: Player;
  private particles: ParticleSystem;
  private sceneManager: SceneManager;

  public reactorHp = 1000;
  public maxReactorHp = 1000;

  constructor(entities: EntityManager, player: Player, particles: ParticleSystem, sceneManager: SceneManager) {
    this.entities = entities;
    this.player = player;
    this.particles = particles;
    this.sceneManager = sceneManager;
  }

  public update(input: PlayerInputState, dt: number): void {
    // 1. Бросок сигнального фаера [Q]
    if (input.throwFlarePressed) {
      this.throwFlare();
    }

    // 2. Силовой пневмо-удар клепальником [V]
    if (input.meleeBashPressed && this.player.meleeCooldown <= 0) {
      this.performMeleeBash();
    }

    // 3. Полевой ремонт бруствера клепальником (удержание ЛКМ / кнопки ремонта)
    if (input.isRiveting) {
      this.performRivetRepair(dt);
    }

    // 4. Проверка урона по реактору от прорвавшихся зомби
    for (const p of this.entities.parapets) {
      if (p.hp <= 0) {
        // Сектор пробит: урон передается напрямую реактору
        this.reactorHp = Math.max(0, this.reactorHp - 25 * dt);
        EventBus.emit('REACTOR_HP_CHANGED', { hp: this.reactorHp, maxHp: this.maxReactorHp });
      }
    }
  }

  private throwFlare(): void {
    AudioManager.playTurretShoot();

    // Направление взгляда игрока
    const sin = Math.sin(this.player.yaw);
    const cos = Math.cos(this.player.yaw);
    const targetX = this.player.position.x - sin * BALANCE.detonation.dalnost_broska_signalnogo_faera;
    const targetZ = this.player.position.z - cos * BALANCE.detonation.dalnost_broska_signalnogo_faera;

    EventBus.emit('TOAST_SHOW', { message: 'Сигнальный термо-фаер брошен в сектор!', type: 'info' });

    // Проверка попадания по бочкам
    for (const barrel of this.entities.barrels) {
      if (!barrel.active) continue;
      const dist = Math.hypot(targetX - barrel.x, targetZ - barrel.z);
      if (dist < 4.0) {
        this.detonateBarrel(barrel);
      }
    }
  }

  public detonateBarrel(barrel: { id: number; type: 'cryo' | 'diesel'; x: number; y: number; z: number; hp: number; active: boolean; meshGroup: any }): void {
    if (!barrel.active) return;
    barrel.active = false;
    barrel.meshGroup.visible = false;

    AudioManager.playExplosion();
    this.sceneManager.addTrauma(0.5);

    const isCryo = barrel.type === 'cryo';
    this.particles.spawnExplosion(barrel.x, 0.5, barrel.z, isCryo);

    EventBus.emit('BARREL_DETONATED', {
      type: barrel.type,
      position: { x: barrel.x, y: 0.5, z: barrel.z },
    });

    // Поражение зомби в радиусе 6.0 м
    for (const z of this.entities.zombies) {
      if (!z.active) continue;
      const dist = Math.hypot(z.x - barrel.x, z.z - barrel.z);
      if (dist <= BALANCE.detonation.radius_porazheniya_krio_bochki) {
        if (isCryo) {
          z.isFrozen = true;
          z.freezeTimer = BALANCE.detonation.dlitelnost_zamorozki_mutantov_freeze_stun;
          z.hp -= 150;
        } else {
          // Дизельная бочка: термо-шок по замороженным
          const damage = z.isFrozen ? BALANCE.detonation.uron_ot_termicheskogo_shoka_kombo_krio_dizel : 400;
          z.hp -= damage;
        }

        if (z.hp <= 0) {
          z.active = false;
          this.entities.scrap += 25;
          EventBus.emit('SCRAP_CHANGED', this.entities.scrap);
          EventBus.emit('ENEMY_KILLED', {
            type: z.type,
            scrapReward: 25,
            position: { x: z.x, y: z.y, z: z.z },
          });
        }
      }
    }

    // Вторичная цепная детонация соседних бочек через задержку
    setTimeout(() => {
      for (const other of this.entities.barrels) {
        if (other.active && Math.hypot(other.x - barrel.x, other.z - barrel.z) <= 7.0) {
          this.detonateBarrel(other);
        }
      }
    }, 120);
  }

  private performMeleeBash(): void {
    this.player.meleeCooldown = BALANCE.repair.kuldaun_silovogo_pnevmo_udara;
    AudioManager.playExplosion();
    this.sceneManager.addTrauma(0.35);

    this.particles.spawnRepairSparks(
      this.player.position.x,
      this.player.position.y - 0.3,
      this.player.position.z - 1.0
    );

    // Отталкивание зомби в радиусе 3.5 м
    for (const z of this.entities.zombies) {
      if (!z.active) continue;
      const dist = Math.hypot(z.x - this.player.position.x, z.z - this.player.position.z);
      if (dist <= BALANCE.repair.radius_pnevmo_udara) {
        z.z -= 4.5; // Отброс назад
        z.hp -= 80;
        if (z.hp <= 0) {
          z.active = false;
          this.entities.scrap += 15;
          EventBus.emit('SCRAP_CHANGED', this.entities.scrap);
        }
      }
    }

    EventBus.emit('TOAST_SHOW', { message: 'Пневмо-удар: орда отброшена!', type: 'info' });
  }

  private performRivetRepair(dt: number): void {
    // Поиск ближайшей поврежденной секции бруствера (дистанция < 1.8 м)
    for (const p of this.entities.parapets) {
      const dist = Math.hypot(this.player.position.x - p.x, this.player.position.z - p.z);
      if (dist < 1.8 && p.hp < p.maxHp) {
        if (this.entities.scrap >= 2) {
          p.hp = Math.min(p.maxHp, p.hp + BALANCE.repair.skorost_remonta_klepalnikom * dt);
          this.entities.scrap = Math.max(0, this.entities.scrap - (BALANCE.repair.rashod_skrapa_na_remont * dt));
          EventBus.emit('SCRAP_CHANGED', Math.round(this.entities.scrap));

          AudioManager.playRivetRepair();
          this.particles.spawnRepairSparks(p.x, 0.8, p.z);
        }
      }
    }
  }

  public reset(): void {
    this.reactorHp = this.maxReactorHp;
    EventBus.emit('REACTOR_HP_CHANGED', { hp: this.reactorHp, maxHp: this.maxReactorHp });
  }
}
