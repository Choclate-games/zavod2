import type { EventBus } from '../core/EventBus';
import type { InputManager } from '../input/InputManager';
import type { AudioManager } from '../audio/AudioManager';
import type { RunResult, SaveData, TruckId, TruckUpgrades } from '../core/types';
import type { LevelConfig } from '../world/levels';
import { LEVELS, getLevelConfig } from '../world/levels';
import { TRUCKS, getCargoPackage, getTruckConfig } from '../vehicle/truckSpec';

interface HudState {
  speed: number;
  cargo: number;
  totalCargo: number;
  progress: number;
  mud?: number;
  water?: number;
  mudLevel?: number;
  forkPrompt?: string;
}

const COLOR_PALETTE = [
  { name: 'Лесной Оранж', hex: '#c75c32' },
  { name: 'Таёжный Небесный', hex: '#3d7ea6' },
  { name: 'Армейский Хаки', hex: '#475e3a' },
  { name: 'Экспедиционный Рубин', hex: '#a83232' },
  { name: 'Золотой Песок', hex: '#c29b38' },
  { name: 'Спецназ Графит', hex: '#36383b' },
];

export class UIManager {
  readonly layer = document.createElement('div');
  readonly hud = document.createElement('div');

  // HUD Elements
  private readonly cargoFill = document.createElement('div');
  private readonly progressFill = document.createElement('div');
  private readonly speedNumber = document.createElement('div');
  private readonly cargoText = document.createElement('div');
  private readonly mudBadge = document.createElement('div');

  private readonly input: InputManager;
  private readonly audio: AudioManager;
  private state: 'menu' | 'garage' | 'level-select' | 'running' | 'paused' | 'result' = 'menu';
  private toastTimer = 0;
  private currentSave: SaveData | null = null;

