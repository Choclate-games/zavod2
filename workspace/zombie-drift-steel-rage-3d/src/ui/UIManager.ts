import { gameStore } from '../core/Store';
import { audioManager } from '../core/AudioManager';
import { bridgeService } from '../platform/BridgeService';
import { TouchControls } from './TouchControls';
import { GAME_VERSION, VEHICLES, GARAGE_UPGRADE_COSTS, CAMPAIGN_LEVELS, CHAPTERS, getChapterInfo, getChapterLevels } from '../core/Constants';
import { UpgradeCard, GarageUpgrades, LevelConfig } from '../types/game';
import { eventBus } from '../core/EventBus';

export class UIManager {
  private container: HTMLElement;
  private game: any;
  private selectedChapter = 1;

  // DOM Panels
  private mainMenuEl!: HTMLElement;
  private levelSelectEl!: HTMLElement;
  private garageEl!: HTMLElement;
  private hudEl!: HTMLElement;
  private levelUpEl!: HTMLElement;
  private pauseEl!: HTMLElement;
  private gameOverEl!: HTMLElement;
  private levelVictoryEl!: HTMLElement;
  public touchControls!: TouchControls;

  // HUD Dynamic elements
  private healthFillEl!: HTMLElement;
  private healthTextEl!: HTMLElement;
  private nitroFillEl!: HTMLElement;
  private xpFillEl!: HTMLElement;
  private levelValEl!: HTMLElement;
  private modeBadgeEl!: HTMLElement;
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
        <div class="menu-header">
          <h1 class="game-title">ЗОМБИ ДРИФТ</h1>
          <h2 class="game-subtitle">⚡ СТАЛЬНАЯ ЯРОСТЬ 3D ⚡</h2>
        </div>
        
        <div class="menu-btn-group">
          <button id="btn-mode-campaign" class="btn-primary btn-large">
            🏆 КАМПАНИЯ (100 УРОВНЕЙ)
          </button>
          <button id="btn-mode-survival" class="btn-gold btn-large">
            ☠️ РЕЖИМ ВЫЖИВАНИЯ
          </button>
          <button id="btn-open-garage" class="btn-secondary">
            🏎️ ГАРАЖ И ПРОКАЧКА
          </button>
          <button id="btn-toggle-sound" class="btn-secondary">
            🔊 ЗВУК: ВКЛ
          </button>
        </div>

        <div class="controls-hint">
          <div class="hint-row"><b>ПК:</b> WASD / Стрелки — движение | <b>SPACE</b> — Нитро | <b>SHIFT</b> — Дрифт</div>
          <div class="hint-row"><b>Телефон:</b> тяни стик в сторону движения, справа НИТРО и ДРИФТ</div>
          <div class="hint-row">Дрифт заряжает нитро и умножает урон тарана до <b>2.5x</b>!</div>
        </div>
        <div class="game-version">ВЕРСИЯ ${GAME_VERSION}</div>
      </div>

      <!-- LEVEL SELECT MODAL -->
      <div id="modal-level-select" class="ui-modal interactive level-select-modal-layout" style="display: none;">
        <div class="panel-header">
          <h2>ВЫБОР УРОВНЯ (100 МИССИЙ)</h2>
          <div class="lvl-select-top-stats">
            <div class="stars-counter-badge">
              <span>⭐</span>
              <span id="lvl-select-stars-val">0/300</span>
            </div>
            <div class="scrap-counter-badge">
              <span class="gear-icon">⚙️</span>
              <span id="lvl-select-scrap-val">0</span>
            </div>
          </div>
        </div>

        <!-- Chapter Navigation Bar -->
        <div class="chapter-nav-bar">
          <button id="btn-chapter-prev" class="chapter-nav-btn" title="Предыдущая глава">◀</button>
          <div id="chapter-tabs-list" class="chapter-tabs-row"></div>
          <button id="btn-chapter-next" class="chapter-nav-btn" title="Следующая глава">▶</button>
        </div>

        <!-- Chapter Banner -->
        <div id="chapter-banner" class="chapter-banner-box"></div>

        <!-- Level Cards Grid -->
        <div id="level-cards-list" class="levels-grid"></div>

        <div class="modal-footer-btns">
          <button id="btn-close-level-select" class="btn-secondary">НАЗАД В МЕНЮ</button>
        </div>
      </div>

