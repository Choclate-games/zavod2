/**
 * 3-Card Roguelite Upgrade Draft System
 */

import { Player } from '../entities/Player';
import { eventBus } from '../core/EventBus';

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface UpgradeCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: CardRarity;
  synergyTag: string;
  apply: (player: Player) => void;
}

export class UpgradeManager {
  private cardsCatalog: UpgradeCard[] = [
    {
      id: 'birch_blaze',
      name: 'Берестяное Пламя',
      description: 'Факелы горят на 50% дольше и отпугивают духов с большего расстояния.',
      icon: '🔥',
      rarity: 'common',
      synergyTag: 'fire',
      apply: (player) => {
        player.stats.torchDurationBonus += 0.5;
      },
    },
    {
      id: 'sacred_salt',
      name: 'Освященная Соль',
      description: 'Даёт +3 мешочка соли и увеличивает максимальный запас на 3.',
      icon: '🧂',
      rarity: 'common',
      synergyTag: 'salt',
      apply: (player) => {
        player.stats.maxSalt += 3;
        player.stats.salt = Math.min(player.stats.maxSalt, player.stats.salt + 3);
      },
    },
    {
      id: 'shadow_stride',
      name: 'Теневая Поступь',
      description: '+35% к скорости перемещения в кустах и при скрытности.',
      icon: '🌿',
      rarity: 'common',
      synergyTag: 'stealth',
      apply: (player) => {
        player.stats.speed += 25;
        player.stats.stealthBonus += 0.35;
      },
    },
    {
      id: 'ghost_blade',
      name: 'Клинок Ночи',
      description: '+12 к урону клинка и +15% к шансу критического удара.',
      icon: '🗡️',
      rarity: 'rare',
      synergyTag: 'combat',
      apply: (player) => {
        player.stats.attackPower += 12;
        player.stats.critChance += 0.15;
      },
    },
    {
      id: 'vital_herbs',
      name: 'Живительный Сбор',
      description: '+30 к максимальному здоровью и мгновенное исцеление на 50 HP.',
      icon: '🍃',
      rarity: 'rare',
      synergyTag: 'nature',
      apply: (player) => {
        player.stats.maxHp += 30;
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + 50);
      },
    },
    {
      id: 'spirit_siphon',
      name: 'Удар из Засады',
      description: 'Удар в спину из тени восстанавливает 18 HP и 30 выносливости.',
      icon: '⚡',
      rarity: 'rare',
      synergyTag: 'stealth',
      apply: (player) => {
        player.stats.attackPower += 8;
        player.stats.staminaRegen += 10;
      },
    },
    {
      id: 'wisp_magnet',
      name: 'Магнит Духов',
      description: 'Увеличивает радиус сбора монет и трав в 2.5 раза.',
      icon: '🧲',
      rarity: 'rare',
      synergyTag: 'economy',
      apply: (player) => {
        player.stats.coins += 10;
      },
    },
    {
      id: 'bereginya_ward',
      name: 'Оберег Берегини',
      description: 'Полное исцеление + постоянный барьер, снижающий получаемый урон.',
      icon: '🛡️',
      rarity: 'epic',
      synergyTag: 'ward',
      apply: (player) => {
        player.stats.hp = player.stats.maxHp;
        player.stats.maxHp += 20;
      },
    },
    {
      id: 'thunder_dash',
      name: 'Священный Рывок',
      description: 'Рывок откатывается на 30% быстрее и восстанавливает 1 соль при уклонении.',
      icon: '💨',
      rarity: 'epic',
      synergyTag: 'mobility',
      apply: (player) => {
        player.stats.staminaRegen += 15;
        player.stats.maxSalt += 2;
      },
    },
    {
      id: 'leshy_bane',
      name: 'Погибель Нечисти',
      description: '+25 к атаке. Удары наносят двойной урон по Лешему и элитным духам.',
      icon: '👑',
      rarity: 'legendary',
      synergyTag: 'combat',
      apply: (player) => {
        player.stats.attackPower += 25;
        player.stats.critChance += 0.2;
      },
    },
  ];

  rollThreeCards(guaranteeRare = false): UpgradeCard[] {
    const pool = [...this.cardsCatalog];
    const picked: UpgradeCard[] = [];

    while (picked.length < 3 && pool.length > 0) {
      let filtered = pool;
      if (guaranteeRare && picked.length === 0) {
        filtered = pool.filter((c) => c.rarity === 'rare' || c.rarity === 'epic' || c.rarity === 'legendary');
        if (filtered.length === 0) filtered = pool;
      }

      const idx = Math.floor(Math.random() * filtered.length);
      const card = filtered[idx];
      picked.push(card);

      const removeIdx = pool.indexOf(card);
      if (removeIdx !== -1) pool.splice(removeIdx, 1);
    }

    return picked;
  }

  applyCard(card: UpgradeCard, player: Player): void {
    card.apply(player);
    eventBus.emit('upgrade:selected', { cardId: card.id, name: card.name });
    eventBus.emit('audio:sfx', { name: 'magic' });
    eventBus.emit('ui:fct', {
      text: `✨ ${card.name}!`,
      x: player.body.position.x,
      y: player.body.position.y - 30,
      color: '#fff3cd',
      size: 18,
    });
  }
}