  constructor(root: HTMLElement, private readonly events: EventBus, input: InputManager, audio: AudioManager) {
    this.input = input;
    this.audio = audio;

    const shell = document.createElement('div');
    shell.className = 'game-shell';

    this.layer.className = 'ui-layer';
    this.hud.className = 'hud hidden';

    this.layer.append(this.hud);
    shell.append(this.layer, input.touchLayer);
    root.append(shell);

    document.addEventListener('contextmenu', this.preventGesture, true);
    document.addEventListener('selectstart', this.preventGesture, true);
    document.addEventListener('dragstart', this.preventGesture, true);

    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  private onResize = (): void => {
    const isPortrait = window.innerWidth < window.innerHeight;
    this.layer.classList.toggle('portrait', isPortrait);
    this.layer.classList.toggle('landscape', !isPortrait);
    this.hud.classList.toggle('portrait', isPortrait);
    this.hud.classList.toggle('landscape', !isPortrait);
  };

  showMenu(save: SaveData): void {
    this.currentSave = save;
    this.state = 'menu';
    this.input.setEnabled(false);
    this.input.touchLayer.classList.remove('visible');
    this.clearScreen();

    const screen = this.createScreen();
    const panel = document.createElement('div');
    panel.className = 'panel menu-panel';

    const isMuted = save.settings.muted;
    this.audio.setMuted(isMuted);

    const activeLevel = getLevelConfig(save.currentLevel || 1);
    const activeTruck = getTruckConfig(save.selectedTruck || 'zil');
    const activePkg = getCargoPackage(activeLevel.cargoPackage || 'logs');
    const currentUpgrades = save.truckUpgrades[save.selectedTruck] || save.truckUpgrades.zil;

    panel.innerHTML = `
       <div class="menu-badge">🌲 Сезон 01 · Таёжная экспедиция</div>
       <h1 class="game-title">Тайга: Экспедиция</h1>
      <p class="subtitle">Управляй джойстиком сквозь сибирскую тайгу, преодолевай броды и топи, не теряя груз!</p>
      
      <div class="menu-truck-card">
        <div class="truck-avatar" style="border-color: ${currentUpgrades.color || '#c75c32'}">
          <span style="font-size: 24px;">🚛</span>
        </div>
        <div class="truck-info">
          <div class="truck-title">${activeTruck.name}</div>
          <div class="truck-sub">${activeTruck.subtitle}</div>
        </div>
        <div class="truck-tag">В СТРОЮ</div>
      </div>
    `;

    const startBtn = this.button(`🚀 В рейс! · Ур. ${activeLevel.id} (${activePkg.icon} ${activePkg.tag})`, true);
    startBtn.className = 'primary-btn play-btn';
    startBtn.addEventListener('click', () => this.events.emit('game:start', { level: activeLevel.id }));

    const grid = document.createElement('div');
    grid.className = 'menu-grid-buttons';

    const garageBtn = this.button(`🏢 Гараж и Тюнинг`, false);
    garageBtn.className = 'ghost-btn menu-grid-btn';
    garageBtn.addEventListener('click', () => this.showGarage(save));

    const levelSelectBtn = this.button('🗺️ Выбор уровня (50)', false);
    levelSelectBtn.className = 'ghost-btn menu-grid-btn';
    levelSelectBtn.addEventListener('click', () => this.showLevelSelect(save));

    const soundToggleBtn = this.button(`🔊 Звук: ${save.settings.muted ? 'ВЫКЛ' : 'ВКЛ'}`, false);
    soundToggleBtn.className = 'ghost-btn menu-grid-btn';
    soundToggleBtn.addEventListener('click', () => {
      save.settings.muted = !save.settings.muted;
      this.audio.setMuted(save.settings.muted);
      soundToggleBtn.textContent = `🔊 Звук: ${save.settings.muted ? 'ВЫКЛ' : 'ВКЛ'}`;
      this.events.emit('game:save', undefined);
    });

    grid.append(garageBtn, levelSelectBtn, soundToggleBtn);

    const meta = document.createElement('div');
    meta.className = 'menu-meta';
    meta.innerHTML = `
      <div class="meta-item"><strong>🪙 ${save.coins}</strong><span>монет</span></div>
      <div class="meta-item"><strong>🚛 ${save.unlockedTrucks.length}/4</strong><span>машины</span></div>
      <div class="meta-item"><strong>🗺️ ${save.unlockedLevels}/50</strong><span>трасс</span></div>
      <div class="meta-item"><strong>⚙️ ${currentUpgrades.engine + currentUpgrades.tires}</strong><span>улучшений</span></div>
    `;

    panel.append(startBtn, grid, meta);
    screen.append(panel);
    this.layer.append(screen);
  }

  showGarage(save: SaveData, previewTruckId?: TruckId): void {
    this.currentSave = save;
    this.state = 'garage';
    this.input.setEnabled(false);
    this.input.touchLayer.classList.remove('visible');
    this.clearScreen();

    const currentTruckId = previewTruckId || save.selectedTruck || 'zil';
    const truckCfg = getTruckConfig(currentTruckId);
    const isUnlocked = save.unlockedTrucks.includes(currentTruckId);
    const isEquipped = save.selectedTruck === currentTruckId;

    const truckUpgrades: TruckUpgrades = save.truckUpgrades[currentTruckId] || {
      engine: 0,
      tires: 0,
      suspension: 0,
      sides: 0,
      color: truckCfg.defaultColor,
    };

    // Live 3D showroom update
    this.events.emit('game:garage-preview', { truckId: currentTruckId, color: truckUpgrades.color });

    const screen = this.createScreen();
    screen.classList.add('garage-screen');
    const panel = document.createElement('div');
    panel.className = 'panel garage-panel';

    // Header & Balance
    const allTruckIds: TruckId[] = ['zil', 'gaz', 'kraz', 'ural'];
    const tuningPoints = truckUpgrades.engine + truckUpgrades.tires + truckUpgrades.suspension + truckUpgrades.sides;
    panel.innerHTML = `
      <div class="garage-header">
        <div class="garage-header-main">
          <button class="garage-back" aria-label="Вернуться в меню">←</button>
          <div>
            <div class="eyebrow">Мастерская и автопарк</div>
            <h2>ГАРАЖ</h2>
          </div>
        </div>
        <div class="garage-resources">
          <div class="garage-coins">🪙 <strong>${save.coins}</strong></div>
          <div class="garage-parts">🔧 <strong>${tuningPoints}</strong></div>
        </div>
      </div>
    `;
    panel.querySelector<HTMLButtonElement>('.garage-back')?.addEventListener('click', () => this.showMenu(save));

    const garageMain = document.createElement('div');
    garageMain.className = 'garage-main';

    const infoColumn = document.createElement('div');
    infoColumn.className = 'garage-info-column';

    const showroom = document.createElement('div');
    showroom.className = 'garage-showroom';
    showroom.innerHTML = `
      <div class="garage-showroom-label">3D ПРОСМОТР</div>
      <div class="garage-showroom-hint">Автоматический осмотр автомобиля</div>
    `;
    const previewButton = (direction: -1 | 1, label: string): HTMLButtonElement => {
      const button = document.createElement('button');
      button.className = 'garage-preview-arrow';
      button.textContent = label;
      button.setAttribute('aria-label', direction < 0 ? 'Предыдущий автомобиль' : 'Следующий автомобиль');
      const currentIndex = allTruckIds.indexOf(currentTruckId);
      const nextIndex = (currentIndex + direction + allTruckIds.length) % allTruckIds.length;
      button.addEventListener('click', () => this.showGarage(save, allTruckIds[nextIndex]));
      return button;
    };
    showroom.append(previewButton(-1, '‹'), previewButton(1, '›'));

    // Truck Carousel Selector Tabs
    const truckTabs = document.createElement('div');
    truckTabs.className = 'truck-tabs';

    for (const tid of allTruckIds) {
      const t = TRUCKS[tid];
      const owned = save.unlockedTrucks.includes(tid);
      const active = tid === currentTruckId;
      const tab = document.createElement('button');
      tab.className = `truck-tab ${active ? 'active' : ''} ${owned ? '' : 'locked'}`;
      tab.innerHTML = `
        <div class="truck-tab-icon">${owned ? '🚚' : '🔒'}</div>
        <div class="truck-tab-name">${t.name}</div>
        <div class="truck-tab-tag">${owned ? (tid === save.selectedTruck ? '✓ В строю' : 'В гараже') : `Открывается за ${t.price} 🪙`}</div>
      `;
      tab.addEventListener('click', () => {
        this.showGarage(save, tid);
      });
      truckTabs.append(tab);
    }
    // Selected Truck Profile Card
    const profile = document.createElement('div');
    profile.className = 'truck-profile garage-profile';
    profile.innerHTML = `
      <div class="profile-top">
        <div>
          <h3>${truckCfg.name}</h3>
          <p class="profile-subtitle">${truckCfg.subtitle}</p>
        </div>
        <div class="profile-badge ${isEquipped ? 'equipped' : isUnlocked ? 'unlocked' : 'locked'}">
          ${isEquipped ? '✓ АКТИВЕН' : isUnlocked ? 'КУПЛЕН' : `ЦЕНА: ${truckCfg.price} 🪙`}
        </div>
      </div>
      <p class="profile-desc">${truckCfg.description}</p>
    `;
    infoColumn.append(profile);

    // Vehicle Stats Meters
    const statsWrap = document.createElement('div');
    statsWrap.className = 'truck-stats-grid';

    const powerPct = Math.min(100, Math.round(((truckCfg.ratings.power + truckUpgrades.engine * 0.4) / 6.5) * 100));
    const speedPct = Math.min(100, Math.round(((truckCfg.ratings.speed + truckUpgrades.engine * 0.3) / 6.0) * 100));
    const offroadPct = Math.min(100, Math.round(((truckCfg.ratings.offroad + truckUpgrades.tires * 0.5) / 6.5) * 100));
    const safetyPct = Math.min(100, Math.round(((truckCfg.ratings.safety + truckUpgrades.sides * 0.6) / 6.5) * 100));

    statsWrap.innerHTML = `
      <div class="stat-bar-item">
        <div class="stat-bar-header"><span>⚡ Мощность и тяга</span><strong>${powerPct}%</strong></div>
        <div class="stat-track"><div class="stat-fill" style="width: ${powerPct}%; background: #e87832;"></div></div>
      </div>
      <div class="stat-bar-item">
        <div class="stat-bar-header"><span>🏎️ Скорость</span><strong>${speedPct}%</strong></div>
        <div class="stat-track"><div class="stat-fill" style="width: ${speedPct}%; background: #e8ad61;"></div></div>
      </div>
      <div class="stat-bar-item">
        <div class="stat-bar-header"><span>🛞 Проходимость в грязи</span><strong>${offroadPct}%</strong></div>
        <div class="stat-track"><div class="stat-fill" style="width: ${offroadPct}%; background: #5d9f66;"></div></div>
      </div>
      <div class="stat-bar-item">
        <div class="stat-bar-header"><span>📦 Защита бортов</span><strong>${safetyPct}%</strong></div>
        <div class="stat-track"><div class="stat-fill" style="width: ${safetyPct}%; background: #3d7ea6;"></div></div>
      </div>
    `;
    statsWrap.classList.add('garage-stats');

    // Color Swatch Paint Shop
    const colorSection = document.createElement('div');
    colorSection.className = 'color-section';
    colorSection.innerHTML = '<div class="section-title">🎨 Заводская покраска кабины:</div>';

    const swatchRow = document.createElement('div');
    swatchRow.className = 'color-swatches';

    for (const c of COLOR_PALETTE) {
      const swatch = document.createElement('button');
      swatch.className = `color-swatch ${truckUpgrades.color === c.hex ? 'active' : ''}`;
      swatch.style.backgroundColor = c.hex;
      swatch.title = c.name;
      swatch.addEventListener('click', () => {
        truckUpgrades.color = c.hex;
        save.truckUpgrades[currentTruckId] = truckUpgrades;
        this.events.emit('game:garage-preview', { truckId: currentTruckId, color: c.hex });
        this.events.emit('game:save', undefined);
        this.showGarage(save, currentTruckId);
      });
      swatchRow.append(swatch);
    }
    colorSection.append(swatchRow);
    colorSection.classList.add('garage-paint');

    // Upgrades Grid (Engine, Tires, Suspension, Sides)
    const upgradesSection = document.createElement('div');
    upgradesSection.className = 'garage-upgrades-wrap';
    upgradesSection.innerHTML = '<div class="section-title">⚙️ Модернизация узлов:</div>';

    const upgradeGrid = document.createElement('div');
    upgradeGrid.className = 'garage-grid';

    // Helper to render pips
    const renderPips = (current: number, max: number): string => {
      let pips = '';
      for (let i = 0; i < max; i += 1) {
        pips += `<span class="pip ${i < current ? 'filled' : ''}"></span>`;
      }
      return `<div class="pips-wrap">${pips}</div>`;
    };

    // 1. Engine Upgrade (0..5)
    const engCost = 80 + truckUpgrades.engine * 50;
    const engCard = document.createElement('div');
    engCard.className = 'garage-card';
    engCard.innerHTML = `
      <div class="card-head">
        <h4>⚙️ Двигатель</h4>
        ${renderPips(truckUpgrades.engine, 5)}
      </div>
      <p>+Тяга и крутящий момент на крутых подъёмах</p>
    `;
    if (truckUpgrades.engine < 5) {
      const btn = this.button(save.coins >= engCost ? `Улучшить · ${engCost} 🪙` : `${engCost} 🪙 (мало монет)`, false);
      btn.disabled = save.coins < engCost || !isUnlocked;
      btn.addEventListener('click', () => {
        if (save.coins < engCost || !isUnlocked) return;
        save.coins -= engCost;
        truckUpgrades.engine += 1;
        save.truckUpgrades[currentTruckId] = truckUpgrades;
        this.events.emit('game:save', undefined);
        this.toast('Двигатель улучшен!', 'good');
        this.showGarage(save, currentTruckId);
      });
      engCard.append(btn);
    } else {
      engCard.innerHTML += '<div class="tag max-tag">МАКС. УРОВЕНЬ</div>';
    }

    // 2. Mud Tires Upgrade (0..4)
    const tiresCost = 70 + truckUpgrades.tires * 55;
    const tiresCard = document.createElement('div');
    tiresCard.className = 'garage-card';
    tiresCard.innerHTML = `
      <div class="card-head">
        <h4>🛞 Грязевые шины</h4>
        ${renderPips(truckUpgrades.tires, 4)}
      </div>
      <p>+Сцепление и грунтозацепы в болотах и бродах</p>
    `;
    if (truckUpgrades.tires < 4) {
      const btn = this.button(save.coins >= tiresCost ? `Купить · ${tiresCost} 🪙` : `${tiresCost} 🪙 (мало монет)`, false);
      btn.disabled = save.coins < tiresCost || !isUnlocked;
      btn.addEventListener('click', () => {
        if (save.coins < tiresCost || !isUnlocked) return;
        save.coins -= tiresCost;
        truckUpgrades.tires += 1;
        save.truckUpgrades[currentTruckId] = truckUpgrades;
        this.events.emit('game:save', undefined);
        this.toast('Шины установлены!', 'good');
        this.showGarage(save, currentTruckId);
      });
      tiresCard.append(btn);
    } else {
      tiresCard.innerHTML += '<div class="tag max-tag">МАКС. УРОВЕНЬ</div>';
    }

    // 3. Suspension Upgrade (0..3)
    const suspCost = 65 + truckUpgrades.suspension * 60;
    const suspCard = document.createElement('div');
    suspCard.className = 'garage-card';
    suspCard.innerHTML = `
      <div class="card-head">
        <h4>🔩 Подвеска & Лифт</h4>
        ${renderPips(truckUpgrades.suspension, 3)}
      </div>
      <p>+Жесткость амортизаторов, гашение раскачки</p>
    `;
    if (truckUpgrades.suspension < 3) {
      const btn = this.button(save.coins >= suspCost ? `Усилить · ${suspCost} 🪙` : `${suspCost} 🪙 (мало монет)`, false);
      btn.disabled = save.coins < suspCost || !isUnlocked;
      btn.addEventListener('click', () => {
        if (save.coins < suspCost || !isUnlocked) return;
        save.coins -= suspCost;
        truckUpgrades.suspension += 1;
        save.truckUpgrades[currentTruckId] = truckUpgrades;
        this.events.emit('game:save', undefined);
        this.toast('Подвеска усилена!', 'good');
        this.showGarage(save, currentTruckId);
      });
      suspCard.append(btn);
    } else {
      suspCard.innerHTML += '<div class="tag max-tag">МАКС. УРОВЕНЬ</div>';
    }

    // 4. Cargo Bed Sides Upgrade (0..3)
    const sidesCost = 75 + truckUpgrades.sides * 65;
    const sidesCard = document.createElement('div');
    sidesCard.className = 'garage-card';
    sidesCard.innerHTML = `
      <div class="card-head">
        <h4>📦 Высокие борта</h4>
        ${renderPips(truckUpgrades.sides, 3)}
      </div>
      <p>+Защита от вылетания брёвен и ящиков</p>
    `;
    if (truckUpgrades.sides < 3) {
      const btn = this.button(save.coins >= sidesCost ? `Нарастить · ${sidesCost} 🪙` : `${sidesCost} 🪙 (мало монет)`, false);
      btn.disabled = save.coins < sidesCost || !isUnlocked;
      btn.addEventListener('click', () => {
        if (save.coins < sidesCost || !isUnlocked) return;
        save.coins -= sidesCost;
        truckUpgrades.sides += 1;
        save.truckUpgrades[currentTruckId] = truckUpgrades;
        this.events.emit('game:save', undefined);
        this.toast('Борта кузова нарощены!', 'good');
        this.showGarage(save, currentTruckId);
      });
      sidesCard.append(btn);
    } else {
      sidesCard.innerHTML += '<div class="tag max-tag">МАКС. УРОВЕНЬ</div>';
    }

    upgradeGrid.append(engCard, tiresCard, suspCard, sidesCard);
    upgradesSection.append(upgradeGrid);
    const upgradeColumn = document.createElement('div');
    upgradeColumn.className = 'garage-upgrade-column';
    upgradeColumn.append(upgradesSection);

    // Equip / Buy Primary Button Bar
    const primaryBar = document.createElement('div');
    primaryBar.className = 'garage-primary-bar';

    if (!isUnlocked) {
      const buyTruckBtn = this.button(`🛒 Купить грузовик за ${truckCfg.price} 🪙`, true);
      buyTruckBtn.disabled = save.coins < truckCfg.price;
      buyTruckBtn.addEventListener('click', () => {
        if (save.coins < truckCfg.price) return;
        save.coins -= truckCfg.price;
        save.unlockedTrucks.push(currentTruckId);
        save.selectedTruck = currentTruckId;
        this.events.emit('game:save', undefined);
        this.toast(`Грузовик ${truckCfg.name} куплен!`, 'good');
        this.showGarage(save, currentTruckId);
      });
      primaryBar.append(buyTruckBtn);
    } else if (!isEquipped) {
      const selectTruckBtn = this.button(`✓ Выбрать «${truckCfg.name}» для рейсов`, true);
      selectTruckBtn.addEventListener('click', () => {
        save.selectedTruck = currentTruckId;
        this.events.emit('game:save', undefined);
        this.toast(`Выбран ${truckCfg.name}`, 'good');
        this.showGarage(save, currentTruckId);
      });
      primaryBar.append(selectTruckBtn);
    } else {
      const driveBtn = this.button(`В рейс на «${truckCfg.name}»!`, true);
      driveBtn.addEventListener('click', () => {
        this.events.emit('game:start', { level: save.currentLevel || 1, truck: save.selectedTruck });
      });
      primaryBar.append(driveBtn);
    }
    upgradeColumn.append(primaryBar);

    garageMain.append(infoColumn, showroom, statsWrap, colorSection, upgradeColumn);
    panel.append(garageMain, truckTabs);

    // Navigation mirrors the reference layout and keeps real destinations available.
    const navRow = document.createElement('nav');
    navRow.className = 'garage-bottom-nav';
    const baseNav = this.button('🚚 АВТОБАЗА', false);
    baseNav.className = 'garage-nav-btn active';
    baseNav.disabled = true;
    const mapNav = this.button('🗺️ КАРТА', false);
    mapNav.className = 'garage-nav-btn';
    mapNav.addEventListener('click', () => this.showLevelSelect(save));
    const tasksNav = this.button('📋 ЗАДАНИЯ', false);
    tasksNav.className = 'garage-nav-btn';
    tasksNav.addEventListener('click', () => this.showLevelSelect(save));
    const shopNav = this.button('🛒 МАГАЗИН', false);
    shopNav.className = 'garage-nav-btn';
    shopNav.addEventListener('click', () => this.showGarage(save, currentTruckId));
    navRow.append(baseNav, mapNav, tasksNav, shopNav);
    panel.append(navRow);

    screen.append(panel);
    this.layer.append(screen);
  }

  showLevelSelect(save: SaveData, activeTab = 0): void {
    this.currentSave = save;
    this.state = 'level-select';
    this.input.setEnabled(false);
    this.input.touchLayer.classList.remove('visible');
    this.clearScreen();

    const screen = this.createScreen();
    const panel = document.createElement('div');
    panel.className = 'panel level-panel';
    panel.innerHTML = `
      <div class="eyebrow">Карта маршрутов</div>
      <h2>Выбор уровня (1–50)</h2>
      <p class="subtitle" style="margin-bottom: 10px;">Выбирай трассу: от таёжных просек до экстремальных перевалов!</p>
    `;

    // Chapter Tab Navigation (1–10, 11–20, 21–30, 31–40, 41–50)
    const tabsRow = document.createElement('div');
    tabsRow.className = 'level-tabs';
    const chapters = ['1–10', '11–20', '21–30', '31–40', '41–50'];

    chapters.forEach((title, idx) => {
      const tab = document.createElement('button');
      tab.className = `ghost-btn level-tab ${idx === activeTab ? 'active' : ''}`;
      tab.textContent = title;
      tab.addEventListener('click', () => this.showLevelSelect(save, idx));
      tabsRow.append(tab);
    });
    panel.append(tabsRow);

    const grid = document.createElement('div');
    grid.className = 'level-grid';

    const startIdx = activeTab * 10;
    const endIdx = startIdx + 10;
    const filteredLevels = LEVELS.slice(startIdx, endIdx);

    for (const lvl of filteredLevels) {
      const fullLvl = getLevelConfig(lvl.id);
      const isUnlocked = lvl.id <= (save.unlockedLevels || 1);
      const isCurrent = lvl.id === save.currentLevel;
      const starsCount = save.levelStars[lvl.id] ?? 0;
      const starsStr = isUnlocked ? (starsCount > 0 ? '⭐'.repeat(starsCount) : '☆☆☆') : '🔒';
      const pkg = getCargoPackage(fullLvl.cargoPackage);

      const card = document.createElement('div');
      card.className = `level-card ${isUnlocked ? '' : 'locked'} ${isCurrent ? 'current' : ''}`;
      const forkTag = (fullLvl.forks && fullLvl.forks.length > 0)
        ? `<div class="fork-tag">🔀 Развилка</div>`
        : '';
      card.innerHTML = `
        <div class="num">${lvl.id}</div>
        <div class="name">${lvl.title.replace(/^\d+\.\s*/, '')}</div>
        <div class="cargo-tag">${pkg.icon} ${pkg.tag}</div>
        ${forkTag}
        <div class="tag">${lvl.tag} · ${lvl.length}м</div>
        <div class="stars">${starsStr}</div>
      `;

      if (isUnlocked) {
        card.addEventListener('click', () => {
          save.currentLevel = lvl.id;
          this.events.emit('game:start', { level: lvl.id });
        });
      }
      grid.append(card);
    }

    const actionRow = document.createElement('div');
    actionRow.className = 'action-row';
    actionRow.style.marginTop = '14px';

    const backBtn = this.button('← В меню', false);
    backBtn.addEventListener('click', () => this.showMenu(save));

    const garageBtn = this.button('🏢 В Гараж', false);
    garageBtn.addEventListener('click', () => this.showGarage(save));

    actionRow.append(backBtn, garageBtn);
    panel.append(grid, actionRow);
    screen.append(panel);
    this.layer.append(screen);
  }

  showHud(_level: LevelConfig): void {
    this.state = 'running';
    this.clearScreen();
    this.hud.classList.remove('hidden');
    this.hud.innerHTML = '';

    // 1. Top Compact HUD Bar
    const top = document.createElement('div');
    top.className = 'hud-top';

    // Center: cargo count only. Cargo type and route title stay out of gameplay HUD.
    const cargoCard = document.createElement('div');
    cargoCard.className = 'hud-card cargo-wrap';
    const cargoLabel = document.createElement('div');
    cargoLabel.className = 'hud-label';
    cargoLabel.textContent = 'ГРУЗ В КУЗОВЕ';
    const initialCargoTotal = getCargoPackage(_level.cargoPackage || 'logs').slots.length;
    this.cargoText.className = 'hud-value';
    this.cargoText.textContent = `${initialCargoTotal} / ${initialCargoTotal}`;
    this.cargoFill.className = 'bar-fill';
    this.cargoFill.style.width = '100%';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.append(this.cargoFill);
    cargoCard.append(cargoLabel, this.cargoText, bar);

    // Right: pause only. Sound remains available from the pause screen and menu.
    const rightControls = document.createElement('div');
    rightControls.className = 'hud-right-controls';

    const pause = this.button('⏸', false);
    pause.className = 'hud-control-btn pause-btn';
    pause.setAttribute('aria-label', 'Пауза');
    pause.addEventListener('click', () => this.events.emit('game:pause', { paused: true }));

    rightControls.append(pause);
    top.append(cargoCard, rightControls);
    this.hud.append(top);

    // Center Alert Badges (Mud, Water, Fork Prompts)
    this.mudBadge.className = 'hud-badge hidden';
    this.mudBadge.textContent = 'ВЯЗКАЯ ГРЯЗЬ';
    this.hud.append(this.mudBadge);

    // Speedometer & Progress Widget (Bottom Right)
    const speed = document.createElement('div');
    speed.className = 'speedometer';

    const speedValWrap = document.createElement('div');
    speedValWrap.className = 'speed-val-wrap';
    this.speedNumber.className = 'speed-number';
    this.speedNumber.textContent = '0';
    const unit = document.createElement('div');
    unit.className = 'speed-unit';
    unit.textContent = 'КМ/Ч';
    speedValWrap.append(this.speedNumber, unit);

    const track = document.createElement('div');
    track.className = 'progress-track';
    this.progressFill.className = 'progress-fill';
    track.append(this.progressFill);

    const trackLabels = document.createElement('div');
    trackLabels.className = 'progress-labels';
    trackLabels.innerHTML = '<span>🌲 Старт</span><span>Лесопилка 🏁</span>';

    speed.append(speedValWrap, track, trackLabels);
    this.hud.append(speed);

    this.input.setEnabled(true);
    this.input.touchLayer.classList.toggle('visible', this.touchEnabled());
  }

  setPaused(paused: boolean, save?: SaveData): void {
    if (this.state === 'result' || this.state === 'menu' || this.state === 'level-select' || this.state === 'garage') return;
    this.state = paused ? 'paused' : 'running';
    this.input.touchLayer.classList.toggle('visible', !paused && this.touchEnabled());

    if (paused) {
      const s = save || this.currentSave;
      const screen = this.createScreen();
      const panel = document.createElement('div');
      panel.className = 'panel pause-panel';
      panel.innerHTML = `
        <div class="eyebrow">Передышка на обочине</div>
        <h1>⏸ Пауза</h1>
        <p class="subtitle">Груз в кузове. Вернись на маршрут или загляни в Гараж для тюнинга.</p>
      `;

      const resume = this.button('▶ Продолжить рейс', true);
      resume.addEventListener('click', () => this.events.emit('game:pause', { paused: false }));

      const garageBtn = this.button('🏢 Автобаза и Гараж', false);
      garageBtn.style.marginTop = '10px';
      garageBtn.addEventListener('click', () => {
        if (s) this.showGarage(s);
      });

      const soundBtn = this.button(`🔊 Звук: ${s?.settings.muted ? 'ВЫКЛ' : 'ВКЛ'}`, false);
      soundBtn.style.marginTop = '10px';
      soundBtn.addEventListener('click', () => {
        if (s) {
          s.settings.muted = !s.settings.muted;
          this.audio.setMuted(s.settings.muted);
          soundBtn.textContent = `🔊 Звук: ${s.settings.muted ? 'ВЫКЛ' : 'ВКЛ'}`;
          this.events.emit('game:save', undefined);
        }
      });

      /* Steering inversion is intentionally hidden until the control model is finalized.
      const invertBtn = this.button(`🔄 Инверсия руля: ${s?.settings.invertSteering ? 'ВКЛ' : 'ВЫКЛ'}`, false);
      invertBtn.style.marginTop = '10px';
      invertBtn.addEventListener('click', () => {
        if (s) {
          s.settings.invertSteering = !s.settings.invertSteering;
          invertBtn.textContent = `🔄 Инверсия руля: ${s.settings.invertSteering ? 'ВКЛ' : 'ВЫКЛ'}`;
          this.events.emit('game:save', undefined);
        }
      });
      */

      const levelSelectBtn = this.button('🗺️ Выход в выбор уровней', false);
      levelSelectBtn.style.marginTop = '10px';
      levelSelectBtn.addEventListener('click', () => {
        if (s) this.showLevelSelect(s);
      });

      panel.append(resume, garageBtn, soundBtn, levelSelectBtn);
      screen.append(panel);
      this.layer.append(screen);
    } else {
      this.removeScreen();
    }
  }

  updateHud(state: HudState): void {
    const safeSpeed = Number.isFinite(state.speed) ? Math.max(0, state.speed) : 0;
    const safeTotalCargo = Math.max(0, Math.floor(state.totalCargo));
    const safeCargo = Math.min(safeTotalCargo, Math.max(0, Math.floor(state.cargo)));
    this.speedNumber.textContent = Math.round(safeSpeed).toString();
    this.cargoText.textContent = `${safeCargo} / ${safeTotalCargo}`;
    const ratio = safeCargo / Math.max(1, safeTotalCargo);
    this.cargoFill.style.width = `${ratio * 100}%`;
    this.cargoFill.style.background = ratio > 0.6 ? '#76bd6b' : ratio > 0.3 ? '#e8ad61' : '#d8574b';
    this.progressFill.style.width = `${Math.min(100, state.progress * 100)}%`;

    if (state.forkPrompt) {
      this.mudBadge.classList.remove('hidden');
      this.mudBadge.textContent = `🔀 РАЗВИЛКА: ${state.forkPrompt}`;
    } else if (state.water !== undefined && state.water > 0.18) {
      this.mudBadge.classList.remove('hidden');
      this.mudBadge.textContent = state.water > 0.5 ? '🌊 ГЛУБОКИЙ БРОД' : '🌊 АКВАПЛАНИРОВАНИЕ';
    } else if (state.mud !== undefined && state.mud > 0.22) {
      this.mudBadge.classList.remove('hidden');
      this.mudBadge.textContent = state.mud > 0.6 ? '🪨 ГЛУБОКАЯ ТОПЬ' : '🪨 ВЯЗКАЯ ГРЯЗЬ';
    } else {
      this.mudBadge.classList.add('hidden');
    }
  }

  showResult(result: RunResult, save: SaveData): void {
    this.currentSave = save;
    this.state = 'result';
    this.hud.classList.add('hidden');
    this.input.setEnabled(false);
    this.input.touchLayer.classList.remove('visible');
    this.audio.playFinish();
    this.clearScreen();

    const pkg = getCargoPackage(result.cargoPackage || 'logs');
    const truckCfg = getTruckConfig(save.selectedTruck || 'zil');

    const screen = this.createScreen();
    const panel = document.createElement('div');
    panel.className = 'panel result-panel';

    const starsStr = result.stars > 0 ? '⭐'.repeat(result.stars) : '☆☆☆';
    const isPerfect = result.delivered === result.total;

    panel.innerHTML = `
      <div class="eyebrow">Рейс завершён · Уровень ${result.levelId} · ${pkg.icon} ${pkg.title}</div>
      <div class="stars-wrap">${starsStr}</div>
      <h1>${isPerfect ? '🎉 Идеальная доставка!' : result.delivered > 0 ? 'Груз доставлен!' : '💥 Груз потерян!'}</h1>
      <p class="subtitle">Лесопилка приняла твой рейс. Модернизируй грузовик в Гараже или накопи на новый вездеход!</p>
    `;

    const stats = document.createElement('div');
    stats.className = 'result-stats';
    stats.innerHTML = `
      <div class="stat"><strong>${result.delivered}/${result.total}</strong><span>${pkg.tag}</span></div>
      <div class="stat"><strong>+${result.coins}</strong><span>🪙 монет</span></div>
      <div class="stat"><strong>${Math.round(result.duration)}с</strong><span>время</span></div>
    `;
    panel.append(stats);

    // Quick tuning banner
    const garageBanner = document.createElement('div');
    garageBanner.className = 'result-garage-banner';
    garageBanner.innerHTML = `
      <div><strong>🏢 Гараж: ${truckCfg.name}</strong><br><span style="font-size:12px; color:var(--muted)">Баланс: 🪙 ${save.coins} монет</span></div>
    `;
    const toGarageBtn = this.button('🏢 В Гараж & Тюнинг', false);
    toGarageBtn.addEventListener('click', () => this.showGarage(save));
    garageBanner.append(toGarageBtn);
    panel.append(garageBanner);

    // Action buttons
    const actionRow = document.createElement('div');
    actionRow.className = 'action-row';

    if (result.levelId < 50 && save.unlockedLevels > result.levelId) {
      const nextLevel = this.button(`След. уровень (${result.levelId + 1}) →`, true);
      nextLevel.addEventListener('click', () => {
        save.currentLevel = result.levelId + 1;
        this.events.emit('game:start', { level: result.levelId + 1 });
      });
      actionRow.append(nextLevel);
    }

    const replay = this.button('Повторить', result.levelId >= 50 || save.unlockedLevels <= result.levelId);
    replay.addEventListener('click', () => this.events.emit('game:start', { level: result.levelId }));

    const levelsBtn = this.button('Все уровни', false);
    levelsBtn.addEventListener('click', () => this.showLevelSelect(save, Math.floor((result.levelId - 1) / 10)));

    actionRow.append(replay, levelsBtn);
    panel.append(actionRow);

    screen.append(panel);
    this.layer.append(screen);
  }

  toast(text: string, tone: 'good' | 'warn' | 'bad'): void {
    const node = document.createElement('div');
    node.className = `toast ${tone}`;
    node.textContent = text;
    this.layer.append(node);
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => node.remove(), 1800);
  }

  private createScreen(): HTMLDivElement {
    const screen = document.createElement('div');
    screen.className = 'screen';
    return screen;
  }

  private button(text: string, primary: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = primary ? 'primary-btn' : 'ghost-btn';
    button.textContent = text;
    return button;
  }

  private clearScreen(): void {
    this.removeScreen();
    this.hud.classList.add('hidden');
  }

  private removeScreen(): void {
    this.layer.querySelector('.screen')?.remove();
  }

  private touchEnabled(): boolean {
    const forced = new URLSearchParams(window.location.search).get('touch');
    if (forced === '1') return true;
    if (forced === '0') return false;
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches ||
      window.innerWidth < 900
    );
  }

  private readonly preventGesture = (event: Event): void => {
    event.preventDefault();
  };
}
