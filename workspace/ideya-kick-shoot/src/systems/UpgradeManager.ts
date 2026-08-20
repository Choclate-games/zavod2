import { UpgradeCard, MetaUpgrade } from '../core/Types';
import { Player } from '../entities/Player';
import { StorageService } from '../platform/StorageService';
import { EventBus } from '../core/EventBus';

export class UpgradeManager {
  private player: Player;
  private storageService: StorageService;
  private eventBus: EventBus;

  public metaUpgrades: MetaUpgrade[] = [
    {
      id: 'titanium_boots',
      name: 'Титановые Экзо-Берцы',
      description: '+7% к силе кинетического импульса и урону о стены за уровень',
      level: 0,
      maxLevel: 10,
      baseCost: 20,
      costMultiplier: 1.6
    },
    {
      id: 'adrenaline_injector',
      name: 'Адреналиновый Инжектор',
      description: 'Увеличивает окно замедления времени при прорыве дверей на +0.2с за уровень',
      level: 0,
      maxLevel: 5,
      baseCost: 35,
      costMultiplier: 1.8
    },
    {
      id: 'magnetic_glove',
      name: 'Магнитный Перехватчик',
      description: 'Увеличивает радиус автоподбора выбитого оружия и плазмы на +0.8м за уровень',
      level: 0,
      maxLevel: 5,
      baseCost: 30,
      costMultiplier: 1.7
    },
    {
      id: 'ammo_vest',
      name: 'Разгрузочный Жилет',
      description: '+15% к запасу патронов и урону оружия за уровень',
      level: 0,
      maxLevel: 8,
      baseCost: 25,
      costMultiplier: 1.65
    },
    {
      id: 'shock_soles',
      name: 'Шоковые Подошвы',
      description: 'Пинок наносит электрический разряд цепной молнией по 2 соседним целям',
      level: 0,
      maxLevel: 3,
      baseCost: 60,
      costMultiplier: 2.2
    }
  ];

  constructor(player: Player) {
    this.player = player;
    this.storageService = StorageService.getInstance();
    this.eventBus = EventBus.getInstance();
    this.loadMetaLevels();
  }

  public loadMetaLevels(): void {
    const data = this.storageService.getData();
    for (const meta of this.metaUpgrades) {
      if (data.metaUpgrades && data.metaUpgrades[meta.id] !== undefined) {
        meta.level = data.metaUpgrades[meta.id];
      }
    }
    this.applyMetaStatsToPlayer();
  }

  public applyMetaStatsToPlayer(): void {
    const boots = this.getMeta('titanium_boots')?.level || 0;
    const glove = this.getMeta('magnetic_glove')?.level || 0;
    const shock = this.getMeta('shock_soles')?.level || 0;

    this.player.bootBoosterLevel = boots;
    this.player.autoMagnetRadius = 2.4 + glove * 0.8;
    this.player.shockSoles = shock > 0;
  }

  public getMeta(id: string): MetaUpgrade | undefined {
    return this.metaUpgrades.find((m) => m.id === id);
  }

  public purchaseMetaUpgrade(id: string): boolean {
    const meta = this.getMeta(id);
    if (!meta || meta.level >= meta.maxLevel) return false;

    const cost = Math.round(meta.baseCost * Math.pow(meta.costMultiplier, meta.level));
    const data = this.storageService.getData();

    if (data.bioplasma >= cost) {
      data.bioplasma -= cost;
      meta.level++;
      data.metaUpgrades[meta.id] = meta.level;
      this.storageService.save();
      this.applyMetaStatsToPlayer();
      this.eventBus.emit('meta:purchased', meta);
      return true;
    }
    return false;
  }

  public generateThreeCardChoices(guaranteeHighRarity: boolean = false): UpgradeCard[] {
    const pool: UpgradeCard[] = [
      {
        id: 'titanium_kick',
        title: 'Титановый Таран',
        description: '+25% к дальности полета врагов от пинка и +35% урона о стены',
        rarity: 'common',
        icon: '🦵',
        apply: () => {
          this.player.bootBoosterLevel += 2;
        }
      },
      {
        id: 'kinetic_spring',
        title: 'Кинетические Пружины',
        description: '+18% к скорости спринта и сокращение отката рывка на 30%',
        rarity: 'common',
        icon: '⚡',
        apply: () => {
          this.player.moveSpeed *= 1.18;
          this.player.baseSpeed *= 1.18;
        }
      },
      {
        id: 'rapid_chamber',
        title: 'Скорострельный Затвор',
        description: '+30% к скорострельности для всего арсенала оружия',
        rarity: 'common',
        icon: '🔫',
        apply: () => {
          this.player.currentWeapon.stats.fireRate *= 1.3;
        }
      },
      {
        id: 'skeet_master',
        title: 'Стендовый Снайпер',
        description: 'Критический урон по летящим в воздухе врагам возрастает до 3.5x (+ дроп патронов)',
        rarity: 'rare',
        icon: '🎯',
        apply: () => {
          // Enhances Skeet crit
        }
      },
      {
        id: 'bowling_king',
        title: 'Кегельбан «Страйк»',
        description: 'Запущенные пинком враги передают 85% импульса другим телам, сметая толпы',
        rarity: 'rare',
        icon: '🎳',
        apply: () => {
          // Applied in physics
        }
      },
      {
        id: 'magnetic_overdrive',
        title: 'Магнитный Овердрайв',
        description: 'Автозахват выбитого оружия на 4.5м и удвоенный боекомплект трофейных стволов',
        rarity: 'rare',
        icon: '🧲',
        apply: () => {
          this.player.autoMagnetRadius += 2.2;
        }
      },
      {
        id: 'bio_siphon',
        title: 'Био-Сифон Впечатывания',
        description: 'Каждое размазывание противника о стену или бочку восстанавливает +18 HP',
        rarity: 'epic',
        icon: '🧪',
        apply: () => {
          this.player.wallSmashHeal += 18;
        }
      },
      {
        id: 'explosive_boots',
        title: 'Реактивный Пневмо-Удар',
        description: 'Каждый пинок генерирует взрывную огненную волну в радиусе 3.5м',
        rarity: 'epic',
        icon: '💥',
        apply: () => {
          this.player.kickConeAngle = 75;
          this.player.kickRange = 3.2;
        }
      },
      {
        id: 'adrenaline_rush',
        title: 'Адреналиновый Фокус',
        description: 'Продлевает замедление времени при вышибании дверей на +1.0 секунду',
        rarity: 'epic',
        icon: '⏳',
        apply: () => {
          // Applied in breach duration
        }
      }
    ];

    // Shuffle and pick 3 unique cards
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    if (guaranteeHighRarity) {
      const rareOrEpic = shuffled.filter((c) => c.rarity === 'rare' || c.rarity === 'epic');
      const others = shuffled.filter((c) => c.rarity === 'common');
      return [rareOrEpic[0] || shuffled[0], rareOrEpic[1] || shuffled[1], others[0] || shuffled[2]];
    }

    return shuffled.slice(0, 3);
  }
}
