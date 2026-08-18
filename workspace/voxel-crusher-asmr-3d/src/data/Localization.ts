export interface LocaleStrings {
  gameTitle: string;
  subtitle: string;
  loading: string;
  loadingDone: string;
  coins: string;
  turboActive: string;
  tapToBoost: string;
  destroyed100: string;
  modelCrushed: string;
  voxelsBroken: string;
  coinsEarned: string;
  doubleRewardAd: string;
  nextModel: string;
  collections: string;
  shop: string;
  megaTurbo: string;
  adReady: string;
  upgrades: {
    width: { title: string; desc: string };
    sharpness: { title: string; desc: string };
    value: { title: string; desc: string };
    speed: { title: string; desc: string };
    levelPrefix: string;
    maxLevel: string;
  };
  shopItems: {
    goldenCrusher: { title: string; desc: string; buyBtn: string; owned: string };
    freeUpgrade: { title: string; desc: string; button: string };
    coinChest: { title: string; desc: string; button: string };
  };
  notifications: {
    bonusActive: string;
    levelUp: string;
    modelComplete: string;
    purchased: string;
    notEnoughCoins: string;
    adFailed: string;
  };
}

export const RU_STRINGS: LocaleStrings = {
  gameTitle: 'ВОКСЕЛЬНЫЙ ИЗМЕЛЬЧИТЕЛЬ',
  subtitle: 'ASMR 3D',
  loading: 'Загрузка ресурсов...',
  loadingDone: 'Готово к запуску!',
  coins: 'Монеты',
  turboActive: '⚡ ТУРБО x3! ⚡',
  tapToBoost: 'ТАПАЙ ДЛЯ УСКОРЕНИЯ!',
  destroyed100: 'УНИЧТОЖЕНО НА 100%!',
  modelCrushed: 'Объект Перемолот!',
  voxelsBroken: 'Вокселей разбито:',
  coinsEarned: 'Заработано монет:',
  doubleRewardAd: 'Удвоить (x2) за рекламу',
  nextModel: 'Следующий предмет ➡️',
  collections: '📦 Коллекции Предметов',
  shop: '🛒 Магазин Улучшений',
  megaTurbo: 'Мега-Турбо x5',
  adReady: 'Реклама',
  upgrades: {
    width: { title: 'Ширина', desc: '+Охват валов' },
    sharpness: { title: 'Острота', desc: '+Урон и скол' },
    value: { title: 'Ценность', desc: '+Доход за воксель' },
    speed: { title: 'Подача', desc: '+Авто-скорость' },
    levelPrefix: 'Ур.',
    maxLevel: 'МАКС'
  },
  shopItems: {
    goldenCrusher: {
      title: 'Золотой Измельчитель',
      desc: 'Золотой скин валов + множитель монет x1.5 навсегда!',
      buyBtn: 'Купить (10,000 🪙)',
      owned: 'Получено ✨'
    },
    freeUpgrade: {
      title: 'Бесплатный Апгрейд',
      desc: 'Мгновенно дает +1 уровень самому дорогому улучшению!',
      button: '🎬 Бесплатно'
    },
    coinChest: {
      title: 'Сундук Монет',
      desc: 'Мгновенный бонус +2,500 золотых монет!',
      button: '🎬 Получить'
    }
  },
  notifications: {
    bonusActive: '🚀 Мега-Турбо активировано на 30 сек!',
    levelUp: 'Улучшение прокачано!',
    modelComplete: '🎉 Коллекционный объект завершен!',
    purchased: 'Покупка успешно совершена!',
    notEnoughCoins: 'Недостаточно монет для покупки!',
    adFailed: 'Реклама временно недоступна'
  }
};

export const EN_STRINGS: LocaleStrings = {
  gameTitle: 'VOXEL CRUSHER',
  subtitle: 'ASMR 3D',
  loading: 'Loading assets...',
  loadingDone: 'Ready to play!',
  coins: 'Coins',
  turboActive: '⚡ TURBO x3! ⚡',
  tapToBoost: 'TAP TO BOOST!',
  destroyed100: '100% DESTROYED!',
  modelCrushed: 'Object Crushed!',
  voxelsBroken: 'Voxels crushed:',
  coinsEarned: 'Coins earned:',
  doubleRewardAd: 'Double (x2) Reward',
  nextModel: 'Next Object ➡️',
  collections: '📦 Object Collections',
  shop: '🛒 Upgrades & Shop',
  megaTurbo: 'Mega Turbo x5',
  adReady: 'Reward Ad',
  upgrades: {
    width: { title: 'Width', desc: '+Roller span' },
    sharpness: { title: 'Power', desc: '+Bite & crush' },
    value: { title: 'Value', desc: '+Coin reward' },
    speed: { title: 'Speed', desc: '+Auto feed' },
    levelPrefix: 'Lvl',
    maxLevel: 'MAX'
  },
  shopItems: {
    goldenCrusher: {
      title: 'Golden Crusher',
      desc: 'Pure gold rollers + x1.5 coins multiplier forever!',
      buyBtn: 'Buy (10,000 🪙)',
      owned: 'Owned ✨'
    },
    freeUpgrade: {
      title: 'Free Instant Upgrade',
      desc: 'Instantly grants +1 level to your highest upgrade!',
      button: '🎬 Free'
    },
    coinChest: {
      title: 'Coin Chest',
      desc: 'Instant bonus +2,500 gold coins!',
      button: '🎬 Claim'
    }
  },
  notifications: {
    bonusActive: '🚀 Mega Turbo activated for 30 sec!',
    levelUp: 'Upgrade leveled up!',
    modelComplete: '🎉 Collection object completed!',
    purchased: 'Purchase successful!',
    notEnoughCoins: 'Not enough coins!',
    adFailed: 'Ad is currently unavailable'
  }
};

let currentLocale = 'ru';

export function setLocale(lang: string): void {
  currentLocale = lang.startsWith('en') ? 'en' : 'ru';
}

export function t(): LocaleStrings {
  return currentLocale === 'en' ? EN_STRINGS : RU_STRINGS;
}
