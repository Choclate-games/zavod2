import { UpgradeCard } from '../types/game';
import { gameStore } from '../core/Store';
import { PlayerCar } from '../entities/PlayerCar';

export class UpgradeManager {
  private availableUpgrades: UpgradeCard[] = [];

  constructor() {
    this.initUpgradePool();
  }

  public initUpgradePool(): void {
    this.availableUpgrades = [
      {
        id: 'weapon_minigun',
        nameRu: 'Крышевой Миниган',
        descriptionRu: 'Автоматическая турель с высокой скорострельностью, расстреливающая зомби на дистанции.',
        icon: '🔫',
        rarity: 'COMMON',
        category: 'WEAPON',
        maxLevel: 5,
        currentLevel: 0,
        apply: (game: any) => {
          const car = game.playerCar as PlayerCar;
          car.weapons.addOrUpgradeWeapon(
            'ROOF_MINIGUN',
            car.meshResult.weaponMountRoof,
            car.meshResult.weaponMountLeft,
            car.meshResult.weaponMountRight
          );
        },
      },
      {
        id: 'weapon_buzzsaws',
        nameRu: 'Боковые Циркулярные Пилы',
        descriptionRu: 'Вращающиеся лезвия по бокам кузова. Наносят чудовищный урон при боковом заносе и дрифте.',
        icon: '⚙️',
        rarity: 'RARE',
        category: 'WEAPON',
        maxLevel: 5,
        currentLevel: 0,
        apply: (game: any) => {
          const car = game.playerCar as PlayerCar;
          car.weapons.addOrUpgradeWeapon(
            'SIDE_BUZZSAWS',
            car.meshResult.weaponMountRoof,
            car.meshResult.weaponMountLeft,
            car.meshResult.weaponMountRight
          );
        },
      },
      {
        id: 'weapon_flamethrower',
        nameRu: 'Огнеметная Система',
        descriptionRu: 'Выбрасывает мощные струи пламени вперед, сжигая орды зомби за считанные секунды.',
        icon: '🔥',
        rarity: 'RARE',
        category: 'WEAPON',
        maxLevel: 5,
        currentLevel: 0,
        apply: (game: any) => {
          const car = game.playerCar as PlayerCar;
          car.weapons.addOrUpgradeWeapon(
            'FLAMETHROWER',
            car.meshResult.weaponMountRoof,
            car.meshResult.weaponMountLeft,
            car.meshResult.weaponMountRight
          );
        },
      },
      {
        id: 'weapon_mortar',
        nameRu: 'Ракетный Миномет',
        descriptionRu: 'Запускает самонаводящиеся ракеты с разрушительным взрывным уроном по скоплениям врагов.',
        icon: '🚀',
        rarity: 'EPIC',
        category: 'WEAPON',
        maxLevel: 5,
        currentLevel: 0,
        apply: (game: any) => {
          const car = game.playerCar as PlayerCar;
          car.weapons.addOrUpgradeWeapon(
            'MORTAR_LAUNCHER',
            car.meshResult.weaponMountRoof,
            car.meshResult.weaponMountLeft,
            car.meshResult.weaponMountRight
          );
        },
      },
      {
        id: 'weapon_shock',
        nameRu: 'Шоковая Катушка Тесла',
        descriptionRu: 'Периодически бьет цепной молнией по группе ближайших зомби.',
        icon: '⚡',
        rarity: 'EPIC',
        category: 'WEAPON',
        maxLevel: 5,
        currentLevel: 0,
        apply: (game: any) => {
          const car = game.playerCar as PlayerCar;
          car.weapons.addOrUpgradeWeapon(
            'SHOCK_RING',
            car.meshResult.weaponMountRoof,
            car.meshResult.weaponMountLeft,
            car.meshResult.weaponMountRight
          );
        },
      },
      {
        id: 'stat_ram_boost',
        nameRu: 'Шипастый Булл-Бар',
        descriptionRu: 'Увеличивает урон от лобового тарана зомби на +45%.',
        icon: '🛡️',
        rarity: 'COMMON',
        category: 'STAT',
        maxLevel: 5,
        currentLevel: 0,
        apply: () => {
          gameStore.save.garageUpgrades.ramLevel += 1;
        },
      },
      {
        id: 'stat_nitro_supercharger',
        nameRu: 'Нитро-Нагнетатель',
        descriptionRu: 'Ускоряет перезарядку нитро на +50% и увеличивает длительность форсажа.',
        icon: '💨',
        rarity: 'RARE',
        category: 'STAT',
        maxLevel: 5,
        currentLevel: 0,
        apply: () => {
          gameStore.save.garageUpgrades.nitroLevel += 1;
        },
      },
      {
        id: 'stat_magnet',
        nameRu: 'Магнитный Захват',
        descriptionRu: 'Увеличивает радиус сбора шестеренок и аптечек на +6 метров.',
        icon: '🧲',
        rarity: 'COMMON',
        category: 'UTILITY',
        maxLevel: 5,
        currentLevel: 0,
        apply: () => {
          gameStore.run.magnetRadius += 6.0;
        },
      },
      {
        id: 'stat_repair',
        nameRu: 'Нано-Ремонт и Броня',
        descriptionRu: 'Мгновенно восстанавливает +80 HP и увеличивает максимальную прочность на +30 HP.',
        icon: '🔧',
        rarity: 'COMMON',
        category: 'STAT',
        maxLevel: 10,
        currentLevel: 0,
        apply: (game: any) => {
          gameStore.run.maxHealth += 30;
          (game.playerCar as PlayerCar).heal(80);
        },
      },
      {
        id: 'stat_drift_king',
        nameRu: 'Дрифт-Мастер',
        descriptionRu: 'Улучшает управляемость в заносе и ускоряет набор множителя ярости.',
        icon: '🏎️',
        rarity: 'LEGENDARY',
        category: 'STAT',
        maxLevel: 3,
        currentLevel: 0,
        apply: () => {
          gameStore.save.garageUpgrades.driftLevel += 1;
        },
      },
    ];
  }

  public getRandomUpgrades(count = 3): UpgradeCard[] {
    const pool = this.availableUpgrades.filter((u) => u.currentLevel < u.maxLevel);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  public selectUpgrade(upgradeId: string, game: any): void {
    const upgrade = this.availableUpgrades.find((u) => u.id === upgradeId);
    if (upgrade) {
      upgrade.currentLevel += 1;
      upgrade.apply(game);
    }
  }
}
