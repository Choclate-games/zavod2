/**
 * Localization system. Language is resolved once at boot from the platform, then
 * `translateDOM` is run against the UI. Every user-visible string goes through
 * `t()`. Touch-mode strings use a `_touch` sibling so phones never see
 * keyboard instructions.
 */

type Dict = Record<string, string>;

const en: Dict = {
  title: 'Атмосферную three.js о смотрителе 3D',
  'menu.play': 'Dive',
  'menu.play_touch': 'Dive',
  'menu.how': 'How to play',
  'menu.best': 'Best depth',
  'menu.samples': 'Gears',
  'how.title': 'How to play',
  'how.body': 'Descend into the trench and gather glowing samples. Light, air and hull are one shared budget — you cannot spend them all at once. Bright light and hard thrust burn energy; energy gone, the dark closes in. Air drains as you go deeper; return to the surface to breathe. Hull breaks on impacts and creature contact.',
  'how.controls': 'Move: WASD / stick. Ascend: Space / Ascend. Descend: Shift. Pulse (attack): J / Pulse. Heavy pulse: K. Pause: P.',
  'how.controls_touch': 'Left stick: move. Ascend / Descend buttons. Pulse: big button. Heavy: small button. Pause: top button.',
  'hud.air': 'AIR',
  'hud.energy': 'POWER',
  'hud.hull': 'HULL',
  'hud.depth': 'Depth',
  'hud.samples': 'Gears',
  'hud.wave': 'Wave',
  'hud.hype': 'Favor',
  'pause.title': 'Paused',
  'pause.resume': 'Resume',
  'pause.menu': 'Quit to menu',
  'pause.mute': 'Mute',
  'results.victory': 'Surfaced!',
  'results.defeat': 'Lost at depth',
  'results.depth': 'Depth reached',
  'results.samples': 'Gears collected',
  'results.wave': 'Wave reached',
  'results.retry': 'Dive again',
  'results.menu': 'Menu',
  'results.revive': 'Second Wind (revive)',
  'results.double': 'Double gears (2x)',
  'upgrade.title': 'Choose an upgrade',
  'upgrade.reroll': 'Reroll cards',
  'upgrade.rare': 'Rare',
  'upgrade.epic': 'Epic',
  'upgrade.common': 'Common',
  'up.air.name': 'Reinforced Tanks',
  'up.air.desc': '+30 max air and faster refill at the surface.',
  'up.hull.name': 'Hull Plating',
  'up.hull.desc': '+35 max hull integrity.',
  'up.energy.name': 'Fusion Cell',
  'up.energy.desc': '+40 max power and quicker regen.',
  'up.light.name': 'Beam Focus',
  'up.light.desc': 'Spotlight reaches farther for the same power.',
  'up.pulse.name': 'Resonant Pulse',
  'up.pulse.desc': '+45% sonar pulse damage.',
  'up.heavy.name': 'Depth Charge',
  'up.heavy.desc': '+60% heavy pulse damage and radius.',
  'up.thrust.name': 'Thruster Tune',
  'up.thrust.desc': '+25% thrust and top speed.',
  'up.regen.name': 'Scavenger',
  'up.regen.desc': 'Each sample also restores a little hull.',
  'loading.title': 'Preparing the trench',
  'toast.descend': 'Dive deeper — air is draining',
  'toast.lowair': 'Air critical — return to surface!',
  'toast.waveclear': 'Wave cleared!',
  'toast.upgrade': 'Upgrade installed',
  'toast.favor': 'Favor overflow — bonus gears!',
  'ads.revive': 'Second Wind',
  'ads.double': 'Double gears (2x)',
  'ads.reroll': 'Reroll cards',
  'common.ok': 'OK',
};

