import { gameStore } from '../core/Store';
import { audioManager } from '../core/AudioManager';
import { bridgeService } from '../platform/BridgeService';
import { TouchControls } from './TouchControls';
import { GAME_VERSION, VEHICLES, GARAGE_UPGRADE_COSTS } from '../core/Constants';
import { UpgradeCard, GarageUpgrades } from '../types/game';
import { eventBus } from '../core/EventBus';

export class UIManager {
  private container: HTMLElement;
  private game: any;

  // DOM Elements
  private mainMenuEl!: HTMLElement;
  private garageEl!: HTMLElement;
  private hudEl!: HTMLElement;
  private levelUpEl!: HTMLElement;
  private pauseEl!: HTMLElement;
  private gameOverEl!: HTMLElement;
  private victoryEl!: HTMLElement;
  private touchControls!: TouchControls;

  // HUD Dynamic elements
  private healthFillEl!: HTMLElement;
  private nitroFillEl!: HTMLElement;
  private xpFillEl!: HTMLElement;
  private levelValEl!: HTMLElement;
  private waveValEl!: HTMLElement;
  private waveTimerEl!: HTMLElement;
  private killsValEl!: HTMLElement;
  private scrapValEl!: HTMLElement;
  private driftGaugeEl!: HTMLElement;
  private driftMultiplierEl!: HTMLElement;
  private bossBarContainerEl!: HTMLElement;
  private bossBarFillEl!: HTMLElement;
  private bossNameEl!: HTMLElement;

  constructor(container: HTMLElement, game: any) {
    this.container = container;
    this.game = game;
    this.createDomStructure();
    this.setupEventListeners();
  }

