export type LocaleCode = 'ru' | 'en';

const TRANSLATIONS: Record<LocaleCode, Record<string, string>> = {
  ru: {
    // General / UI
    'app_title': 'КИБЕР СРЕЗ: ПРОТОКОЛ ВРЕМЕНИ',
    'app_subtitle': '3D Свайп-Слэшер • Замедление Времени • Расщепление Материи',
    'btn_play': 'В БОЙ',
    'btn_hub': 'КИБЕР-ДОДЗЁ',
    'btn_resume': 'ПРОДОЛЖИТЬ',
    'btn_restart': 'ЗАНОВО',
    'btn_menu': 'ГЛАВНОЕ МЕНЮ',
    'btn_settings': 'НАСТРОЙКИ',
    'btn_select': 'ВЫБРАТЬ',
    'btn_upgrade': 'УЛУЧШИТЬ',
    'btn_equipped': 'ЭКИПИРОВАНО',
    'btn_unlock': 'РАЗБЛОКИРОВАТЬ',
    'btn_reroll': 'ХАКЕРСКИЙ РЕРОЛЛ',
    'btn_revive': 'КИБЕР-РЕАНИМАЦИЯ (РЕКЛАМА)',
    'btn_double_credits': 'УДВОИТЬ НАГРАДУ 2X (РЕКЛАМА)',
    'btn_starter_overdrive': 'СТАРТОВЫЙ ОВЕРДРАЙВ (РЕКЛАМА)',
    'btn_free': 'БЕСПЛАТНО',
    'ad_ready': 'РЕКЛАМА ДОСТУПНА',
    
    // HUD
    'hud_hp': 'БРОНЯ',
    'hud_chrono': 'ХРОНО-ЭНЕРГИЯ',
    'hud_heat': 'ПЕРЕГРЕВ',
    'hud_wave': 'ВОЛНА',
    'hud_boss': 'АПЕКС ХРОНОС (БОСС)',
    'hud_score': 'СЧЕТ',
    'hud_credits': 'НАНО-КРЕДИТЫ',
    'hud_overdrive': '⚡ ОВЕРДРАЙВ АКТИВЕН! ⚡',
    'hud_bullet_time': '⌛ ХРОНО-ФОКУС',
    'hud_weak_point': 'УЯЗВИМАЯ ПЛОСКОСТЬ! СРЕЖЬ ПО ЛИНИИ!',
    'hud_tap_to_slice': 'СВАЙПАЙ ДЛЯ СРЕЗА ВРАГОВ И СНАРЯДОВ',
    
    // Wave Clear / Draft
    'draft_title': 'НЕЙРО-ИНТЕЛЛЕКТ: ВЫБОР ЧИПА',
    'draft_subtitle': 'Интегрируйте квантовую аугментацию для следующего раунда',
    'card_common': 'ОБЫЧНЫЙ',
    'card_rare': 'РЕДКИЙ',
    'card_epic': 'ЭПИЧЕСКИЙ',
    'card_legendary': 'ЛЕГЕНДАРНЫЙ',
    
    // Augment Cards
    'aug_ricochet_title': 'Плазменный Рикошет',
    'aug_ricochet_desc': 'Разрезанные пули и ракеты отражаются обратно во врагов со 150% уроном.',
    'aug_quantum_title': 'Квантовое Расщепление',
    'aug_quantum_desc': 'Каждый свайп создает две параллельные линии лазерного среза.',
    'aug_vampirism_title': 'Хроно-Вампиризм',
    'aug_vampirism_desc': 'Уничтожение врагов в Bullet Time восстанавливает 6% HP.',
    'aug_chain_title': 'Цепная Молния',
    'aug_chain_desc': 'При рассечении врага вырывается дуговой разряд по 2 соседним целям.',
    'aug_overdrive_title': 'Гипер-Перегрузка',
    'aug_overdrive_desc': 'Длительность Overdrive +50%, а накапливается в 2 раза быстрее.',
    'aug_razor_title': 'Лезвие Ветра',
    'aug_razor_desc': 'Взмахи клинка запускают режущие полумесяцы по дальним целям.',
    'aug_reflexes_title': 'Матричные Рефлексы',
    'aug_reflexes_desc': 'Запас Хроно-Энергии +50%, скорость восстановления +40%.',
    'aug_shield_title': 'Нано-Энергощит',
    'aug_shield_desc': 'Создает силовой барьер, поглощающий 1 вражеский удар.',
    'aug_critical_title': 'Критический Резонанс',
    'aug_critical_desc': 'Мульти-срез (2+ врага за 1 свайп) наносит 300% урона.',
    'aug_emp_title': 'ЭМИ-Импульс',
    'aug_emp_desc': 'Разрезание дронов оглушает и замедляет всех врагов вокруг на 2 сек.',
    'aug_freeze_title': 'Сингулярность Времени',
    'aug_freeze_desc': 'При ранге SSS замедление времени полностью замораживает снаряды.',
    'aug_greed_title': 'Дроп-Хакер',
    'aug_greed_desc': '+100% нано-кредитов за поверженных роботов.',
    'aug_range_title': 'Фокусировка Луча',
    'aug_range_desc': 'Длина и ширина светового лезвия увеличены на 35%.',
    'aug_damage_title': 'Молекулярный Разрез',
    'aug_damage_desc': 'Базовый урон всех атак увеличен на 40%.',
    
    // Dojo / Hub
    'hub_title': 'КИБЕРНЕТИЧЕСКИЙ ХАБ',
    'hub_stats_tab': 'НЕЙРО-ИМПЛАНТЫ',
    'hub_katanas_tab': 'АРСЕНАЛ КАТАН',
    'stat_max_hp': 'Прочность Экзоскелета',
    'stat_chrono_cap': 'Емкость Хроно-Ядра',
    'stat_slice_power': 'Плазменная Заточка',
    'stat_credit_boost': 'Магнит Нано-Чипов',
    'lvl': 'УР.',
    
    // Katanas
    'katana_cyan_title': 'Неоновый Циан',
    'katana_cyan_desc': 'Стандартный сбалансированный клинок тактического кибер-ниндзя.',
    'katana_crimson_title': 'Плазменный Инферно',
    'katana_crimson_desc': 'Высокотемпературный клинок с огненным шлейфом (+30% урона).',
    'katana_violet_title': 'Квантовая Бездна',
    'katana_violet_desc': 'Искажает пространство, увеличивая длительность замедления времени (+40%).',
    'katana_gold_title': 'Солнечный Титан',
    'katana_gold_desc': 'Элитное орудие командиров с удвоенным шансом критических срезов.',
    
    // End Game
    'gameover_title': 'СИСТЕМНЫЙ СБОЙ',
    'gameover_desc': 'Экзоскелет разрушен. Хроно-связь разорвана.',
    'victory_title': 'МИССИЯ ВЫПОЛНЕНА',
    'victory_desc': 'Апекс Хронос уничтожен! Сектор очищен от враждебных мехов.',
    'stats_waves': 'Пройдено волн:',
    'stats_kills': 'Уничтожено роботов:',
    'stats_max_combo': 'Максимальное комбо:',
    'stats_credits': 'Собрано кредитов:',
    'stats_score': 'Итоговый счет:',
    
    // Controls Guide
    'ctrl_desktop_move': 'WASD / Стрелки — Перемещение',
    'ctrl_desktop_slice': 'Зажать ЛКМ + Свайп мышью — Срез и Bullet Time',
    'ctrl_desktop_dash': 'ПРОБЕЛ / Shift — Рывок',
    'ctrl_desktop_overdrive': 'E / Q — Активация Овердрайва',
    'ctrl_mobile_move': 'Левый стик — Перемещение',
    'ctrl_mobile_slice': 'Свайп по экрану — Срез в замедлении времени',
    'ctrl_mobile_dash': 'Кнопка ДЭШ — Рывок / Уклонение',
    'ctrl_mobile_bt': 'Кнопка ВРЕМЯ — Принудительный Bullet Time',
    
    // Settings
    'settings_title': 'НАСТРОЙКИ СИСТЕМЫ',
    'settings_sound': 'Звуковые эффекты',
    'settings_music': 'Музыка Synthwave',
    'settings_lang': 'Язык / Language',
    'settings_controls': 'Сенсорное управление'
  },
  en: {
    // General / UI
    'app_title': 'CYBER SLICE: BULLET PROTOCOL',
    'app_subtitle': '3D Swipe-Slasher • Bullet Time • Spatial Destruction',
    'btn_play': 'DEPLOY TO BATTLE',
    'btn_hub': 'CYBER DOJO',
    'btn_resume': 'RESUME',
    'btn_restart': 'RESTART',
    'btn_menu': 'MAIN MENU',
    'btn_settings': 'SETTINGS',
    'btn_select': 'SELECT',
    'btn_upgrade': 'UPGRADE',
    'btn_equipped': 'EQUIPPED',
    'btn_unlock': 'UNLOCK',
    'btn_reroll': 'HACKER REROLL',
    'btn_revive': 'CYBER REVIVE (AD)',
    'btn_double_credits': 'DOUBLE REWARDS 2X (AD)',
    'btn_starter_overdrive': 'STARTER OVERDRIVE (AD)',
    'btn_free': 'FREE',
    'ad_ready': 'AD READY',
    
    // HUD
    'hud_hp': 'ARMOR',
    'hud_chrono': 'CHRONO-ENERGY',
    'hud_heat': 'HEAT SURGE',
    'hud_wave': 'WAVE',
    'hud_boss': 'APEX CHRONOS (BOSS)',
    'hud_score': 'SCORE',
    'hud_credits': 'NANO-CREDITS',
    'hud_overdrive': '⚡ OVERDRIVE ACTIVE! ⚡',
    'hud_bullet_time': '⌛ CHRONO-FOCUS',
    'hud_weak_point': 'WEAK PLANE DETECTED! SLICE ALONG LINE!',
    'hud_tap_to_slice': 'SWIPE TO SLICE ENEMIES & PROJECTILES',
    
    // Wave Clear / Draft
    'draft_title': 'NEURAL MATRIX: CHOOSE AUGMENT',
    'draft_subtitle': 'Integrate a quantum cyber-chip for the next sector',
    'card_common': 'COMMON',
    'card_rare': 'RARE',
    'card_epic': 'EPIC',
    'card_legendary': 'LEGENDARY',
    
    // Augment Cards
    'aug_ricochet_title': 'Plasma Ricochet',
    'aug_ricochet_desc': 'Sliced bullets & missiles deflect back to enemies with 150% damage.',
    'aug_quantum_title': 'Quantum Split',
    'aug_quantum_desc': 'Every swipe projects two parallel slicing laser blades.',
    'aug_vampirism_title': 'Chrono-Vampirism',
    'aug_vampirism_desc': 'Eliminating enemies in Bullet Time restores 6% HP.',
    'aug_chain_title': 'Chain Lightning',
    'aug_chain_desc': 'Slicing an enemy discharges electric arcs to 2 nearby foes.',
    'aug_overdrive_title': 'Hyper Overdrive',
    'aug_overdrive_desc': 'Overdrive duration +50%, charges twice as fast.',
    'aug_razor_title': 'Razor Wind',
    'aug_razor_desc': 'Blade swings launch high-speed crescent waves across the arena.',
    'aug_reflexes_title': 'Matrix Reflexes',
    'aug_reflexes_desc': 'Max Chrono-Energy +50%, recharge rate +40%.',
    'aug_shield_title': 'Nanite Energy Shield',
    'aug_shield_desc': 'Generates a force barrier absorbing 1 enemy strike.',
    'aug_critical_title': 'Resonance Cut',
    'aug_critical_desc': 'Multi-slice (2+ enemies in 1 cut) deals 300% critical damage.',
    'aug_emp_title': 'EMP Shockwave',
    'aug_emp_desc': 'Slicing drones releases an EMP wave stunning enemies for 2s.',
    'aug_freeze_title': 'Time Singularity',
    'aug_freeze_desc': 'At SSS rank, Bullet Time completely freezes all hostile projectiles.',
    'aug_greed_title': 'Credit Siphon',
    'aug_greed_desc': '+100% nano-credits dropped from destroyed units.',
    'aug_range_title': 'Beam Focus',
    'aug_range_desc': 'Laser blade length and slice width expanded by 35%.',
    'aug_damage_title': 'Molecular Cleave',
    'aug_damage_desc': 'Base attack damage increased by 40%.',
    
    // Dojo / Hub
    'hub_title': 'CYBERNETICS HUB',
    'hub_stats_tab': 'NEURAL IMPLANTS',
    'hub_katanas_tab': 'KATANA ARMORY',
    'stat_max_hp': 'Exoskeleton Durability',
    'stat_chrono_cap': 'Chrono-Core Capacity',
    'stat_slice_power': 'Plasma Blade Sharpness',
    'stat_credit_boost': 'Nano-Credit Magnet',
    'lvl': 'LVL',
    
    // Katanas
    'katana_cyan_title': 'Neon Cyan',
    'katana_cyan_desc': 'Standard balanced cyber blade for tactical assassins.',
    'katana_crimson_title': 'Plasma Inferno',
    'katana_crimson_desc': 'High-temperature thermal blade with fiery trail (+30% damage).',
    'katana_violet_title': 'Quantum Void',
    'katana_violet_desc': 'Warps spacetime, extending bullet time duration (+40%).',
    'katana_gold_title': 'Solar Titan',
    'katana_gold_desc': 'Elite commander weapon with double critical slice chance.',
    
    // End Game
    'gameover_title': 'SYSTEM FAILURE',
    'gameover_desc': 'Exoskeleton compromised. Chrono-link severed.',
    'victory_title': 'SECTOR PURGED',
    'victory_desc': 'Apex Chronos eliminated! Cyber city sector liberated.',
    'stats_waves': 'Waves Survived:',
    'stats_kills': 'Robots Sliced:',
    'stats_max_combo': 'Max Combo Rank:',
    'stats_credits': 'Credits Salvaged:',
    'stats_score': 'Final Score:',
    
    // Controls Guide
    'ctrl_desktop_move': 'WASD / Arrow Keys — Movement',
    'ctrl_desktop_slice': 'Hold LMB + Swipe Mouse — Slice & Bullet Time',
    'ctrl_desktop_dash': 'SPACE / Shift — Dash Evade',
    'ctrl_desktop_overdrive': 'E / Q — Trigger Overdrive',
    'ctrl_mobile_move': 'Left Stick — Move Character',
    'ctrl_mobile_slice': 'Swipe Screen — Slice in Bullet Time',
    'ctrl_mobile_dash': 'DASH Button — Evade',
    'ctrl_mobile_bt': 'TIME Button — Chrono-Focus',
    
    // Settings
    'settings_title': 'SYSTEM SETTINGS',
    'settings_sound': 'Sound FX',
    'settings_music': 'Synthwave Music',
    'settings_lang': 'Language / Язык',
    'settings_controls': 'Touch Controls'
  }
};

export class LocalizationService {
  private currentLocale: LocaleCode = 'ru';

  public setLocale(locale: LocaleCode): void {
    if (TRANSLATIONS[locale]) {
      this.currentLocale = locale;
    }
  }

  public getLocale(): LocaleCode {
    return this.currentLocale;
  }

  public t(key: string, fallback?: string): string {
    const table = TRANSLATIONS[this.currentLocale] || TRANSLATIONS.ru;
    return table[key] ?? fallback ?? key;
  }
}

export const i18n = new LocalizationService();