const ru: Dict = {
  title: 'Атмосферную three.js о смотрителе 3D',
  'menu.play': 'Нырнуть',
  'menu.play_touch': 'Нырнуть',
  'menu.how': 'Как играть',
  'menu.best': 'Рекорд глубины',
  'menu.samples': 'Шестерни',
  'how.title': 'Как играть',
  'how.body': 'Спускайтесь в жёлоб и собирайте светящиеся образцы. Свет, воздух и прочность корпуса — один общий запас: тратить их одновременно нельзя. Яркий свет и сильная тяга жгут энергию; кончилась энергия — тьма сжимается. Воздух уходит глубже; вернитесь к поверхности, чтобы дышать. Корпус бьётся об удары и тварей.',
  'how.controls': 'Движение: WASD / стик. Всплытие: Space / «Вверх». Погружение: Shift. Импульс (атака): J / «Импульс». Тяжёлый импульс: K. Пауза: P.',
  'how.controls_touch': 'Левый стик: движение. Кнопки «Вверх» / «Вниз». Импульс: большая кнопка. Тяжёлый: маленькая. Пауза: верхняя кнопка.',
  'hud.air': 'ВОЗДУХ',
  'hud.energy': 'ЭНЕРГИЯ',
  'hud.hull': 'КОРПУС',
  'hud.depth': 'Глубина',
  'hud.samples': 'Шестерни',
  'hud.wave': 'Волна',
  'hud.hype': 'Расположение',
  'pause.title': 'Пауза',
  'pause.resume': 'Продолжить',
  'pause.menu': 'Выйти в меню',
  'pause.mute': 'Звук',
  'results.victory': 'Всплыл!',
  'results.defeat': 'Погиб на глубине',
  'results.depth': 'Достигнутая глубина',
  'results.samples': 'Собрано шестерен',
  'results.wave': 'Достигнутая волна',
  'results.retry': 'Нырнуть снова',
  'results.menu': 'Меню',
  'results.revive': 'Второе дыхание (возрождение)',
  'results.double': 'Удвоить шестерни (2x)',
  'upgrade.title': 'Выберите улучшение',
  'upgrade.reroll': 'Перемешать карты',
  'upgrade.rare': 'Редкое',
  'upgrade.epic': 'Эпическое',
  'upgrade.common': 'Обычное',
  'up.air.name': 'Укреплённые баллоны',
  'up.air.desc': '+30 к макс. воздуху и быстрее восполнение у поверхности.',
  'up.hull.name': 'Броня корпуса',
  'up.hull.desc': '+35 к макс. прочности корпуса.',
  'up.energy.name': 'Изотопная ячейка',
  'up.energy.desc': '+40 к макс. энергии и быстрее регенерация.',
  'up.light.name': 'Фокус луча',
  'up.light.desc': 'Прожектор бьёт дальше при той же энергии.',
  'up.pulse.name': 'Резонансный импульс',
  'up.pulse.desc': '+45% к урону сонарного импульса.',
  'up.heavy.name': 'Глубинная бомба',
  'up.heavy.desc': '+60% урон и радиус тяжёлого импульса.',
  'up.thrust.name': 'Настройка двигателя',
  'up.thrust.desc': '+25% к тяге и макс. скорости.',
  'up.regen.name': 'Собиратель',
  'up.regen.desc': 'Каждый образец восстанавливает немного корпуса.',
  'loading.title': 'Готовим жёлоб',
  'toast.descend': 'Глубже — воздух уходит',
  'toast.lowair': 'Воздух на исходе — к поверхности!',
  'toast.waveclear': 'Волна очищена!',
  'toast.upgrade': 'Улучшение установлено',
  'toast.favor': 'Расположение переполнено — бонус!',
  'ads.revive': 'Второе дыхание',
  'ads.double': 'Удвоить шестерни (2x)',
  'ads.reroll': 'Перемешать карты',
  'common.ok': 'ОК',
};

export class I18nManager {
  private currentLang: string = 'en';
  private touchMode = false;
  private readonly dicts: Record<string, Dict> = { en, ru };

  setLanguage(lang: string): void {
    this.currentLang = this.dicts[lang] ? lang : 'en';
  }

  setTouchMode(on: boolean): void {
    this.touchMode = on;
  }

  get lang(): string {
    return this.currentLang;
  }

  t(key: string, params?: Record<string, string | number>): string {
    const dict = this.dicts[this.currentLang] ?? en;
    const touchKey = this.touchMode ? `${key}_touch` : null;
    let text =
      (touchKey && (dict[touchKey] ?? en[touchKey])) ||
      dict[key] ||
      en[key] ||
      key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  }

  translateDOM(root: ParentNode = document): void {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const val = this.t(el.getAttribute('data-i18n') ?? '');
      if (el instanceof HTMLElement) {
        if (el.dataset.i18nHtml === 'true') el.innerHTML = val;
        else el.textContent = val;
      }
    });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      if (el instanceof HTMLElement) el.setAttribute('title', this.t(el.getAttribute('data-i18n-title') ?? ''));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      if (el instanceof HTMLElement) el.setAttribute('placeholder', this.t(el.getAttribute('data-i18n-placeholder') ?? ''));
    });
    if (root instanceof Document || root === document) {
      document.documentElement.lang = this.currentLang;
    }
  }
}

export const i18n = new I18nManager();
