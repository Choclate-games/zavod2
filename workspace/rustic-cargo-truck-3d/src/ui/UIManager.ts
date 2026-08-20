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
  private readonly layer = document.createElement('div');
  private readonly hud = document.createElement('div');
  private readonly cargoFill = document.createElement('div');
  private readonly progressFill = document.createElement('div');
  private readonly speedNumber = document.createElement('div');
  private readonly cargoText = document.createElement('div');
  private readonly routeText = document.createElement('div');
  private readonly cargoTypeBadge = document.createElement('div');
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
  }

  showMenu(save: SaveData): void {
    this.currentSave = save;
    this.state = 'menu';
    this.input.setEnabled(false);
    this.input.touchLayer.classList.remove('visible');
    this.clearScreen();

    const screen = this.createScreen();
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="eyebrow">Лесной Рейс · Сезон 01</div>
      <h1>Лесной Рейс 3D</h1>
      <p class="subtitle">Доставляй брёвна, топливные бочки, стройматериалы и ценные спецгрузы сквозь топкую грязь, речные броды и перевалы. Прокачивай грузовики в Гараже!</p>
    `;

    const activeLevel = getLevelConfig(save.currentLevel || 1);
    const activeTruck = getTruckConfig(save.selectedTruck || 'zil');
    const activePkg = getCargoPackage(activeLevel.cargoPackage || 'logs');

    const start = this.button(`В рейс · Ур. ${activeLevel.id} (${activePkg.icon} ${activePkg.tag})`, true);
    start.addEventListener('click', () => this.events.emit('game:start', { level: activeLevel.id }));

    const garageBtn = this.button(`🏢 Гараж и Автопарк [${activeTruck.name}]`, false);
    garageBtn.style.marginTop = '10px';
    garageBtn.addEventListener('click', () => this.showGarage(save));

    const levelSelectBtn = this.button('🗺️ Выбор уровня (50 маршрутов)', false);
    levelSelectBtn.style.marginTop = '10px';
    levelSelectBtn.addEventListener('click', () => this.showLevelSelect(save));

    const currentUpgrades = save.truckUpgrades[save.selectedTruck] || save.truckUpgrades.zil;
    const meta = document.createElement('div');
    meta.className = 'menu-meta';
    meta.innerHTML = `
      <div><strong>🪙 ${save.coins}</strong>монет</div>
      <div><strong>${save.unlockedTrucks.length}/4</strong>грузовика</div>
      <div><strong>${save.unlockedLevels}/50</strong>трасс</div>
      <div><strong>⚙️${currentUpgrades.engine} 🛞${currentUpgrades.tires}</strong>тюнинг</div>
    `;

    panel.append(start, garageBtn, levelSelectBtn, meta);
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

    // Emit live preview update so 3D model in background updates immediately
    this.events.emit('game:garage-preview', { truckId: currentTruckId, color: truckUpgrades.color });

    const screen = this.createScreen();
    const panel = document.createElement('div');
    panel.className = 'panel garage-panel';

    // Header & Balance
    panel.innerHTML = `
      <div class="garage-header">
        <div>
          <div class="eyebrow">База техники & Мастерская</div>
          <h2>🏢 Автобаза и Гараж</h2>
        </div>
        <div class="garage-coins">🪙 <strong>${save.coins}</strong></div>
      </div>
    `;

    // Truck Carousel Selector Tabs
    const truckTabs = document.createElement('div');
    truckTabs.className = 'truck-tabs';
    const allTruckIds: TruckId[] = ['zil', 'gaz', 'kraz', 'ural'];

    for (const tid of allTruckIds) {
      const t = TRUCKS[tid];
      const owned = save.unlockedTrucks.includes(tid);
      const active = tid === currentTruckId;
      const tab = document.createElement('button');
      tab.className = `truck-tab ${active ? 'active' : ''} ${owned ? '' : 'locked'}`;
      tab.innerHTML = `
        <div class="truck-tab-name">${t.name}</div>
        <div class="truck-tab-tag">${owned ? (tid === save.selectedTruck ? '✓ В строю' : 'В гараже') : `🔒 ${t.price} 🪙`}</div>
      `;
      tab.addEventListener('click', () => {
        this.showGarage(save, tid);
      });
      truckTabs.append(tab);
    }
    panel.append(truckTabs);

    // Selected Truck Profile Card
    const profile = document.createElement('div');
    profile.className = 'truck-profile';
    profile.innerHTML = `
      <div class="profile-top">
        <div>
          <h3>${truckCfg.name}</h3>
          <p class="profile-subtitle">${truckCfg.subtitle}</p>
        </div>
        <div class="profile-badge ${isEquipped ? 'equipped' : isUnlocked ? 'unlocked' : 'locked'}">
          ${isEquipped ? '✓ АКТИВЕН' : isUnlocked ? 'В АВТОПАРКЕ' : `ЦЕНА: ${truckCfg.price} 🪙`}
        </div>
      </div>
      <p class="profile-desc">${truckCfg.description}</p>
    `;
    panel.append(profile);

    // Vehicle Stats Meters (Power, Speed, Offroad, Cargo Safety)
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
        <div class="stat-bar-header"><span>📦 Защита груза (борта)</span><strong>${safetyPct}%</strong></div>
        <div class="stat-track"><div class="stat-fill" style="width: ${safetyPct}%; background: #3d7ea6;"></div></div>
      </div>
    `;
    panel.append(statsWrap);

    // Color Swatch Paint Shop
    const colorSection = document.createElement('div');
    colorSection.className = 'color-section';
    colorSection.innerHTML = '<div class="section-title">🎨 Покраска кабины и кузова:</div>';

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
    panel.append(colorSection);

    // Upgrades Grid (Engine, Mud Tires, Suspension, Cargo Sides)
    const upgradesSection = document.createElement('div');
    upgradesSection.className = 'garage-upgrades-wrap';
    upgradesSection.innerHTML = '<div class="section-title">⚙️ Модернизация и тюнинг узлов:</div>';

    const upgradeGrid = document.createElement('div');
    upgradeGrid.className = 'garage-grid';

    // 1. Engine Upgrade (0..5)
    const engCost = 80 + truckUpgrades.engine * 50;
    const engCard = document.createElement('div');
    engCard.className = 'garage-card';
    engCard.innerHTML = `
      <h4>⚙️ Двигатель (ур. ${truckUpgrades.engine}/5)</h4>
      <p>+Крутящий момент и тяга на крутых подъёмах</p>
    `;
    if (truckUpgrades.engine < 5) {
      const btn = this.button(save.coins >= engCost ? `Прокачать · ${engCost} 🪙` : `${engCost} 🪙 (мало монет)`, false);
      btn.disabled = save.coins < engCost || !isUnlocked;
      btn.addEventListener('click', () => {
        if (save.coins < engCost || !isUnlocked) return;
        save.coins -= engCost;
        truckUpgrades.engine += 1;
        save.truckUpgrades[currentTruckId] = truckUpgrades;
        this.events.emit('game:save', undefined);
        this.toast('Двигатель модернизирован!', 'good');
        this.showGarage(save, currentTruckId);
      });
      engCard.append(btn);
    } else {
      engCard.innerHTML += '<div class="tag max-tag">МАКС. ТЮНИНГ</div>';
    }

    // 2. Mud Tires Upgrade (0..4)
    const tiresCost = 70 + truckUpgrades.tires * 55;
    const tiresCard = document.createElement('div');
    tiresCard.className = 'garage-card';
    tiresCard.innerHTML = `
      <h4>🛞 Грязевые шины (ур. ${truckUpgrades.tires}/4)</h4>
      <p>+Сцепление и грунтозацепы в болотах и на бродах</p>
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
      tiresCard.innerHTML += '<div class="tag max-tag">МАКС. ТЮНИНГ</div>';
    }

    // 3. Suspension Upgrade (0..3)
    const suspCost = 65 + truckUpgrades.suspension * 60;
    const suspCard = document.createElement('div');
    suspCard.className = 'garage-card';
    suspCard.innerHTML = `
      <h4>🔩 Подвеска & Лифт (ур. ${truckUpgrades.suspension}/3)</h4>
      <p>+Жесткость амортизаторов, гашение раскачки на кочках</p>
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
      suspCard.innerHTML += '<div class="tag max-tag">МАКС. ТЮНИНГ</div>';
    }

    // 4. Cargo Bed Sides Upgrade (0..3)
    const sidesCost = 75 + truckUpgrades.sides * 65;
    const sidesCard = document.createElement('div');
    sidesCard.className = 'garage-card';
    sidesCard.innerHTML = `
      <h4>📦 Высокие борта (ур. ${truckUpgrades.sides}/3)</h4>
      <p>+Наращивание стенок кузова от вылетания брёвен и ящиков</p>
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
      sidesCard.innerHTML += '<div class="tag max-tag">МАКС. ТЮНИНГ</div>';
    }

    upgradeGrid.append(engCard, tiresCard, suspCard, sidesCard);
    upgradesSection.append(upgradeGrid);
    panel.append(upgradesSection);

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
    panel.append(primaryBar);

    // Navigation Action Row
    const navRow = document.createElement('div');
    navRow.className = 'action-row';

    const backBtn = this.button('← В главное меню', false);
    backBtn.addEventListener('click', () => this.showMenu(save));

    const levelsBtn = this.button('🗺️ Выбор уровня', false);
    levelsBtn.addEventListener('click', () => this.showLevelSelect(save));

    navRow.append(backBtn, levelsBtn);
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
      <p class="subtitle" style="margin-bottom: 10px;">Каждый маршрут имеет свой груз: брёвна, топливные бочки, стройматериалы, сено или ценные контейнеры.</p>
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
        ? `<div class="fork-tag">🔀 ${fullLvl.forks[0].leftTag} / ${fullLvl.forks[0].rightTag}</div>`
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

  showHud(level: LevelConfig): void {
    this.state = 'running';
    this.clearScreen();
    this.hud.classList.remove('hidden');
    this.hud.innerHTML = '';

    const pkg = getCargoPackage(level.cargoPackage || 'logs');

    const top = document.createElement('div');
    top.className = 'hud-top';

    const cargoCard = document.createElement('div');
    cargoCard.className = 'hud-card cargo-wrap';
    this.cargoTypeBadge.className = 'hud-label';
    this.cargoTypeBadge.textContent = `${pkg.icon} ${pkg.tag}`;
    this.cargoText.className = 'hud-value';
    this.cargoText.textContent = `${pkg.slots.length} / ${pkg.slots.length}`;
    this.cargoFill.className = 'bar-fill';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.append(this.cargoFill);
    cargoCard.append(this.cargoTypeBadge, this.cargoText, bar);

    const distance = document.createElement('div');
    distance.className = 'hud-card';
    this.routeText.className = 'hud-value';
    this.routeText.textContent = `${level.title}`;
    distance.innerHTML = `<div class="hud-label">Уровень ${level.id} (${level.tag})</div>`;
    distance.append(this.routeText);

    this.mudBadge.className = 'hud-badge hidden';
    this.mudBadge.textContent = 'ВЯЗКАЯ ГРЯЗЬ';

    const pause = this.button('Ⅱ', false);
    pause.className = 'pause-btn';
    pause.addEventListener('click', () => this.events.emit('game:pause', { paused: true }));

    top.append(cargoCard, distance, this.mudBadge, pause);
    this.hud.append(top);

    const speed = document.createElement('div');
    speed.className = 'speedometer';
    this.speedNumber.className = 'speed-number';
    this.speedNumber.textContent = '0';
    speed.append(this.speedNumber);
    const unit = document.createElement('div');
    unit.className = 'speed-unit';
    unit.textContent = 'КМ/Ч';
    speed.append(unit);

    const track = document.createElement('div');
    track.className = 'progress-track';
    this.progressFill.className = 'progress-fill';
    track.append(this.progressFill);
    speed.append(track);
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
      panel.className = 'panel';
      panel.innerHTML = '<div class="eyebrow">Передышка на обочине</div><h1>Пауза</h1><p class="subtitle">Груз в кузове. Вернись на маршрут или загляни в Гараж для тюнинга.</p>';

      const resume = this.button('Продолжить', true);
      resume.addEventListener('click', () => this.events.emit('game:pause', { paused: false }));

      const garageBtn = this.button('🏢 Гараж и Автопарк', false);
      garageBtn.style.marginTop = '10px';
      garageBtn.addEventListener('click', () => {
        if (s) this.showGarage(s);
      });

      const invertBtn = this.button(
        `Инверсия руля: ${s?.settings.invertSteering ? 'ВКЛ' : 'ВЫКЛ'}`,
        false,
      );
      invertBtn.style.marginTop = '10px';
      invertBtn.addEventListener('click', () => {
        if (s) {
          s.settings.invertSteering = !s.settings.invertSteering;
          invertBtn.textContent = `Инверсия руля: ${s.settings.invertSteering ? 'ВКЛ' : 'ВЫКЛ'}`;
          this.events.emit('game:save', undefined);
        }
      });

      const levelSelectBtn = this.button('Выход в выбор уровней', false);
      levelSelectBtn.style.marginTop = '10px';
      levelSelectBtn.addEventListener('click', () => {
        if (s) this.showLevelSelect(s);
      });

      panel.append(resume, garageBtn, invertBtn, levelSelectBtn);
      screen.append(panel);
      this.layer.append(screen);
    } else {
      this.removeScreen();
    }
  }

  updateHud(state: HudState): void {
    this.speedNumber.textContent = Math.round(state.speed).toString();
    this.cargoText.textContent = `${state.cargo} / ${state.totalCargo}`;
    const ratio = state.cargo / Math.max(1, state.totalCargo);
    this.cargoFill.style.width = `${ratio * 100}%`;
    this.cargoFill.style.background = ratio > .6 ? '#76bd6b' : ratio > .3 ? '#e8ad61' : '#d8574b';
    this.progressFill.style.width = `${Math.min(100, state.progress * 100)}%`;

    if (state.forkPrompt) {
      this.mudBadge.classList.remove('hidden');
      this.mudBadge.textContent = `🔀 РАЗВИЛКА: ${state.forkPrompt}`;
    } else if (state.water !== undefined && state.water > 0.18) {
      this.mudBadge.classList.remove('hidden');
      this.mudBadge.textContent = state.water > 0.5 ? 'ГЛУБОКИЙ БРОД · ВОДНАЯ ПРЕГРАДА' : 'АКВАПЛАНИРОВАНИЕ';
    } else if (state.mud !== undefined && state.mud > 0.22) {
      this.mudBadge.classList.remove('hidden');
      this.mudBadge.textContent = state.mud > 0.6 ? 'ГЛУБОКАЯ ТОПЬ · ТЯГА ↓' : 'ВЯЗКАЯ ГРЯЗЬ';
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
    panel.className = 'panel';

    const starsStr = result.stars > 0 ? '⭐'.repeat(result.stars) : '☆☆☆';
    const isPerfect = result.delivered === result.total;

    panel.innerHTML = `
      <div class="eyebrow">Рейс завершён · Уровень ${result.levelId} · ${pkg.icon} ${pkg.title}</div>
      <div class="stars-wrap">${starsStr}</div>
      <h1>${isPerfect ? 'Идеальная доставка!' : result.delivered > 0 ? 'Груз доставлен!' : 'Груз потерян!'}</h1>
      <p class="subtitle">Лесопилка приняла твой груз. Модернизируй грузовик в Гараже или накопи на новый 6х6 тяжеловоз!</p>
    `;

    const stats = document.createElement('div');
    stats.className = 'result-stats';
    stats.innerHTML = `
      <div class="stat"><strong>${result.delivered}/${result.total}</strong><span>${pkg.tag}</span></div>
      <div class="stat"><strong>+${result.coins}</strong><span>монет</span></div>
      <div class="stat"><strong>${Math.round(result.duration)}с</strong><span>время</span></div>
    `;
    panel.append(stats);

    // Quick tuning banner / button
    const garageBanner = document.createElement('div');
    garageBanner.className = 'result-garage-banner';
    garageBanner.innerHTML = `
      <div><strong>🏢 Гараж: ${truckCfg.name}</strong></div>
      <div>Баланс: 🪙 ${save.coins} монет</div>
    `;
    const toGarageBtn = this.button('🏢 Открыть Гараж & Тюнинг', false);
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
    return navigator.maxTouchPoints > 0 || window.innerWidth < 900;
  }

  private readonly preventGesture = (event: Event): void => {
    event.preventDefault();
  };
}