  private createDomStructure(): void {
    this.container.innerHTML = `
      <!-- MAIN MENU -->
      <div id="modal-main-menu" class="ui-modal interactive" style="display: flex;">
        <h1 style="font-size: 32px; font-weight: 900; color: #f77f00; text-shadow: 0 0 20px rgba(247,127,0,0.6); margin-bottom: 6px; text-transform: uppercase; text-align: center;">
          ЗОМБИ ДРИФТ
        </h1>
        <h2 style="font-size: 16px; font-weight: 800; color: #d62828; margin-bottom: 24px; letter-spacing: 3px; text-transform: uppercase;">
          ⚡ СТАЛЬНАЯ ЯРОСТЬ 3D ⚡
        </h2>
        
        <div style="display: flex; flex-direction: column; gap: 14px; width: 220px; margin-bottom: 24px;">
          <button id="btn-start-game" class="btn-primary">В БОЙ</button>
          <button id="btn-open-garage" class="btn-secondary">ГАРАЖ И ТЮНИНГ</button>
          <button id="btn-toggle-sound" class="btn-secondary">ЗВУК: ВКЛ</button>
        </div>

        <div style="font-size: 12px; color: #9e8e84; text-align: center; line-height: 1.5;">
          <b>ПК:</b> WASD / Стрелки — вождение | <b>SPACE</b> — нитро | <b>SHIFT</b> — дрифт<br/>
          <b>Телефон:</b> слева стик — руль и газ/назад, справа НИТРО и ДРИФТ<br/>
          Дрифт заряжает Нитро и умножает урон тарана до <b>4.5x</b>!
        </div>
        <div class="game-version">ВЕРСИЯ ${GAME_VERSION}</div>
      </div>

      <!-- GARAGE -->
      <div id="modal-garage" class="ui-modal interactive" style="display: none; width: 750px;">
        <h2 style="font-size: 24px; font-weight: 900; color: #f77f00; margin-bottom: 12px; text-transform: uppercase;">
          ГАРАЖ БОЕВЫХ МАШИН
        </h2>
        <div style="font-size: 16px; font-weight: 700; color: #ffd166; margin-bottom: 16px;">
          Шестеренки: <span id="garage-scrap-val">0</span> ⚙️
        </div>

        <!-- Vehicle Selection Carousel -->
        <div style="display: flex; gap: 14px; width: 100%; margin-bottom: 16px;" id="garage-vehicles-list"></div>

        <!-- Upgrades Grid -->
        <div class="garage-grid" id="garage-upgrades-list"></div>

        <button id="btn-close-garage" class="btn-primary" style="margin-top: 20px;">НАЗАД В МЕНЮ</button>
      </div>

      <!-- IN-GAME HUD -->
      <div id="hud-root" style="display: none; width: 100%; height: 100%; position: absolute; pointer-events: none;">
        <!-- Top Stats -->
        <div class="hud-top">
          <div class="hud-bars-container">
            <div class="hud-bar-wrapper">
              <div id="hud-health-fill" class="hud-bar-fill bar-health" style="width: 100%;"></div>
              <span class="bar-label">ПРОЧНОСТЬ</span>
            </div>
            <div class="hud-bar-wrapper">
              <div id="hud-nitro-fill" class="hud-bar-fill bar-nitro" style="width: 100%;"></div>
              <span class="bar-label">НИТРО-ФОРСАЖ</span>
            </div>
            <div class="hud-bar-wrapper">
              <div id="hud-xp-fill" class="hud-bar-fill bar-xp" style="width: 0%;"></div>
              <span class="bar-label">УРОВЕНЬ <span id="hud-level-val">1</span></span>
            </div>
          </div>

          <div class="hud-stat-group">
            <div class="hud-badge">
              <span class="icon">💀</span>
              <span id="hud-kills-val">0</span>
            </div>
            <div class="hud-badge">
              <span class="icon">⚙️</span>
              <span id="hud-scrap-val">0</span>
            </div>
            <div class="hud-badge">
              <span class="icon">⏱️</span>
              <span>ВОЛНА <span id="hud-wave-val">1</span> (<span id="hud-wave-timer">45</span>с)</span>
            </div>
            <button id="btn-pause-game" class="btn-secondary interactive" style="padding: 6px 12px; font-size: 13px;">⏸️</button>
          </div>
        </div>

        <!-- Drift Gauge -->
        <div id="hud-drift-gauge" class="drift-gauge-container">
          <div class="drift-title">⚡ ДРИФТ-ЯРОСТЬ ⚡</div>
          <div id="hud-drift-multiplier" class="drift-multiplier-text">x2.4</div>
        </div>

        <!-- Boss Bar -->
        <div id="hud-boss-bar-container" class="boss-bar-container">
          <div id="hud-boss-name" class="boss-name">ГОЛИАФ ПОЖИРАТЕЛЬ</div>
          <div style="width: 100%; background: #221e1a; border: 1px solid #ff0044; border-radius: 4px; padding: 2px;">
            <div id="hud-boss-bar-fill" class="boss-bar-fill"></div>
          </div>
        </div>
      </div>

      <!-- LEVEL UP MODAL -->
      <div id="modal-level-up" class="ui-modal interactive" style="display: none;">
        <h2 style="font-size: 26px; font-weight: 900; color: #ffd166; text-transform: uppercase;">
          НОВЫЙ МОДУЛЬ УЛУЧШЕНИЯ!
        </h2>
        <div style="color: #9e8e84; font-size: 14px; margin-top: 4px;">Выберите один из 3 боевых модулей:</div>
        <div id="level-up-cards" class="cards-container"></div>
      </div>

      <!-- PAUSE MODAL -->
      <div id="modal-pause" class="ui-modal interactive" style="display: none;">
        <h2 style="font-size: 24px; font-weight: 900; color: #fff; margin-bottom: 20px;">ПАУЗА</h2>
        <div style="display: flex; flex-direction: column; gap: 12px; width: 200px;">
          <button id="btn-resume-game" class="btn-primary">ПРОДОЛЖИТЬ</button>
          <button id="btn-restart-game" class="btn-secondary">ЗАНОВО</button>
          <button id="btn-pause-sound" class="btn-secondary">ЗВУК: ВКЛ</button>
          <button id="btn-quit-menu" class="btn-secondary">В МЕНЮ</button>
        </div>
      </div>

      <!-- GAME OVER MODAL -->
      <div id="modal-game-over" class="ui-modal interactive" style="display: none; width: 440px;">
        <h2 style="font-size: 28px; font-weight: 900; color: #d90429; margin-bottom: 12px; text-transform: uppercase;">
          МАШИНА УНИЧТОЖЕНА!
        </h2>
        <div style="width: 100%; background: rgba(0,0,0,0.4); padding: 14px; border-radius: 6px; margin-bottom: 18px; font-size: 14px; display: flex; flex-direction: column; gap: 6px;">
          <div style="display:flex; justify-content:space-between;"><span>Уничтожено зомби:</span><b id="go-kills">0</b></div>
          <div style="display:flex; justify-content:space-between;"><span>Боссов побеждено:</span><b id="go-bosses">0</b></div>
          <div style="display:flex; justify-content:space-between;"><span>Время в дрифте:</span><b id="go-drift">0с</b></div>
          <div style="display:flex; justify-content:space-between;"><span>Собрано шестеренок:</span><b id="go-scrap">0 ⚙️</b></div>
          <div style="display:flex; justify-content:space-between; color: #ffd166; font-size: 16px; margin-top: 6px;"><span>ИТОГОВЫЙ СЧЕТ:</span><b id="go-score">0</b></div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
          <button id="btn-revive-ad" class="btn-gold">🎬 ВОЗРОДИТЬСЯ С ПОЛНЫМ ХП</button>
          <button id="btn-retry-game" class="btn-primary">ИГРАТЬ СНОВА</button>
          <button id="btn-go-garage" class="btn-secondary">В ГАРАЖ</button>
        </div>
      </div>

      <!-- VICTORY MODAL -->
      <div id="modal-victory" class="ui-modal interactive" style="display: none; width: 440px;">
        <h2 style="font-size: 28px; font-weight: 900; color: #06d6a0; margin-bottom: 12px; text-transform: uppercase;">
          🏆 ПУСТОШЬ ЗАЧИЩЕНА! 🏆
        </h2>
        <div style="color: #ffd166; font-weight: 700; margin-bottom: 14px; text-align: center;">
          Вы сокрушили орды мутантов и главного Голиафа!
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
          <button id="btn-victory-double-ad" class="btn-gold">🎬 УДВОИТЬ ШЕСТЕРЕНКИ (+100%)</button>
          <button id="btn-victory-garage" class="btn-primary">ПЕРЕЙТИ В ГАРАЖ</button>
        </div>
      </div>

    `;

    // Cache elements
    this.mainMenuEl = document.getElementById('modal-main-menu')!;
    this.garageEl = document.getElementById('modal-garage')!;
    this.hudEl = document.getElementById('hud-root')!;
    this.levelUpEl = document.getElementById('modal-level-up')!;
    this.pauseEl = document.getElementById('modal-pause')!;
    this.gameOverEl = document.getElementById('modal-game-over')!;
    this.victoryEl = document.getElementById('modal-victory')!;

    this.healthFillEl = document.getElementById('hud-health-fill')!;
    this.nitroFillEl = document.getElementById('hud-nitro-fill')!;
    this.xpFillEl = document.getElementById('hud-xp-fill')!;
    this.levelValEl = document.getElementById('hud-level-val')!;
    this.waveValEl = document.getElementById('hud-wave-val')!;
    this.waveTimerEl = document.getElementById('hud-wave-timer')!;
    this.killsValEl = document.getElementById('hud-kills-val')!;
    this.scrapValEl = document.getElementById('hud-scrap-val')!;
    this.driftGaugeEl = document.getElementById('hud-drift-gauge')!;
    this.driftMultiplierEl = document.getElementById('hud-drift-multiplier')!;
    this.bossBarContainerEl = document.getElementById('hud-boss-bar-container')!;
    this.bossBarFillEl = document.getElementById('hud-boss-bar-fill')!;
    this.bossNameEl = document.getElementById('hud-boss-name')!;

    // Тач-управление живёт отдельным слоем и показывается только в заезде.
    this.touchControls = new TouchControls(this.container);
  }