      <!-- GARAGE MODAL -->
      <div id="modal-garage" class="ui-modal interactive garage-modal-layout" style="display: none;">
        <div class="garage-header">
          <div class="garage-header-left">
            <h2>ГАРАЖ БОЕВЫХ МАШИН</h2>
            <div class="garage-header-subtitle">ТЮНИНГ И ВЫБОР ТЕХНИКИ</div>
          </div>
          <div class="scrap-counter-badge">
            <span class="gear-icon">⚙️</span>
            <span id="garage-scrap-val">0</span>
          </div>
        </div>

        <div class="garage-content-columns">
          <!-- Left Column: Vehicle Selector & Specs -->
          <div class="garage-col-vehicle">
            <div class="garage-panel-heading">БОЕВОЙ БРОНЕВИК</div>
            <div class="vehicle-selector-header">
              <button id="btn-veh-prev" class="veh-nav-btn">◀</button>
              <div id="garage-veh-name" class="veh-title-display">Железный Клык</div>
              <button id="btn-veh-next" class="veh-nav-btn">▶</button>
            </div>
            <div id="garage-veh-desc" class="veh-desc-display">Сбалансированный броневик.</div>

            <!-- Vehicle Action (Selected / Select / Buy) -->
            <div id="garage-veh-action" style="width: 100%; margin: 6px 0 10px 0;"></div>

            <!-- Vehicle Specs Bars -->
            <div class="veh-specs-container">
              <div class="spec-row">
                <span class="spec-label">🏎️ СКОРОСТЬ</span>
                <div class="spec-bar-bg"><div id="spec-speed-fill" class="spec-bar-fill fill-speed"></div></div>
              </div>
              <div class="spec-row">
                <span class="spec-label">🛡️ ПРОЧНОСТЬ</span>
                <div class="spec-bar-bg"><div id="spec-armor-fill" class="spec-bar-fill fill-armor"></div></div>
              </div>
              <div class="spec-row">
                <span class="spec-label">⚡ РАЗГОН</span>
                <div class="spec-bar-bg"><div id="spec-accel-fill" class="spec-bar-fill fill-accel"></div></div>
              </div>
              <div class="spec-row">
                <span class="spec-label">🎯 ДРИФТ</span>
                <div class="spec-bar-bg"><div id="spec-drift-fill" class="spec-bar-fill fill-drift"></div></div>
              </div>
              <div class="spec-row">
                <span class="spec-label">💥 ТАРАН</span>
                <div class="spec-bar-bg"><div id="spec-ram-fill" class="spec-bar-fill fill-ram"></div></div>
              </div>
            </div>

            <div class="garage-panel-bottom-action">
              <button id="btn-close-garage" class="btn-secondary garage-back-btn">В МЕНЮ</button>
            </div>
          </div>

          <!-- Right Column: Upgrades List -->
          <div class="garage-col-upgrades">
            <div class="garage-panel-heading">МОДУЛИ И ТЮНИНГ</div>
            <div class="garage-grid" id="garage-upgrades-list"></div>
            <div class="garage-panel-bottom-action">
              <button id="btn-garage-play" class="btn-primary btn-large garage-play-btn">В БОЙ 🏆</button>
            </div>
          </div>
        </div>
      </div>

      <!-- IN-GAME HUD -->
      <div id="hud-root" style="display: none; width: 100%; height: 100%; position: absolute; pointer-events: none;">
        <!-- Top Stats Bar -->
        <div class="hud-top">
          <div class="hud-bars-container">
            <div class="hud-bar-wrapper">
              <div id="hud-health-fill" class="hud-bar-fill bar-health" style="width: 100%;"></div>
              <span class="bar-label">ПРОЧНОСТЬ <span id="hud-health-text">60/60</span></span>
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
            <div class="hud-badge mode-badge" id="hud-mode-badge">
              КАМПАНИЯ
            </div>
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
              <span>ВОЛНА <span id="hud-wave-val">1</span> (<span id="hud-wave-timer">30</span>с)</span>
            </div>
            <button id="btn-pause-game" class="btn-secondary interactive hud-pause-btn" style="padding: 6px 12px; font-size: 14px;">⏸️</button>
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
        <h2 style="font-size: 24px; font-weight: 900; color: #ffd166; text-transform: uppercase;">
          НОВЫЙ МОДУЛЬ УЛУЧШЕНИЯ!
        </h2>
        <div style="color: #9e8e84; font-size: 14px; margin-top: 4px;">Выберите один из 3 боевых модулей:</div>
        <div id="level-up-cards" class="cards-container"></div>
      </div>

