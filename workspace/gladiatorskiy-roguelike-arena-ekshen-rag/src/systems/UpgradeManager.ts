import { Player } from '../entities/Player';

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface UpgradeCard {
  id: string;
  title: string;
  desc: string;
  rarity: CardRarity;
  icon: string;
  category: 'weapon' | 'body' | 'arena';
  apply: (player: Player) => void;
}

export class UpgradeManager {
  private cardPool: UpgradeCard[] = [];

  constructor() {
    this.initPool();
  }

  private initPool(): void {
    this.cardPool = [
      {
        id: 'blade_mass_plus',
        title: 'Тяжёлый Клинок',
        desc: '+35% массы меча. Увеличивает кинетический импульс и шанс сбить врагов с ног.',
        rarity: 'common',
        icon: '🗡️',
        category: 'weapon',
        apply: (p) => {
          p.weapon.stats.massKg += 1.5;
        },
      },
      {
        id: 'blade_lengthen',
        title: 'Удлинённый Рычаг',
        desc: '+0.25 м длины острия. Повышает линейную скорость клинка на +40%.',
        rarity: 'rare',
        icon: '⚔️',
        category: 'weapon',
        apply: (p) => {
          p.weapon.stats.bladeLengthM += 0.25;
          p.weapon.bladeMesh.scale.y = p.weapon.stats.bladeLengthM / 1.25;
        },
      },
      {
        id: 'serrated_edge',
        title: 'Зазубренное Лезвие',
        desc: 'Снижает порог отсечения брони на 35%. Срывает щиты и шлемы с одного взмаха.',
        rarity: 'epic',
        icon: '🩸',
        category: 'weapon',
        apply: (p) => {
          p.perks.serratedBlade = true;
        },
      },
      {
        id: 'vesta_fire',
        title: 'Масло Весты',
        desc: 'Воспламеняет лезвие меча раскалённым огнём, нанося дополнительный урон.',
        rarity: 'legendary',
        icon: '🔥',
        category: 'weapon',
        apply: (p) => {
          p.perks.vestaFlame = true;
          p.weapon.setFlaming(true);
        },
      },
      {
        id: 'spiked_tackle',
        title: 'Шипованные Наколенники',
        desc: '+45 ед. урона при силовом толчке (Таран/Рывок) по телам противников.',
        rarity: 'rare',
        icon: '🛡️',
        category: 'body',
        apply: (p) => {
          p.perks.spikedArmor = true;
        },
      },
      {
        id: 'joint_torque_boost',
        title: 'Стальные Суставы',
        desc: 'Повышает крутящий момент рук и торса до 1200 Н·м. Несгибаемая стойка!',
        rarity: 'epic',
        icon: '🦾',
        category: 'body',
        apply: (p) => {
          p.ragdoll.config.jointMotorTorque += 350;
        },
      },
      {
        id: 'swift_sandals',
        title: 'Сандалии Гермеса',
        desc: '+20% к базовой скорости передвижения по песку Колизея.',
        rarity: 'common',
        icon: '🥾',
        category: 'body',
        apply: (p) => {
          p.moveSpeed *= 1.2;
        },
      },
      {
        id: 'titan_skin',
        title: 'Доспех Центуриона',
        desc: '+40 к максимальному здоровью и мгновенное полное восстановление HP.',
        rarity: 'rare',
        icon: '❤️',
        category: 'body',
        apply: (p) => {
          p.maxHp += 40;
          p.heal(p.maxHp);
        },
      },
      {
        id: 'stamina_surge',
        title: 'Дыхание Марса',
        desc: '+50% к скорости восстановления стойкости для частых рывков и ударов.',
        rarity: 'common',
        icon: '⚡',
        category: 'body',
        apply: (p) => {
          p.maxStamina += 30;
        },
      },
      {
        id: 'blood_favor',
        title: 'Любимец Патрициев',
        desc: '+35% очков восторга трибун за каждый сокрушительный удар.',
        rarity: 'rare',
        icon: '👑',
        category: 'arena',
        apply: (p) => {
          p.perks.crowdFavorite = true;
        },
      },
      {
        id: 'caesar_grace',
        title: 'Эдикт Императора',
        desc: 'Мгновенное исцеление на 50 HP и награда в +150 золотых монет.',
        rarity: 'legendary',
        icon: '🏛️',
        category: 'arena',
        apply: (p) => {
          p.heal(50);
        },
      },
    ];
  }

  public draftCards(guaranteeRareOrBetter: boolean = false): UpgradeCard[] {
    const pool = [...this.cardPool];
    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    let selected = pool.slice(0, 3);
    if (guaranteeRareOrBetter) {
      const highTier = pool.filter((c) => c.rarity === 'rare' || c.rarity === 'epic' || c.rarity === 'legendary');
      if (highTier.length > 0) {
        selected[0] = highTier[0];
      }
    }
    return selected;
  }
}

export const upgradeManager = new UpgradeManager();
