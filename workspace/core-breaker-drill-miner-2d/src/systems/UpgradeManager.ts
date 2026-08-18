import { Game } from '../core/Game.ts';

export interface UpgradeOption {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic';
}

const UPGRADES: UpgradeOption[] = [
  { id: 'ricochet+1', name: 'Зеркальная оптика', description: 'Лазер отражается на 1 раз чаще.', rarity: 'common' },
  { id: 'damage+20', name: 'Плазменный наконечник', description: 'Урон лазера +20%.', rarity: 'common' },
  { id: 'drill+30', name: 'Твердосплавные зубья', description: 'Скорость бурения +30%.', rarity: 'common' },
  { id: 'speed+15', name: 'Ионные двигатели', description: 'Скорость меха +15%.', rarity: 'rare' },
  { id: 'vampirism', name: 'Вампирический луч', description: 'Лазер восстанавливает 2% HP за удар.', rarity: 'rare' },
  { id: 'chain', name: 'Цепная молния', description: 'Лазер цепляет вторую цель.', rarity: 'epic' },
  { id: 'plasma_drill', name: 'Плазменный бур', description: 'Бур наносит урон врагам.', rarity: 'epic' }
];

export class UpgradeManager {
  private readonly game: Game;
  private stats = {
    ricochets: 2,
    damageMult: 1,
    drillSpeed: 1,
    speedMult: 1,
    vampirism: false,
    chain: false,
    plasmaDrill: false
  };
  private usedThisRun = new Set<string>();

  constructor(game: Game) {
    this.game = game;
  }

  resetRun(): void {
    this.stats = {
      ricochets: 2,
      damageMult: 1,
      drillSpeed: 1,
      speedMult: 1,
      vampirism: false,
      chain: false,
      plasmaDrill: false
    };
    this.usedThisRun.clear();
    this.applyToGame();
  }

  generateOptions(): UpgradeOption[] {
    const pool = UPGRADES.filter((u) => !this.usedThisRun.has(u.id));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }

  pick(id: string): void {
    this.usedThisRun.add(id);
    switch (id) {
      case 'ricochet+1':
        this.stats.ricochets += 1;
        break;
      case 'damage+20':
        this.stats.damageMult += 0.2;
        break;
      case 'drill+30':
        this.stats.drillSpeed += 0.3;
        break;
      case 'speed+15':
        this.stats.speedMult += 0.15;
        break;
      case 'vampirism':
        this.stats.vampirism = true;
        break;
      case 'chain':
        this.stats.chain = true;
        break;
      case 'plasma_drill':
        this.stats.plasmaDrill = true;
        break;
    }
    this.applyToGame();
  }

  private applyToGame(): void {
    this.game.lasers.setRicochets(this.stats.ricochets);
    this.game.lasers.setChainBonus(this.stats.chain ? 5 : 0);
  }

  getStats() {
    return { ...this.stats };
  }
}