      <!-- PAUSE MODAL -->
      <div id="modal-pause" class="ui-modal interactive" style="display: none;">
        <h2 style="font-size: 24px; font-weight: 900; color: #fff; margin-bottom: 20px;">ПАУЗА</h2>
        <div style="display: flex; flex-direction: column; gap: 12px; width: 220px;">
          <button id="btn-resume-game" class="btn-primary">ПРОДОЛЖИТЬ</button>
          <button id="btn-restart-game" class="btn-secondary">ЗАНОВО</button>
          <button id="btn-pause-sound" class="btn-secondary">ЗВУК: ВКЛ</button>
          <button id="btn-pause-garage" class="btn-secondary">В ГАРАЖ</button>
          <button id="btn-quit-menu" class="btn-secondary">В МЕНЮ</button>
        </div>
      </div>

      <!-- GAME OVER MODAL -->
      <div id="modal-game-over" class="ui-modal interactive" style="display: none; width: min(460px, 94vw);">
        <h2 style="font-size: 26px; font-weight: 900; color: #d90429; margin-bottom: 12px; text-transform: uppercase;">
          МАШИНА УНИЧТОЖЕНА!
        </h2>
        <div id="go-mode-label" style="font-size: 14px; font-weight: 800; color: #ffd166; margin-bottom: 10px;"></div>
        <div class="stats-summary-box">
          <div class="stat-summary-row"><span>Уничтожено зомби:</span><b id="go-kills">0</b></div>
          <div class="stat-summary-row"><span>Боссов побеждено:</span><b id="go-bosses">0</b></div>
          <div class="stat-summary-row"><span>Время в дрифте:</span><b id="go-drift">0с</b></div>
          <div class="stat-summary-row"><span>Собрано шестеренок:</span><b id="go-scrap">0 ⚙️</b></div>
          <div class="stat-summary-row score-highlight"><span>ИТОГОВЫЙ СЧЕТ:</span><b id="go-score">0</b></div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
          <button id="btn-revive-ad" class="btn-gold">🎬 ВОЗРОДИТЬСЯ С ПОЛНЫМ ХП</button>
          <button id="btn-retry-game" class="btn-primary">ИГРАТЬ СНОВА</button>
          <button id="btn-go-garage" class="btn-secondary">В ГАРАЖ</button>
          <button id="btn-go-menu" class="btn-secondary">В ГЛАВНОЕ МЕНЮ</button>
        </div>
      </div>

      <!-- LEVEL VICTORY MODAL -->
      <div id="modal-level-victory" class="ui-modal interactive" style="display: none; width: min(480px, 94vw);">
        <h2 style="font-size: 26px; font-weight: 900; color: #06d6a0; margin-bottom: 6px; text-transform: uppercase;">
          🏆 УРОВЕНЬ ЗАЧИЩЕН! 🏆
        </h2>
        <div id="victory-level-title" style="color: #ffd166; font-weight: 800; font-size: 16px; margin-bottom: 8px;"></div>
        
        <div id="victory-stars" class="victory-stars-display">
          ⭐ ⭐ ⭐
        </div>

