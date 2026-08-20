// src/systems/UpgradeManager.ts
// Roguelite 3-Card drafting system with rarities, stat modifiers and synergies

import { UpgradeCard, CardRarity, PlayerStats } from '../core/GameState';
import { player } from '../entities/Player';
import { eventBus } from '../core/EventBus';

export class UpgradeManager {
  private static instance: UpgradeManager;
  private cardCatalog: UpgradeCard[] = [];
  public rerollsLeft = 2;

  private constructor() {
    this.initCatalog();
  }

  public static getInstance(): UpgradeManager {
    if (!UpgradeManager.instance) {
      UpgradeManager.instance = new UpgradeManager();
    }
    return UpgradeManager.instance;
  }

  private initCatalog(): void {
    this.cardCatalog = [
      // COMMON
      {
        id: 'armor_plating',
        name: 'Бронеплиты Корпуса',
        desc: '+25 к максимальной прочности меха и мгновенный ремонт',
        icon: '🛡️',
        rarity: 'common',
        apply: (stats: PlayerStats) => {
          stats.maxHp += 25;
          stats.currentHp = Math.min(stats.maxHp, stats.currentHp + 25);
        },
      },
      {
        id: 'overclock_cannons',
        name: 'Разгон Сервоприводов',
        desc: '+15% к скорострельности орудий меха',
        icon: '⚡',
        rarity: 'common',
        apply: (stats: PlayerStats) => {
          stats.attackSpeedMultiplier += 0.15;
        },
      },
      {
        id: 'heavy_munitions',
        name: 'Усиленные Снаряды',
        desc: '+15% к урону всех пушек меха',
        icon: '💥',
        rarity: 'common',
        apply: (stats: PlayerStats) => {
          stats.damageMultiplier += 0.15;
        },
      },
      {
        id: 'servo_boost',
        name: 'Турбо-Приводы Шасси',
        desc: '+12% к скорости передвижения меха',
        icon: '🚀',
        rarity: 'common',
        apply: (stats: PlayerStats) => {
          stats.speed *= 1.12;
        },
      },
      {
        id: 'nanite_magnet',
        name: 'Магнитный Захват',
        desc: '+30% к радиусу притягивания металлолома',
        icon: '🧲',
        rarity: 'common',
        apply: (stats: PlayerStats) => {
          stats.magnetRadius *= 1.3;
        },
      },

      // RARE
      {
        id: 'plasma_infusion',
        name: 'Плазменные Излучатели',
        desc: 'Заменяет стандартные снаряды на высокоскоростные плазменные лазеры',
        icon: '🔮',
        rarity: 'rare',
        apply: (stats: PlayerStats) => {
          stats.hasPlasmaRounds = true;
          stats.damageMultiplier += 0.1;
        },
      },
      {
        id: 'shield_overcharge',
        name: 'Перегрузка Энергощита',
        desc: '+30 к емкости щита и +50% к скорости восстановления',
        icon: '💠',
        rarity: 'rare',
        apply: (stats: PlayerStats) => {
          stats.maxShield += 30;
          stats.shieldRechargeRate *= 1.5;
          stats.currentShield = stats.maxShield;
        },
      },
      {
        id: 'turret_overdrive',
        name: 'Овердрайв Турелей',
        desc: '+30% к урону и скорострельности всех защитных сооружений',
        icon: '📡',
        rarity: 'rare',
        apply: (stats: PlayerStats) => {
          stats.turretBuffMultiplier += 0.3;
        },
      },
      {
        id: 'shockwave_nitro',
        name: 'Ударная Волна Рывка',
        desc: 'Рывок выпускает кинетическую волну, сбивающую врагов с ног',
        icon: '🌊',
        rarity: 'rare',
        apply: (stats: PlayerStats) => {
          stats.hasShockwaveDash = true;
          stats.dashCooldown = Math.max(1.0, stats.dashCooldown - 0.3);
        },
      },
      {
        id: 'targeting_matrix',
        name: 'Оптический Прицел',
        desc: '+15% к шансу критического попадания',
        icon: '🎯',
        rarity: 'rare',
        apply: (stats: PlayerStats) => {
          stats.critChance += 0.15;
        },
      },

      // EPIC
      {
        id: 'tesla_chain_rounds',
        name: 'Тесла-Цепь Попаданий',
        desc: 'Снаряды вызывают дуговой разряд молнии по соседним монстрам',
        icon: '⚡',
        rarity: 'epic',
        apply: (stats: PlayerStats) => {
          stats.hasTeslaArcOnHit = true;
        },
      },
      {
        id: 'vampiric_siphon',
        name: 'Нано-Регенераторы',
        desc: 'Каждое попадание по врагу с шансом восстанавливает корпус меха',
        icon: '🩸',
        rarity: 'epic',
        apply: (stats: PlayerStats) => {
          stats.hasVampiricNanites = true;
        },
      },
      {
        id: 'titan_buster',
        name: 'Крушитель Титанов',
        desc: 'Критические попадания наносят 3.0x урона (вместо 2.0x)',
        icon: '👑',
        rarity: 'epic',
        apply: (stats: PlayerStats) => {
          stats.critMultiplier = 3.0;
          stats.critChance += 0.1;
        },
      },

      // LEGENDARY
      {
        id: 'orbital_nanite_core',
        name: 'Орбитальный Нано-Реактор',
        desc: 'Постоянная непрерывная регенерация корпуса и силового поля',
        icon: '☀️',
        rarity: 'legendary',
        apply: (stats: PlayerStats) => {
          stats.shieldRechargeDelay = 0.5;
          stats.shieldRechargeRate *= 2.0;
          stats.maxHp += 50;
          stats.currentHp = stats.maxHp;
        },
      },
      {
        id: 'apocalypse_barrage',
        name: 'Шквал Апокалипсиса',
        desc: 'Удваивает скорострельность всех пушек меха (+100% темп стрельбы)',
        icon: '☠️',
        rarity: 'legendary',
        apply: (stats: PlayerStats) => {
          stats.attackSpeedMultiplier *= 2.0;
        },
      },
    ];
  }

  public reset(): void {
    this.rerollsLeft = 2;
  }

  public drawCards(forceHighRarity: boolean = false): UpgradeCard[] {
    const pool = [...this.cardCatalog];
    const picked: UpgradeCard[] = [];

    while (picked.length < 3 && pool.length > 0) {
      // Pick rarity
      let rarity: CardRarity = 'common';
      const roll = Math.random();

      if (forceHighRarity) {
        if (roll < 0.2) rarity = 'legendary';
        else if (roll < 0.6) rarity = 'epic';
        else rarity = 'rare';
      } else {
        if (roll < 0.02) rarity = 'legendary';
        else if (roll < 0.12) rarity = 'epic';
        else if (roll < 0.4) rarity = 'rare';
        else rarity = 'common';
      }

      // Find matching card
      const candidates = pool.filter((c) => c.rarity === rarity);
      const chosen = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : pool[Math.floor(Math.random() * pool.length)];

      picked.push(chosen);
      // Remove from candidate pool so no duplicates in one draft
      const idx = pool.findIndex((c) => c.id === chosen.id);
      if (idx !== -1) pool.splice(idx, 1);
    }

    return picked;
  }

  public selectCard(card: UpgradeCard): void {
    card.apply(player.stats);
    eventBus.emit('upgrade:selected', { id: card.id, name: card.name });
  }
}

export const upgradeManager = UpgradeManager.getInstance();
