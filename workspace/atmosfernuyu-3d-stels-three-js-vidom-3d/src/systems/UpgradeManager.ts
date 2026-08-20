import { Player } from '../entities/Player';
import { eventBus } from '../core/EventBus';
import { telemetry } from '../telemetry/Telemetry';

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface UpgradeCard {
  id: string;
  title: string;
  desc: string;
  icon: string;
  rarity: CardRarity;
  synergy: string;
  apply: (player: Player) => void;
}

export class UpgradeManager {
  private cardCatalog: UpgradeCard[] = [
    {
      id: 'sonar_overcharge',
      title: 'Сонарный Резонанс',
      desc: '+35% к радиусу сонара и увеличение длительности оглушения на +0.5 сек.',
      icon: '📡',
      rarity: 'rare',
      synergy: '[Сонар]',
      apply: (p) => {
        p.stats.sonarRadius *= 1.35;
      },
    },
    {
      id: 'titanium_drill',
      title: 'Титановый Бур',
      desc: '+25% к урону основной атаки буром и повышенное отталкивание врагов.',
      icon: '⚔️',
      rarity: 'common',
      synergy: '[Удар]',
      apply: (p) => {
        p.stats.attackPower *= 1.25;
      },
    },
    {
      id: 'shadow_cloak',
      title: 'Теневой Покров',
      desc: '+20% к вероятности критического удара и ускорение перехода в скрытность.',
      icon: '🥷',
      rarity: 'rare',
      synergy: '[Стелс]',
      apply: (p) => {
        p.stats.critChance += 0.2;
      },
    },
    {
      id: 'burrow_slipstream',
      title: 'Подземный Турбо-Рывок',
      desc: 'Снижение перезарядки рывка на 25% и +30% к дистанции ускорения.',
      icon: '💨',
      rarity: 'rare',
      synergy: '[Маневр]',
      apply: (p) => {
        p.stats.dashCooldown = Math.max(0.4, p.stats.dashCooldown * 0.75);
      },
    },
    {
      id: 'magnetic_core',
      title: 'Магнитное Ядро',
      desc: '+60% к радиусу притягивания шестерёнок, свитков и кристаллов.',
      icon: '🧲',
      rarity: 'common',
      synergy: '[Добыча]',
      apply: (p) => {
        p.stats.magnetRadius *= 1.6;
      },
    },
    {
      id: 'reactive_shield',
      title: 'Ионный Щит Колонии',
      desc: '+30 к максимальному запасу силового щита и мгновенная перезарядка.',
      icon: '🛡️',
      rarity: 'epic',
      synergy: '[Щит]',
      apply: (p) => {
        p.stats.maxShield += 30;
        p.stats.shield = p.stats.maxShield;
      },
    },
    {
      id: 'vital_spores',
      title: 'Целебные Споры Грибов',
      desc: '+40 к максимальному здоровью и мгновенное полное исцеление.',
      icon: '🍄',
      rarity: 'epic',
      synergy: '[Живучесть]',
      apply: (p) => {
        p.stats.maxHp += 40;
        p.stats.hp = p.stats.maxHp;
      },
    },
    {
      id: 'ancient_catalyst',
      title: 'Катализатор Архивариуса',
      desc: 'Легендарное знание: +35% урона, +15% скорости и +100% радиус сонара!',
      icon: '📜',
      rarity: 'legendary',
      synergy: '[Древнее Наследие]',
      apply: (p) => {
        p.stats.attackPower *= 1.35;
        p.stats.moveSpeed *= 1.15;
        p.stats.sonarRadius *= 2.0;
      },
    },
    {
      id: 'rapid_overclock',
      title: 'Оверклок Мотора',
      desc: '+18% к общей скорости перемещения и +30 к максимальной энергии.',
      icon: '⚡',
      rarity: 'common',
      synergy: '[Энергия]',
      apply: (p) => {
        p.stats.moveSpeed *= 1.18;
        p.stats.maxEnergy += 30;
      },
    },
  ];

  private rerollsUsedInRun = 0;
  private readonly maxRerollsPerRun = 2;

  constructor(private player: Player) {}

  resetRun(): void {
    this.rerollsUsedInRun = 0;
  }

  get canReroll(): boolean {
    return this.rerollsUsedInRun < this.maxRerollsPerRun;
  }

  generateCards(guaranteeRare = false): UpgradeCard[] {
    const pool = this.cardCatalog.filter((c) => {
      if (guaranteeRare) {
        return c.rarity === 'rare' || c.rarity === 'epic' || c.rarity === 'legendary';
      }
      return true;
    });

    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  }

  selectCard(card: UpgradeCard): void {
    card.apply(this.player);
    telemetry.track('upgrade_selected', { id: card.id, rarity: card.rarity });
    eventBus.emit('card:selected', { card });
    eventBus.emit('player:hp_changed', {
      current: this.player.stats.hp,
      max: this.player.stats.maxHp,
      shield: this.player.stats.shield,
      maxShield: this.player.stats.maxShield,
    });
  }

  useReroll(): UpgradeCard[] | null {
    if (!this.canReroll) return null;
    this.rerollsUsedInRun++;
    telemetry.track('reroll_used', { count: this.rerollsUsedInRun });
    return this.generateCards(true);
  }
}