  private setupEventListeners(): void {
    // Menu Buttons
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.game.startNewGame();
    });

    document.getElementById('btn-open-garage')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showGarage();
    });

    document.getElementById('btn-close-garage')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showMainMenu();
    });

    const soundBtn = document.getElementById('btn-toggle-sound');
    soundBtn?.addEventListener('click', () => {
      const isEnabled = !gameStore.save.soundEnabled;
      audioManager.setSoundEnabled(isEnabled);
      audioManager.setMusicEnabled(isEnabled);
      soundBtn.textContent = `ЗВУК: ${isEnabled ? 'ВКЛ' : 'ВЫКЛ'}`;
      audioManager.playButtonClick();
    });

    // Pause Buttons
    document.getElementById('btn-pause-game')?.addEventListener('click', () => {
      this.game.pauseGame();
    });

    document.getElementById('btn-resume-game')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.game.resumeGame();
    });

    document.getElementById('btn-restart-game')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.game.startNewGame();
    });

    document.getElementById('btn-quit-menu')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showMainMenu();
    });

    // Game Over Buttons
    document.getElementById('btn-retry-game')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      bridgeService.showInterstitial();
      this.game.startNewGame();
    });

    document.getElementById('btn-go-garage')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      bridgeService.showInterstitial();
      this.showGarage();
    });

    document.getElementById('btn-revive-ad')?.addEventListener('click', () => {
      bridgeService.showRewarded(() => {
        this.game.revivePlayer();
      });
    });

    // Victory Buttons
    document.getElementById('btn-victory-double-ad')?.addEventListener('click', () => {
      bridgeService.showRewarded(() => {
        gameStore.addScrap(gameStore.run.stats.scrapCollected);
        this.showGarage();
      });
    });

    document.getElementById('btn-victory-garage')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showGarage();
    });
  }

  public showMainMenu(): void {
    this.hideAllModals();
    this.mainMenuEl.style.display = 'flex';
    this.hudEl.style.display = 'none';
  }

  public showGarage(): void {
    this.hideAllModals();
    this.garageEl.style.display = 'flex';
    this.hudEl.style.display = 'none';
    this.renderGarageContent();
  }

  public showHud(): void {
    this.hideAllModals();
    this.hudEl.style.display = 'block';
    // Руль и педали нужны только в заезде — в меню они лишь мешают нажимать кнопки.
    this.touchControls.setVisible(true);
  }

  public showLevelUp(cards: UpgradeCard[], onSelect: (card: UpgradeCard) => void): void {
    this.levelUpEl.style.display = 'flex';
    this.touchControls.setVisible(false);
    const container = document.getElementById('level-up-cards')!;
    container.innerHTML = '';

    cards.forEach((c) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'upgrade-card';
      cardEl.innerHTML = `
        <div class="card-icon">${c.icon}</div>
        <div class="card-title">${c.nameRu}</div>
        <div class="card-desc">${c.descriptionRu}</div>
        <div class="card-rarity rarity-${c.rarity}">${c.rarity}</div>
      `;
      cardEl.addEventListener('click', () => {
        audioManager.playLevelUp();
        this.levelUpEl.style.display = 'none';
        this.touchControls.setVisible(true);
        onSelect(c);
      });
      container.appendChild(cardEl);
    });
  }

  public showPause(): void {
    this.pauseEl.style.display = 'flex';
    this.touchControls.setVisible(false);
  }

  public hidePause(): void {
    this.pauseEl.style.display = 'none';
    this.touchControls.setVisible(true);
  }

  public showGameOver(stats: any, score: number): void {
    this.hideAllModals();
    this.gameOverEl.style.display = 'flex';
    document.getElementById('go-kills')!.textContent = stats.zombiesKilled.toString();
    document.getElementById('go-bosses')!.textContent = stats.bossesDefeated.toString();
    document.getElementById('go-drift')!.textContent = `${Math.floor(stats.driftTimeSeconds)}с`;
    document.getElementById('go-scrap')!.textContent = stats.scrapCollected.toString();
    document.getElementById('go-score')!.textContent = score.toString();
  }

  public showVictory(): void {
    this.hideAllModals();
    this.victoryEl.style.display = 'flex';
  }

  private hideAllModals(): void {
    this.touchControls?.setVisible(false);
    this.mainMenuEl.style.display = 'none';
    this.garageEl.style.display = 'none';
    this.levelUpEl.style.display = 'none';
    this.pauseEl.style.display = 'none';
    this.gameOverEl.style.display = 'none';
    this.victoryEl.style.display = 'none';
  }

  public updateHud(): void {
    const run = gameStore.run;
    if (!run.active) return;

    // Health
    const hpPct = Math.max(0, Math.min(100, (run.health / run.maxHealth) * 100));
    this.healthFillEl.style.width = `${hpPct}%`;

    // Nitro
    const nitroPct = Math.max(0, Math.min(100, run.nitro * 100));
    this.nitroFillEl.style.width = `${nitroPct}%`;

    // XP
    const xpPct = Math.max(0, Math.min(100, (run.xp / run.xpToNextLevel) * 100));
    this.xpFillEl.style.width = `${xpPct}%`;
    this.levelValEl.textContent = run.level.toString();

    // Stats
    this.killsValEl.textContent = run.stats.zombiesKilled.toString();
    this.scrapValEl.textContent = (gameStore.save.scrap).toString();
    this.waveValEl.textContent = run.wave.toString();
    this.waveTimerEl.textContent = Math.max(0, Math.ceil(run.waveTimeRemaining)).toString();

    // Drift Gauge
    if (run.rageMultiplier > 1.25) {
      this.driftGaugeEl.classList.add('active');
      this.driftMultiplierEl.textContent = `x${run.rageMultiplier.toFixed(1)}`;
    } else {
      this.driftGaugeEl.classList.remove('active');
    }

    // Boss bar
    if (this.game.zombieManager?.boss && !this.game.zombieManager.boss.isDead) {
      this.bossBarContainerEl.style.display = 'flex';
      const b = this.game.zombieManager.boss;
      const bPct = Math.max(0, Math.min(100, (b.health / b.maxHealth) * 100));
      this.bossBarFillEl.style.width = `${bPct}%`;
      this.bossNameEl.textContent = b.config.nameRu;
    } else {
      this.bossBarContainerEl.style.display = 'none';
    }
  }

  private renderGarageContent(): void {
    document.getElementById('garage-scrap-val')!.textContent = gameStore.save.scrap.toString();

    // Render Vehicles List
    const vList = document.getElementById('garage-vehicles-list')!;
    vList.innerHTML = '';

    Object.values(VEHICLES).forEach((veh) => {
      const isUnlocked = gameStore.save.unlockedVehicles.includes(veh.id);
      const isSelected = gameStore.save.selectedVehicleId === veh.id;

      const card = document.createElement('div');
      card.style.flex = '1';
      card.style.background = isSelected ? 'rgba(247,127,0,0.15)' : 'rgba(30,24,21,0.8)';
      card.style.border = isSelected ? '2px solid #f77f00' : '1px solid #44372e';
      card.style.borderRadius = '6px';
      card.style.padding = '12px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.textAlign = 'center';

      card.innerHTML = `
        <div style="font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 4px;">${veh.nameRu}</div>
        <div style="font-size: 11px; color: #9e8e84; margin-bottom: 10px; min-height: 32px;">${veh.descriptionRu}</div>
        ${
          isSelected
            ? `<span style="color: #06d6a0; font-weight: 800; font-size: 13px;">✓ ВЫБРАНО</span>`
            : isUnlocked
            ? `<button class="btn-secondary" style="padding: 6px 14px; font-size: 12px;">ВЫБРАТЬ</button>`
            : `<button class="btn-gold" style="padding: 6px 14px; font-size: 12px;">КУПИТЬ (${veh.price} ⚙️)</button>`
        }
      `;

      const btn = card.querySelector('button');
      btn?.addEventListener('click', () => {
        if (isUnlocked) {
          gameStore.selectVehicle(veh.id);
          this.game.playerCar.rebuildVehicle(veh.id);
        } else {
          if (gameStore.unlockVehicle(veh.id)) {
            this.game.playerCar.rebuildVehicle(veh.id);
          }
        }
        audioManager.playButtonClick();
        this.renderGarageContent();
      });

      vList.appendChild(card);
    });

    // Render Upgrades List
    const uList = document.getElementById('garage-upgrades-list')!;
    uList.innerHTML = '';

    const upgradeEntries: { key: keyof GarageUpgrades; nameRu: string; icon: string }[] = [
      { key: 'hullLevel', nameRu: 'Броня Кузова', icon: '🛡️' },
      { key: 'engineLevel', nameRu: 'Мощность Двигателя', icon: '⚡' },
      { key: 'driftLevel', nameRu: 'Контроль Заноса', icon: '🏎️' },
      { key: 'ramLevel', nameRu: 'Урон Тарана', icon: '💥' },
      { key: 'nitroLevel', nameRu: 'Емкость Нитро', icon: '💨' },
      { key: 'magnetLevel', nameRu: 'Магнит Шестеренок', icon: '🧲' },
    ];

    upgradeEntries.forEach(({ key, nameRu, icon }) => {
      const currentLvl = gameStore.save.garageUpgrades[key];
      const maxLvl = GARAGE_UPGRADE_COSTS[key].length;
      const isMax = currentLvl >= maxLvl;
      const cost = isMax ? 0 : GARAGE_UPGRADE_COSTS[key][currentLvl];
      const canAfford = gameStore.save.scrap >= cost;

      const item = document.createElement('div');
      item.className = 'garage-upgrade-item';
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight: 800; font-size: 14px;">${icon} ${nameRu}</span>
          <span style="font-size: 12px; color: #ffd166;">Ур. ${currentLvl}/${maxLvl}</span>
        </div>
        ${
          isMax
            ? `<div style="color: #06d6a0; font-weight: 800; font-size: 13px; text-align:center;">МАКСИМУМ</div>`
            : `<button class="${canAfford ? 'btn-gold' : 'btn-secondary'}" style="padding: 6px 12px; font-size: 12px; width: 100%;">
                УЛУЧШИТЬ (${cost} ⚙️)
              </button>`
        }
      `;

      const btn = item.querySelector('button');
      btn?.addEventListener('click', () => {
        if (gameStore.buyGarageUpgrade(key)) {
          audioManager.playLevelUp();
          this.renderGarageContent();
        }
      });

      uList.appendChild(item);
    });
  }
}