        <div class="stats-summary-box">
          <div class="stat-summary-row"><span>Награда за уровень:</span><b id="vic-reward" style="color:#ffd166;">+150 ⚙️</b></div>
          <div class="stat-summary-row"><span>Уничтожено зомби:</span><b id="vic-kills">0</b></div>
          <div class="stat-summary-row"><span>Время выживания:</span><b id="vic-time">0с</b></div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
          <button id="btn-victory-double-ad" class="btn-gold">🎬 УДВОИТЬ НАГРАДУ (+100%)</button>
          <button id="btn-victory-next-level" class="btn-primary">СЛЕДУЮЩИЙ УРОВЕНЬ</button>
          <button id="btn-victory-levels" class="btn-secondary">ВЫБОР УРОВНЕЙ</button>
          <button id="btn-victory-garage" class="btn-secondary">В ГАРАЖ</button>
        </div>
      </div>
    `;

    // Cache elements
    this.mainMenuEl = document.getElementById('modal-main-menu')!;
    this.levelSelectEl = document.getElementById('modal-level-select')!;
    this.garageEl = document.getElementById('modal-garage')!;
    this.hudEl = document.getElementById('hud-root')!;
    this.levelUpEl = document.getElementById('modal-level-up')!;
    this.pauseEl = document.getElementById('modal-pause')!;
    this.gameOverEl = document.getElementById('modal-game-over')!;
    this.levelVictoryEl = document.getElementById('modal-level-victory')!;

    this.healthFillEl = document.getElementById('hud-health-fill')!;
    this.healthTextEl = document.getElementById('hud-health-text')!;
    this.nitroFillEl = document.getElementById('hud-nitro-fill')!;
    this.xpFillEl = document.getElementById('hud-xp-fill')!;
    this.levelValEl = document.getElementById('hud-level-val')!;
    this.modeBadgeEl = document.getElementById('hud-mode-badge')!;
    this.waveValEl = document.getElementById('hud-wave-val')!;
    this.waveTimerEl = document.getElementById('hud-wave-timer')!;
    this.killsValEl = document.getElementById('hud-kills-val')!;
    this.scrapValEl = document.getElementById('hud-scrap-val')!;
    this.driftGaugeEl = document.getElementById('hud-drift-gauge')!;
    this.driftMultiplierEl = document.getElementById('hud-drift-multiplier')!;
    this.bossBarContainerEl = document.getElementById('hud-boss-bar-container')!;
    this.bossBarFillEl = document.getElementById('hud-boss-bar-fill')!;
    this.bossNameEl = document.getElementById('hud-boss-name')!;

    // Touch controls layer
    this.touchControls = new TouchControls(this.container);
  }

  private setupEventListeners(): void {
    // Menu Buttons
    document.getElementById('btn-mode-campaign')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showLevelSelect();
    });

    document.getElementById('btn-mode-survival')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.game.startSurvivalGame();
    });

    document.getElementById('btn-open-garage')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showGarage();
    });

    const soundBtn = document.getElementById('btn-toggle-sound');
    soundBtn?.addEventListener('click', () => {
      const isEnabled = !gameStore.save.soundEnabled;
      audioManager.setSoundEnabled(isEnabled);
      audioManager.setMusicEnabled(isEnabled);
      soundBtn.textContent = `🔊 ЗВУК: ${isEnabled ? 'ВКЛ' : 'ВЫКЛ'}`;
      audioManager.playButtonClick();
    });

    // Level Select Buttons
    document.getElementById('btn-close-level-select')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showMainMenu();
    });

    document.getElementById('btn-chapter-prev')?.addEventListener('click', () => {
      if (this.selectedChapter > 1) {
        audioManager.playButtonClick();
        this.selectedChapter -= 1;
        this.renderLevelSelectModal();
      }
    });

    document.getElementById('btn-chapter-next')?.addEventListener('click', () => {
      if (this.selectedChapter < CHAPTERS.length) {
        audioManager.playButtonClick();
        this.selectedChapter += 1;
        this.renderLevelSelectModal();
      }
    });

    // Garage Navigation Buttons
    const vehicleKeys = Object.keys(VEHICLES);
    document.getElementById('btn-veh-prev')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      const curIdx = vehicleKeys.indexOf(gameStore.save.selectedVehicleId);
      const nextIdx = (curIdx - 1 + vehicleKeys.length) % vehicleKeys.length;
      this.selectVehicleInGarage(vehicleKeys[nextIdx]);
    });

    document.getElementById('btn-veh-next')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      const curIdx = vehicleKeys.indexOf(gameStore.save.selectedVehicleId);
      const nextIdx = (curIdx + 1) % vehicleKeys.length;
      this.selectVehicleInGarage(vehicleKeys[nextIdx]);
    });

    document.getElementById('btn-garage-play')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showLevelSelect();
    });

    document.getElementById('btn-close-garage')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showMainMenu();
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
      this.game.restartCurrentGame();
    });

    const pauseSoundBtn = document.getElementById('btn-pause-sound');
    pauseSoundBtn?.addEventListener('click', () => {
      const isEnabled = !gameStore.save.soundEnabled;
      audioManager.setSoundEnabled(isEnabled);
      audioManager.setMusicEnabled(isEnabled);
      pauseSoundBtn.textContent = `ЗВУК: ${isEnabled ? 'ВКЛ' : 'ВЫКЛ'}`;
      audioManager.playButtonClick();
    });

    document.getElementById('btn-pause-garage')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showGarage();
    });

    document.getElementById('btn-quit-menu')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showMainMenu();
    });

    // Game Over Buttons
    document.getElementById('btn-retry-game')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      bridgeService.showInterstitial();
      this.game.restartCurrentGame();
    });

    document.getElementById('btn-go-garage')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      bridgeService.showInterstitial();
      this.showGarage();
    });

    document.getElementById('btn-go-menu')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showMainMenu();
    });

    document.getElementById('btn-revive-ad')?.addEventListener('click', () => {
      bridgeService.showRewarded(() => {
        this.game.revivePlayer();
      });
    });

    // Level Victory Buttons
    document.getElementById('btn-victory-double-ad')?.addEventListener('click', () => {
      bridgeService.showRewarded(() => {
        const levelCfg = gameStore.getCampaignLevelConfig(gameStore.run.levelId);
        gameStore.addScrap(levelCfg.rewardScrap);
        this.showGarage();
      });
    });

    document.getElementById('btn-victory-next-level')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      const nextLvl = gameStore.run.levelId + 1;
      if (nextLvl <= CAMPAIGN_LEVELS.length) {
        this.game.startCampaignLevel(nextLvl);
      } else {
        this.showLevelSelect();
      }
    });

    document.getElementById('btn-victory-levels')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showLevelSelect();
    });

    document.getElementById('btn-victory-garage')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showGarage();
    });
  }

  public showMainMenu(): void {
    this.hideAllModals();
    this.game.state = 'MENU';
    this.game.renderer.cameraController.setGarageMode(false);
    this.mainMenuEl.style.display = 'flex';
    this.hudEl.style.display = 'none';
  }

  public showLevelSelect(): void {
    this.hideAllModals();
    this.game.state = 'LEVEL_SELECT';
    this.game.renderer.cameraController.setGarageMode(false);
    this.levelSelectEl.style.display = 'flex';
    this.hudEl.style.display = 'none';
    const activeChapter = Math.min(CHAPTERS.length, Math.max(1, Math.floor((gameStore.save.unlockedLevel - 1) / 10) + 1));
    this.selectedChapter = activeChapter;
    this.renderLevelSelectModal();
  }

  public showGarage(): void {
    this.hideAllModals();
    this.game.state = 'GARAGE';
    this.game.renderer.cameraController.setGarageMode(true);
    this.garageEl.style.display = 'flex';
    this.hudEl.style.display = 'none';
    this.renderGarageContent();
  }

  public showHud(): void {
    this.hideAllModals();
    this.game.renderer.cameraController.setGarageMode(false);
    this.hudEl.style.display = 'block';
    this.touchControls.setVisible(true);

    if (gameStore.run.mode === 'CAMPAIGN') {
      this.modeBadgeEl.textContent = `УРОВЕНЬ ${gameStore.run.levelId}`;
    } else {
      this.modeBadgeEl.textContent = `ВЫЖИВАНИЕ`;
    }
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
    const modeLabel = document.getElementById('go-mode-label')!;
    if (gameStore.run.mode === 'CAMPAIGN') {
      modeLabel.textContent = `Кампания · Уровень ${gameStore.run.levelId} · Волна ${gameStore.run.wave}`;
    } else {
      modeLabel.textContent = `Режим Выживания · Достигнута Волна ${gameStore.run.wave} (Рекорд: ${gameStore.save.survivalMaxWave})`;
    }

    document.getElementById('go-kills')!.textContent = stats.zombiesKilled.toString();
    document.getElementById('go-bosses')!.textContent = stats.bossesDefeated.toString();
    document.getElementById('go-drift')!.textContent = `${Math.floor(stats.driftTimeSeconds)}с`;
    document.getElementById('go-scrap')!.textContent = stats.scrapCollected.toString();
    document.getElementById('go-score')!.textContent = score.toString();
  }

  public showLevelVictory(stars: number, rewardScrap: number): void {
    this.hideAllModals();
    this.levelVictoryEl.style.display = 'flex';

    const currentLvlId = gameStore.run.levelId;
    const levelCfg = gameStore.getCampaignLevelConfig(currentLvlId);
    document.getElementById('victory-level-title')!.textContent = `Уровень ${currentLvlId}: ${levelCfg.nameRu} (${levelCfg.subtitleRu})`;
    document.getElementById('vic-reward')!.textContent = `+${rewardScrap} ⚙️`;
    document.getElementById('vic-kills')!.textContent = gameStore.run.stats.zombiesKilled.toString();
    document.getElementById('vic-time')!.textContent = `${Math.floor(gameStore.run.stats.survivedTimeSeconds)}с`;

    const starsEl = document.getElementById('victory-stars')!;
    let starsStr = '';
    for (let i = 1; i <= 3; i++) {
      starsStr += i <= stars ? '⭐ ' : '☆ ';
    }
    starsEl.textContent = starsStr.trim();

    const nextLvlBtn = document.getElementById('btn-victory-next-level');
    if (nextLvlBtn) {
      if (currentLvlId >= CAMPAIGN_LEVELS.length) {
        nextLvlBtn.textContent = '🎉 ВСЯ КАМПАНИЯ ПРОЙДЕНА!';
      } else {
        nextLvlBtn.textContent = `СЛЕДУЮЩИЙ УРОВЕНЬ (${currentLvlId + 1})`;
      }
    }
  }

  private hideAllModals(): void {
    this.touchControls?.setVisible(false);
    this.mainMenuEl.style.display = 'none';
    this.levelSelectEl.style.display = 'none';
    this.garageEl.style.display = 'none';
    this.levelUpEl.style.display = 'none';
    this.pauseEl.style.display = 'none';
    this.gameOverEl.style.display = 'none';
    this.levelVictoryEl.style.display = 'none';
  }

  public updateHud(): void {
    const run = gameStore.run;
    if (!run.active) return;

    // Health
    const hpPct = Math.max(0, Math.min(100, (run.health / run.maxHealth) * 100));
    this.healthFillEl.style.width = `${hpPct}%`;
    this.healthTextEl.textContent = `${Math.ceil(run.health)}/${run.maxHealth}`;

    // Nitro
    const nitroPct = Math.max(0, Math.min(100, run.nitro * 100));
    this.nitroFillEl.style.width = `${nitroPct}%`;

    // XP
    const xpPct = Math.max(0, Math.min(100, (run.xp / run.xpToNextLevel) * 100));
    this.xpFillEl.style.width = `${xpPct}%`;
    this.levelValEl.textContent = run.level.toString();

    // Stats
    this.killsValEl.textContent = run.stats.zombiesKilled.toString();
    this.scrapValEl.textContent = gameStore.save.scrap.toString();
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

  private selectVehicleInGarage(vehicleId: string): void {
    const isUnlocked = gameStore.save.unlockedVehicles.includes(vehicleId);
    if (isUnlocked) {
      gameStore.selectVehicle(vehicleId);
    } else {
      gameStore.save.selectedVehicleId = vehicleId;
    }
    this.game.playerCar.rebuildVehicle(vehicleId);
    this.renderGarageContent();
  }

  private renderLevelSelectModal(): void {
    document.getElementById('lvl-select-scrap-val')!.textContent = gameStore.save.scrap.toString();
    document.getElementById('lvl-select-stars-val')!.textContent = `${gameStore.getTotalStars()}/300`;

    // 1. Render Chapter Tabs
    const tabsContainer = document.getElementById('chapter-tabs-list')!;
    tabsContainer.innerHTML = '';

    CHAPTERS.forEach((ch) => {
      const isChapterUnlocked = ch.startLevel <= gameStore.save.unlockedLevel || gameStore.save.completedLevels.some((id) => id >= ch.startLevel);
      const isSelected = ch.chapter === this.selectedChapter;
      const chapterStars = gameStore.getChapterStars(ch.chapter);

      const tabBtn = document.createElement('button');
      tabBtn.className = `chapter-tab-btn ${isSelected ? 'active' : ''} ${isChapterUnlocked ? 'unlocked' : 'locked'}`;
      tabBtn.innerHTML = `
        <span class="ch-tab-icon">${ch.icon}</span>
        <span class="ch-tab-title">Гл. ${ch.chapter}</span>
        <span class="ch-tab-stars">${isChapterUnlocked ? `⭐${chapterStars}/30` : '🔒'}</span>
      `;

      tabBtn.addEventListener('click', () => {
        audioManager.playButtonClick();
        this.selectedChapter = ch.chapter;
        this.renderLevelSelectModal();
      });

      tabsContainer.appendChild(tabBtn);
    });

    // 2. Render Chapter Banner
    const bannerContainer = document.getElementById('chapter-banner')!;
    const curChapter = getChapterInfo(this.selectedChapter);
    const chStars = gameStore.getChapterStars(curChapter.chapter);
    bannerContainer.innerHTML = `
      <div class="ch-banner-left">
        <div class="ch-banner-icon">${curChapter.icon}</div>
        <div class="ch-banner-text">
          <div class="ch-banner-title">ГЛАВА ${curChapter.chapter}: ${curChapter.nameRu.toUpperCase()}</div>
          <div class="ch-banner-subtitle">${curChapter.subtitleRu} · Уровни ${curChapter.startLevel}–${curChapter.endLevel}</div>
          <div class="ch-banner-desc">${curChapter.descriptionRu}</div>
        </div>
      </div>
      <div class="ch-banner-stars-box">
        <div class="ch-stars-label">ЗВЕЗДЫ ГЛАВЫ</div>
        <div class="ch-stars-value">⭐ ${chStars} / 30</div>
      </div>
    `;

    // 3. Render Level Cards Grid for Selected Chapter
    const cardsList = document.getElementById('level-cards-list')!;
    cardsList.innerHTML = '';

    const chapterLevels = getChapterLevels(this.selectedChapter);
    chapterLevels.forEach((lvl) => {
      const isUnlocked = lvl.id <= gameStore.save.unlockedLevel;
      const isCompleted = gameStore.save.completedLevels.includes(lvl.id);
      const stars = gameStore.save.levelStars[lvl.id] || 0;
      const isBoss = !!lvl.bossWave;

      let starsStr = '';
      for (let s = 1; s <= 3; s++) {
        starsStr += s <= stars ? '⭐' : '☆';
      }

      const card = document.createElement('div');
      card.className = `level-card ${isUnlocked ? 'unlocked' : 'locked'} ${isCompleted ? 'completed' : ''} ${isBoss ? 'boss-level-card' : ''}`;
      card.innerHTML = `
        <div class="lvl-card-top">
          <div class="lvl-number">УРОВЕНЬ ${lvl.id}</div>
          ${isBoss ? `<div class="lvl-boss-badge">💀 БОСС: ${lvl.bossName || 'ГОЛИАФ'}</div>` : ''}
          <div class="lvl-stars">${isUnlocked ? starsStr : '🔒'}</div>
        </div>
        <div class="lvl-name">${lvl.nameRu}</div>
        <div class="lvl-subtitle">${lvl.subtitleRu}</div>
        <div class="lvl-desc">${lvl.descriptionRu}</div>
        <div class="lvl-info-row">
          <span>Волн: <b>${lvl.totalWaves}</b></span>
          <span>Цель: <b>${lvl.targetKills} 💀</b></span>
          <span class="lvl-reward">+${lvl.rewardScrap} ⚙️</span>
        </div>
        ${
          isUnlocked
            ? `<button class="btn-primary lvl-play-btn">${isCompleted ? 'ПОВТОРИТЬ' : 'В БОЙ'}</button>`
            : `<div class="lvl-locked-text">Пройдите Уровень ${lvl.id - 1}</div>`
        }
      `;

      if (isUnlocked) {
        card.querySelector('button')?.addEventListener('click', () => {
          audioManager.playButtonClick();
          this.game.startCampaignLevel(lvl.id);
        });
      }

      cardsList.appendChild(card);
    });
  }

  private renderGarageContent(): void {
    document.getElementById('garage-scrap-val')!.textContent = gameStore.save.scrap.toString();

    const selectedVehId = gameStore.save.selectedVehicleId;
    const veh = VEHICLES[selectedVehId] || VEHICLES.iron_fang;
    const isUnlocked = gameStore.save.unlockedVehicles.includes(veh.id);

    document.getElementById('garage-veh-name')!.textContent = veh.nameRu;
    document.getElementById('garage-veh-desc')!.textContent = veh.descriptionRu;

    // Vehicle Action
    const actionContainer = document.getElementById('garage-veh-action')!;
    if (isUnlocked) {
      actionContainer.innerHTML = `<div class="veh-status-selected">✓ ВЫБРАНА ДЛЯ БОЯ</div>`;
    } else {
      const canAfford = gameStore.save.scrap >= veh.price;
      actionContainer.innerHTML = `
        <button id="btn-buy-veh" class="${canAfford ? 'btn-gold' : 'btn-secondary'}" style="width:100%;">
          КУПИТЬ МАШИНУ (${veh.price} ⚙️)
        </button>
      `;
      document.getElementById('btn-buy-veh')?.addEventListener('click', () => {
        if (gameStore.unlockVehicle(veh.id)) {
          audioManager.playLevelUp();
          this.game.playerCar.rebuildVehicle(veh.id);
          this.renderGarageContent();
        }
      });
    }

    // Specs Fill Calculations
    const stats = gameStore.getEffectiveVehicleStats();
    const speedPct = Math.min(100, (stats.topSpeed / 34) * 100);
    const armorPct = Math.min(100, (stats.maxHealth / 160) * 100);
    const accelPct = Math.min(100, (stats.acceleration / 45) * 100);
    const driftPct = Math.min(100, (stats.handling / 5.0) * 100);
    const ramPct = Math.min(100, (stats.ramDamage / 45) * 100);

    document.getElementById('spec-speed-fill')!.style.width = `${speedPct}%`;
    document.getElementById('spec-armor-fill')!.style.width = `${armorPct}%`;
    document.getElementById('spec-accel-fill')!.style.width = `${accelPct}%`;
    document.getElementById('spec-drift-fill')!.style.width = `${driftPct}%`;
    document.getElementById('spec-ram-fill')!.style.width = `${ramPct}%`;

    // Render Upgrades List
    const uList = document.getElementById('garage-upgrades-list')!;
    uList.innerHTML = '';

    const upgradeEntries: { key: keyof GarageUpgrades; nameRu: string; icon: string; statDesc: string }[] = [
      { key: 'hullLevel', nameRu: 'Броня Кузова', icon: '🛡️', statDesc: '+10 Прочности' },
      { key: 'engineLevel', nameRu: 'Форсирование ДВС', icon: '⚡', statDesc: '+Скорость и Разгон' },
      { key: 'driftLevel', nameRu: 'Контроль Заноса', icon: '🏎️', statDesc: '+Управляемость' },
      { key: 'ramLevel', nameRu: 'Шипастый Таран', icon: '💥', statDesc: '+5 Урона Тарана' },
      { key: 'nitroLevel', nameRu: 'Нитро-Баллоны', icon: '💨', statDesc: '+Емкость и Реген' },
      { key: 'magnetLevel', nameRu: 'Магнит Ресурсов', icon: '🧲', statDesc: '+Радиус Сбора' },
    ];

    upgradeEntries.forEach(({ key, nameRu, icon, statDesc }) => {
      const currentLvl = gameStore.save.garageUpgrades[key];
      const maxLvl = GARAGE_UPGRADE_COSTS[key].length;
      const isMax = currentLvl >= maxLvl;
      const cost = isMax ? 0 : GARAGE_UPGRADE_COSTS[key][currentLvl];
      const canAfford = gameStore.save.scrap >= cost;

      let pips = '';
      for (let p = 1; p <= maxLvl; p++) {
        pips += `<span class="pip ${p <= currentLvl ? 'filled' : ''}"></span>`;
      }

      const item = document.createElement('div');
      item.className = 'garage-upgrade-card';
      item.innerHTML = `
        <div class="ug-card-header">
          <span class="ug-name">${icon} ${nameRu}</span>
          <span class="ug-lvl-text">Ур. ${currentLvl}/${maxLvl}</span>
        </div>
        <div class="ug-pips-row">${pips}</div>
        <div class="ug-stat-desc">${statDesc}</div>
        ${
          isMax
            ? `<div class="ug-max-badge">МАКСИМУМ</div>`
            : `<button class="${canAfford ? 'btn-gold' : 'btn-secondary'} ug-buy-btn">
                УЛУЧШИТЬ (${cost} ⚙️)
              </button>`
        }
      `;

      item.querySelector('button')?.addEventListener('click', () => {
        if (gameStore.buyGarageUpgrade(key)) {
          audioManager.playLevelUp();
          this.renderGarageContent();
        }
      });

      uList.appendChild(item);
    });
  }
}
