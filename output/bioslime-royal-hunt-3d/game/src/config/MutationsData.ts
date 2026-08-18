import { MutationDefinition } from '../types';

export const MUTATIONS_DATABASE: Record<string, MutationDefinition> = {
  poison_spores: {
    id: 'poison_spores',
    name: 'Ядовитые споры',
    rarity: 'common',
    icon: '🍄',
    description: 'Периодически выбрасывает облака ядовитых спор, наносящих урон по площади.',
    maxLevel: 5,
    tags: ['attack', 'poison', 'area']
  },
  slime_minions: {
    id: 'slime_minions',
    name: 'Клонирование',
    rarity: 'rare',
    icon: '🦠',
    description: 'Порождает автономных мини-слизней, атакующих мелких врагов и собирающих биомассу.',
    maxLevel: 5,
    tags: ['summon', 'utility']
  },
  chitin_armor: {
    id: 'chitin_armor',
    name: 'Хитиновый панцирь',
    rarity: 'common',
    icon: '🛡️',
    description: 'Снижает весь входящий урон на 15% за уровень и наносит колющий урон при таране.',
    maxLevel: 5,
    tags: ['defense', 'armor']
  },
  acid_spikes: {
    id: 'acid_spikes',
    name: 'Кислотные шипы',
    rarity: 'common',
    icon: '⚡',
    description: 'Выстреливает веером ядовитых шипов в ближайших рыцарей и стражников.',
    maxLevel: 5,
    tags: ['attack', 'projectile']
  },
  acid_trail: {
    id: 'acid_trail',
    name: 'Токсичный след',
    rarity: 'rare',
    icon: '🧪',
    description: 'Оставляет за собой разъедающий след, замедляющий и сжигающий преследователей.',
    maxLevel: 5,
    tags: ['area', 'poison', 'mobility']
  },
  bio_magnetism: {
    id: 'bio_magnetism',
    name: 'Био-магнетизм',
    rarity: 'common',
    icon: '🧲',
    description: 'Увеличивает радиус притягивания капель биомассы и сфер ДНК на 40% за уровень.',
    maxLevel: 5,
    tags: ['utility', 'economy']
  },
  digestive_enzymes: {
    id: 'digestive_enzymes',
    name: 'Пищеварительные ферменты',
    rarity: 'rare',
    icon: '🧬',
    description: 'Повышает силу поглощения на 25% и восстанавливает здоровье при каждом поглощении врага.',
    maxLevel: 5,
    tags: ['progression', 'heal']
  },
  toxic_nova: {
    id: 'toxic_nova',
    name: 'Токсичная вспышка',
    rarity: 'legendary',
    icon: '💥',
    description: 'Создает мощный био-импульс каждые 6 сек., отбрасывающий врагов и наносящий сильный урон.',
    maxLevel: 3,
    tags: ['attack', 'aoe', 'burst']
  },
  plague_citadel: {
    id: 'plague_citadel',
    name: 'Чумная Цитадель',
    rarity: 'synergy',
    icon: '👑',
    description: 'ЭВОЛЮЦИЯ: Постоянная аура смертоносного яда и неуязвимость к столкновениям!',
    maxLevel: 1,
    tags: ['synergy', 'ultimate'],
    synergyRequires: ['poison_spores', 'chitin_armor']
  },
  biomass_infusion: {
    id: 'biomass_infusion',
    name: 'Сгусток биомассы',
    rarity: 'common',
    icon: '💖',
    description: 'Мгновенно восстанавливает 30% HP и дает +150 очков ДНК.',
    maxLevel: 99,
    tags: ['heal', 'economy']
  }
};
