// src/ui/UIManager.ts
import { eventBus } from '@/core/EventBus';
import { playgamaService } from '@/platform/PlaygamaService';
import { progressionManager } from '@/systems/ProgressionManager';
import { levelManager } from '@/systems/LevelManager';
import { TouchControls } from './TouchControls';
import { audioManager } from '@/audio/AudioManager';

export class UIManager {
  private static instance: UIManager;
  private uiRoot: HTMLElement;
  public touchControls: TouchControls;

  private currentScreen: 'menu' | 'hud' | 'victory' | 'gameover' | 'shop' | 'pause' = 'menu';

  public getCurrentScreen(): string {
    return this.currentScreen;
  }

  // HUD Elements
  private hudContainer!: HTMLElement;
  private levelTitleEl!: HTMLElement;
  private grainCounterEl!: HTMLElement;
  private gateProgressEl!: HTMLElement;
  private alertStatusPill!: HTMLElement;
  private timerEl!: HTMLElement;

  // Modals
  private menuModal!: HTMLElement;
  private victoryModal!: HTMLElement;
  private gameOverModal!: HTMLElement;
  private shopModal!: HTMLElement;
  private pauseModal!: HTMLElement;

  private isTouchForced: boolean = false;

  private constructor() {
    this.uiRoot = document.getElementById('ui-root') || document.body;

    // Check ?touch=1 query param or mobile device detection
    const params = new URLSearchParams(window.location.search);
    this.isTouchForced = params.get('touch') === '1' || (
      'ontouchstart' in window || navigator.maxTouchPoints > 0
    );

    this.touchControls = new TouchControls();

    this.buildStyles();
    this.buildHud();
    this.buildMenuModal();
    this.buildVictoryModal();
    this.buildGameOverModal();
    this.buildShopModal();
    this.buildPauseModal();

    this.bindEvents();
  }

  public static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }

  private buildStyles(): void {
    const style = document.createElement('style');
    style.innerHTML = `
      .ui-modal {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(10, 20, 10, 0.75);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 20;
        pointer-events: auto;
        animation: fadeIn 0.2s ease-out;
      }

      .ui-card {
        background: linear-gradient(160deg, #2c3e2d 0%, #1e2b1f 100%);
        border: 3px solid #6bb836;
        border-radius: 24px;
        padding: 24px 32px;
        box-shadow: 0 12px 36px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.2);
        color: #ffffff;
        text-align: center;
        max-width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        font-family: 'Nunito', sans-serif;
      }

      .btn-primary {
        background: linear-gradient(145deg, #2ecc71, #27ae60);
        color: #ffffff;
        font-family: 'Nunito', sans-serif;
        font-weight: 900;
        font-size: 18px;
        padding: 12px 28px;
        border: 2px solid #2ecc71;
        border-radius: 50px;
        box-shadow: 0 6px 16px rgba(46, 204, 113, 0.4);
        cursor: pointer;
        transition: transform 0.1s ease, filter 0.1s ease;
        outline: none;
        user-select: none;
        margin: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .btn-primary:active {
        transform: scale(0.95);
        filter: brightness(1.15);
      }

      .btn-secondary {
        background: linear-gradient(145deg, #e67e22, #d35400);
        color: #ffffff;
        font-family: 'Nunito', sans-serif;
        font-weight: 800;
        font-size: 16px;
        padding: 10px 22px;
        border: 2px solid #f39c12;
        border-radius: 50px;
        box-shadow: 0 4px 12px rgba(230, 126, 34, 0.4);
        cursor: pointer;
        transition: transform 0.1s ease;
        outline: none;
        user-select: none;
        margin: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .btn-secondary:active {
        transform: scale(0.95);
      }

      .btn-ad {
        background: linear-gradient(145deg, #9b59b6, #8e44ad);
        color: #ffffff;
        font-family: 'Nunito', sans-serif;
        font-weight: 900;
        font-size: 16px;
        padding: 12px 24px;
        border: 2px solid #bb86fc;
        border-radius: 50px;
        box-shadow: 0 6px 16px rgba(155, 89, 182, 0.4);
        cursor: pointer;
        transition: transform 0.1s ease;
        outline: none;
        margin: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .btn-ad:active {
        transform: scale(0.95);
      }

      .level-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 12px;
        margin: 16px 0;
      }

      .level-btn {
        background: #34495e;
        border: 2px solid #7f8c8d;
        border-radius: 14px;
        padding: 10px 6px;
        color: #ffffff;
        cursor: pointer;
        font-weight: 800;
        font-size: 16px;
        transition: all 0.15s ease;
      }

      .level-btn.unlocked {
        background: linear-gradient(145deg, #27ae60, #1e8449);
        border-color: #2ecc71;
        box-shadow: 0 4px 10px rgba(39, 174, 96, 0.35);
      }

      .level-btn.locked {
        opacity: 0.5;
        cursor: not-allowed;
        background: #2c3e50;
      }

      .level-btn:active:not(.locked) {
        transform: scale(0.92);
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }

      @keyframes pulseGlow {
        0% { transform: scale(1); filter: drop-shadow(0 0 4px #ffd700); }
        50% { transform: scale(1.08); filter: drop-shadow(0 0 12px #ffec3d); }
        100% { transform: scale(1); filter: drop-shadow(0 0 4px #ffd700); }
      }

      .pulse-gold {
        animation: pulseGlow 1.4s infinite ease-in-out;
      }
    `;
    document.head.appendChild(style);
  }

  private buildHud(): void {
    this.hudContainer = document.createElement('div');
    this.hudContainer.id = 'game-hud';
    this.hudContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      display: none;
      padding: calc(14px + env(safe-area-inset-top, 0px)) calc(16px + env(safe-area-inset-right, 0px)) calc(14px + env(safe-area-inset-bottom, 0px)) calc(16px + env(safe-area-inset-left, 0px));
      box-sizing: border-box;
    `;

    // Top Row HUD
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      pointer-events: none;
    `;

    // Top-Left: Pause button + Level title
    const topLeft = document.createElement('div');
    topLeft.style.cssText = `display: flex; align-items: center; gap: 10px; pointer-events: auto;`;

    const pauseBtn = document.createElement('button');
    pauseBtn.innerHTML = '⏸️';
    pauseBtn.style.cssText = `
      background: rgba(0,0,0,0.5);
      border: 2px solid rgba(255,255,255,0.4);
      color: #fff;
      font-size: 20px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    pauseBtn.onclick = () => {
      audioManager.playSfx('click');
      this.showPause();
    };

    this.levelTitleEl = document.createElement('div');
    this.levelTitleEl.style.cssText = `
      background: rgba(0,0,0,0.5);
      padding: 6px 14px;
      border-radius: 20px;
      border: 2px solid rgba(255,255,255,0.25);
      font-weight: 800;
      color: #ffffff;
      font-size: 15px;
    `;
    this.levelTitleEl.textContent = 'Уровень 1';

    topLeft.appendChild(pauseBtn);
    topLeft.appendChild(this.levelTitleEl);

    // Top-Center: Grain counter & Gate key progress
    const topCenter = document.createElement('div');
    topCenter.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      background: rgba(0,0,0,0.55);
      padding: 6px 20px;
      border-radius: 24px;
      border: 2px solid rgba(241, 196, 15, 0.5);
      pointer-events: auto;
    `;

    this.grainCounterEl = document.createElement('div');
    this.grainCounterEl.style.cssText = `
      font-size: 18px;
      font-weight: 900;
      color: #ffd700;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    this.grainCounterEl.innerHTML = '🌽 0 / 5';

    this.gateProgressEl = document.createElement('div');
    this.gateProgressEl.style.cssText = `
      font-size: 12px;
      font-weight: 800;
      color: #ecf0f1;
    `;
    this.gateProgressEl.textContent = '🔒 Ворота: 0%';

    topCenter.appendChild(this.grainCounterEl);
    topCenter.appendChild(this.gateProgressEl);

    // Top-Right: Timer & Stealth Status Pill
    const topRight = document.createElement('div');
    topRight.style.cssText = `display: flex; align-items: center; gap: 10px; pointer-events: auto;`;

    this.timerEl = document.createElement('div');
    this.timerEl.style.cssText = `
      background: rgba(0,0,0,0.5);
      padding: 6px 14px;
      border-radius: 20px;
      border: 2px solid rgba(255,255,255,0.25);
      font-weight: 800;
      color: #ffffff;
      font-size: 15px;
    `;
    this.timerEl.textContent = '⏱️ 0:00';

    this.alertStatusPill = document.createElement('div');
    this.alertStatusPill.style.cssText = `
      background: #27ae60;
      color: #ffffff;
      padding: 6px 16px;
      border-radius: 20px;
      font-weight: 900;
      font-size: 14px;
      box-shadow: 0 0 10px rgba(46, 204, 113, 0.6);
      transition: all 0.2s ease;
    `;
    this.alertStatusPill.textContent = '🟢 Безопасно';

    topRight.appendChild(this.timerEl);
    topRight.appendChild(this.alertStatusPill);

    topBar.appendChild(topLeft);
    topBar.appendChild(topCenter);
    topBar.appendChild(topRight);
    this.hudContainer.appendChild(topBar);

    // Bottom desktop keyboard controls hint
    if (!this.isTouchForced) {
      const hint = document.createElement('div');
      hint.style.cssText = `
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.6);
        color: #ecf0f1;
        padding: 6px 18px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.5px;
        pointer-events: none;
      `;
      hint.innerHTML = '⌨️ <b>[WASD]</b> / <b>[Стрелки]</b> — Шаг | <b>[Пробел]</b> / <b>[E]</b> — Коробка';
      this.hudContainer.appendChild(hint);
    }

    this.uiRoot.appendChild(this.hudContainer);
  }

  private buildMenuModal(): void {
    this.menuModal = document.createElement('div');
    this.menuModal.className = 'ui-modal';
    this.menuModal.id = 'menu-modal';

    const card = document.createElement('div');
    card.className = 'ui-card';
    card.style.width = '560px';

    card.innerHTML = `
      <div style="font-size: 52px; margin-bottom: 2px;">🐔📦🐕</div>
      <h1 style="font-size: 32px; font-weight: 900; color: #ffd700; margin-bottom: 4px; text-shadow: 0 4px 10px rgba(0,0,0,0.5);">
        КУРИНЫЙ ПОБЕГ 3D
      </h1>
      <div style="font-size: 16px; font-weight: 700; color: #a8e6cf; margin-bottom: 16px;">
        Стелс на Ферме
      </div>

      <div style="background: rgba(0,0,0,0.3); border-radius: 16px; padding: 12px; margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-weight: 800; font-size: 16px;">🎯 Выбор Уровня</span>
          <span id="menu-grain-bank" style="color: #ffd700; font-weight: 900; font-size: 16px;">🌽 0</span>
        </div>
        <div id="menu-level-grid" class="level-grid"></div>
      </div>

      <div>
        <button id="btn-start-game" class="btn-primary" style="font-size: 20px; padding: 14px 42px;">
          ▶️ В БОЙ!
        </button>
        <button id="btn-open-shop" class="btn-secondary">
          🥷 Гардероб
        </button>
        <button id="btn-open-settings" class="btn-secondary">
          ⚙️ Звук
        </button>
      </div>
    `;

    this.menuModal.appendChild(card);
    this.uiRoot.appendChild(this.menuModal);

    card.querySelector('#btn-start-game')?.addEventListener('click', () => {
      audioManager.playSfx('click');
      const save = playgamaService.getSave();
      this.startGame(save.unlockedLevel);
    });

    card.querySelector('#btn-open-shop')?.addEventListener('click', () => {
      audioManager.playSfx('click');
      this.showShop();
    });

    card.querySelector('#btn-open-settings')?.addEventListener('click', () => {
      audioManager.playSfx('click');
      this.showPause();
    });
  }

  private buildVictoryModal(): void {
    this.victoryModal = document.createElement('div');
    this.victoryModal.className = 'ui-modal';
    this.victoryModal.id = 'victory-modal';
    this.victoryModal.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'ui-card';
    card.style.width = '480px';

    card.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 2px;">🎉🌾</div>
      <h2 style="font-size: 30px; font-weight: 900; color: #2ecc71; margin-bottom: 8px;">ПОБЕГ УДАЛСЯ!</h2>
      <div id="victory-stars" style="font-size: 38px; margin-bottom: 12px; letter-spacing: 6px;">⭐⭐⭐</div>

      <div style="background: rgba(0,0,0,0.3); border-radius: 16px; padding: 14px; margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; font-size: 16px; margin-bottom: 6px;">
          <span>⏱️ Время прохождения:</span>
          <b id="victory-time">0:18</b>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 18px; color: #ffd700;">
          <span>🌽 Собрано зерен:</span>
          <b id="victory-grains">+10</b>
        </div>
      </div>

      <div id="victory-ad-container" style="margin-bottom: 12px;">
        <button id="btn-double-reward" class="btn-ad">
          ✨ Удвоить зерна (x2 Видео)
        </button>
      </div>

      <div>
        <button id="btn-next-level" class="btn-primary">
          Следующий Уровень ➔
        </button>
        <button id="btn-victory-menu" class="btn-secondary">
          В Меню
        </button>
      </div>
    `;

    this.victoryModal.appendChild(card);
    this.uiRoot.appendChild(this.victoryModal);

    card.querySelector('#btn-next-level')?.addEventListener('click', () => {
      audioManager.playSfx('click');
      const cur = levelManager.getCurrentLevelIndex();
      this.startGame(Math.min(15, cur + 1));
    });

    card.querySelector('#btn-victory-menu')?.addEventListener('click', () => {
      audioManager.playSfx('click');
      this.showMenu();
    });

    card.querySelector('#btn-double-reward')?.addEventListener('click', async () => {
      audioManager.playSfx('click');
      const btn = card.querySelector('#btn-double-reward') as HTMLButtonElement;
      btn.disabled = true;

      const rewarded = await playgamaService.showRewarded('double_grain_reward');
      if (rewarded) {
        const progress = levelManager.getGrainsProgress();
        progressionManager.addGrains(progress.collected); // Grant another batch
        const grainsEl = card.querySelector('#victory-grains');
        if (grainsEl) grainsEl.textContent = `+${progress.collected * 2} (x2!)`;
        btn.style.display = 'none';
        audioManager.playSfx('victory');
      } else {
        btn.disabled = false;
      }
    });
  }

  private buildGameOverModal(): void {
    this.gameOverModal = document.createElement('div');
    this.gameOverModal.className = 'ui-modal';
    this.gameOverModal.id = 'game-over-modal';
    this.gameOverModal.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'ui-card';
    card.style.width = '480px';

    card.innerHTML = `
      <div style="font-size: 52px; margin-bottom: 2px;">🐶🚨</div>
      <h2 style="font-size: 30px; font-weight: 900; color: #e74c3c; margin-bottom: 6px;">ПОЙМАНА С ПОЛИЧНЫМ!</h2>
      <p style="font-size: 15px; color: #ecf0f1; margin-bottom: 18px;">
        Сторожевой пес раскрыл маскировку! Замри в коробке в следующий раз.
      </p>

      <div id="gameover-ad-container" style="margin-bottom: 16px;">
        <button id="btn-revive-ad" class="btn-ad" style="background: linear-gradient(145deg, #27ae60, #2ecc71); border-color: #2ecc71;">
          🛡️ Спастись под коробкой (Revive Видео)
        </button>
      </div>

      <div>
        <button id="btn-retry-level" class="btn-primary">
          🔄 Попробовать снова
        </button>
        <button id="btn-gameover-menu" class="btn-secondary">
          В Меню
        </button>
      </div>
    `;

    this.gameOverModal.appendChild(card);
    this.uiRoot.appendChild(this.gameOverModal);

    card.querySelector('#btn-retry-level')?.addEventListener('click', () => {
      audioManager.playSfx('click');
      const cur = levelManager.getCurrentLevelIndex();
      this.startGame(cur);
    });

    card.querySelector('#btn-gameover-menu')?.addEventListener('click', () => {
      audioManager.playSfx('click');
      this.showMenu();
    });

    card.querySelector('#btn-revive-ad')?.addEventListener('click', async () => {
      audioManager.playSfx('click');
      const btn = card.querySelector('#btn-revive-ad') as HTMLButtonElement;
      btn.disabled = true;

      const rewarded = await playgamaService.showRewarded('revive_checkpoint');
      if (rewarded) {
        levelManager.revivePlayer();
        this.showHud();
        audioManager.playSfx('box_pop');
      } else {
        btn.disabled = false;
      }
    });
  }

  private buildShopModal(): void {
    this.shopModal = document.createElement('div');
    this.shopModal.className = 'ui-modal';
    this.shopModal.id = 'shop-modal';
    this.shopModal.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'ui-card';
    card.style.width = '640px';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <h2 style="font-size: 26px; font-weight: 900; color: #ffd700;">🥷 КУРИНЫЙ ГАРДЕРОБ</h2>
        <div id="shop-grain-balance" style="font-size: 18px; font-weight: 900; color: #ffd700;">🌽 0</div>
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 14px;">
        <button id="shop-tab-chickens" class="btn-primary" style="flex: 1; padding: 8px 12px; font-size: 15px;">Скины Курицы</button>
        <button id="shop-tab-boxes" class="btn-secondary" style="flex: 1; padding: 8px 12px; font-size: 15px;">Скины Коробок</button>
      </div>

      <div id="shop-items-container" style="max-height: 42vh; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; padding-right: 6px;"></div>

      <div>
        <button id="btn-rent-ninja-ad" class="btn-ad">
          🥷 Арендовать Ниндзя на 3 уровня (Видео)
        </button>
        <button id="btn-close-shop" class="btn-secondary">
          Закрыть
        </button>
      </div>
    `;

    this.shopModal.appendChild(card);
    this.uiRoot.appendChild(this.shopModal);

    let currentTab: 'chickens' | 'boxes' = 'chickens';

    const renderItems = () => {
      const container = card.querySelector('#shop-items-container');
      const balanceEl = card.querySelector('#shop-grain-balance');
      if (!container) return;

      container.innerHTML = '';
      if (balanceEl) balanceEl.textContent = `🌽 ${progressionManager.getTotalGrains()}`;

      const items = currentTab === 'chickens' ? progressionManager.chickenSkins : progressionManager.boxSkins;
      const equipped = progressionManager.getEquippedSkins();
      const currentEquippedId = currentTab === 'chickens' ? equipped.chicken : equipped.box;

      for (const item of items) {
        const itemRow = document.createElement('div');
        itemRow.style.cssText = `
          background: rgba(0,0,0,0.35);
          border: 2px solid ${item.id === currentEquippedId ? '#2ecc71' : 'rgba(255,255,255,0.15)'};
          border-radius: 14px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-align: left;
        `;

        const isEquipped = item.id === currentEquippedId;

        itemRow.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 32px;">${item.icon}</div>
            <div>
              <div style="font-weight: 800; font-size: 16px; color: ${isEquipped ? '#2ecc71' : '#ffffff'};">${item.name}</div>
              <div style="font-size: 12px; color: #bdc3c7;">${item.desc}</div>
            </div>
          </div>
          <div>
            ${
              isEquipped
                ? `<span style="color: #2ecc71; font-weight: 900; font-size: 14px;">✓ НАДЕТО</span>`
                : item.isUnlocked
                ? `<button class="btn-primary btn-equip" style="padding: 6px 16px; font-size: 14px;">Надеть</button>`
                : `<button class="btn-secondary btn-buy" style="padding: 6px 16px; font-size: 14px;">Купить 🌽 ${item.cost}</button>`
            }
          </div>
        `;

        itemRow.querySelector('.btn-equip')?.addEventListener('click', () => {
          audioManager.playSfx('click');
          if (currentTab === 'chickens') {
            progressionManager.equipChickenSkin(item.id);
          } else {
            progressionManager.equipBoxSkin(item.id);
          }
          renderItems();
        });

        itemRow.querySelector('.btn-buy')?.addEventListener('click', () => {
          audioManager.playSfx('click');
          const success = currentTab === 'chickens'
            ? progressionManager.buyChickenSkin(item.id)
            : progressionManager.buyBoxSkin(item.id);

          if (success) {
            audioManager.playSfx('grain');
            renderItems();
          } else {
            alert('Недостаточно зерен! Соберите больше на уровнях.');
          }
        });

        container.appendChild(itemRow);
      }
    };

    card.querySelector('#shop-tab-chickens')?.addEventListener('click', () => {
      currentTab = 'chickens';
      (card.querySelector('#shop-tab-chickens') as HTMLElement).className = 'btn-primary';
      (card.querySelector('#shop-tab-boxes') as HTMLElement).className = 'btn-secondary';
      renderItems();
    });

    card.querySelector('#shop-tab-boxes')?.addEventListener('click', () => {
      currentTab = 'boxes';
      (card.querySelector('#shop-tab-chickens') as HTMLElement).className = 'btn-secondary';
      (card.querySelector('#shop-tab-boxes') as HTMLElement).className = 'btn-primary';
      renderItems();
    });

    card.querySelector('#btn-rent-ninja-ad')?.addEventListener('click', async () => {
      audioManager.playSfx('click');
      const btn = card.querySelector('#btn-rent-ninja-ad') as HTMLButtonElement;
      btn.disabled = true;

      const rewarded = await playgamaService.showRewarded('unlock_ninja_skin');
      if (rewarded) {
        progressionManager.rentNinjaSkin();
        renderItems();
        audioManager.playSfx('victory');
      }
      btn.disabled = false;
    });

    card.querySelector('#btn-close-shop')?.addEventListener('click', () => {
      audioManager.playSfx('click');
      this.showMenu();
    });

    this.shopModal.addEventListener('render', () => renderItems());
  }

  private buildPauseModal(): void {
    this.pauseModal = document.createElement('div');
    this.pauseModal.className = 'ui-modal';
    this.pauseModal.id = 'pause-modal';
    this.pauseModal.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'ui-card';
    card.style.width = '420px';

    const settings = audioManager.getSettings();

    card.innerHTML = `
      <h2 style="font-size: 28px; font-weight: 900; color: #ffd700; margin-bottom: 16px;">ПАУЗА / НАСТРОЙКИ</h2>

      <div style="background: rgba(0,0,0,0.35); border-radius: 16px; padding: 16px; margin-bottom: 20px; text-align: left;">
        <div style="margin-bottom: 12px;">
          <label style="font-weight: 800; font-size: 14px; display: block; margin-bottom: 4px;">🔊 Звуковые эффекты</label>
          <input type="range" id="slider-sfx" min="0" max="1" step="0.05" value="${settings.sfxVolume}" style="width: 100%;">
        </div>
        <div style="margin-bottom: 12px;">
          <label style="font-weight: 800; font-size: 14px; display: block; margin-bottom: 4px;">🎵 Музыка</label>
          <input type="range" id="slider-music" min="0" max="1" step="0.05" value="${settings.musicVolume}" style="width: 100%;">
        </div>
        <div>
          <label style="font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="check-mute" ${settings.isMuted ? 'checked' : ''}>
            <span>Без звука</span>
          </label>
        </div>
      </div>

      <div>
        <button id="btn-resume" class="btn-primary" style="width: 100%; margin: 4px 0 8px 0;">
          ▶️ Продолжить
        </button>
        <button id="btn-restart" class="btn-secondary" style="width: 100%; margin: 4px 0 8px 0;">
          🔄 Перезапуск уровня
        </button>
        <button id="btn-pause-menu" class="btn-secondary" style="width: 100%; margin: 4px 0;">
          🏠 Главное Меню
        </button>
      </div>
    `;

    this.pauseModal.appendChild(card);
    this.uiRoot.appendChild(this.pauseModal);

    const sfxSlider = card.querySelector('#slider-sfx') as HTMLInputElement;
    const musicSlider = card.querySelector('#slider-music') as HTMLInputElement;
    const muteCheck = card.querySelector('#check-mute') as HTMLInputElement;

    sfxSlider?.addEventListener('input', () => {
      audioManager.setSfxVolume(parseFloat(sfxSlider.value));
    });

    musicSlider?.addEventListener('input', () => {
      audioManager.setMusicVolume(parseFloat(musicSlider.value));
    });

    muteCheck?.addEventListener('change', () => {
      audioManager.setMuted(muteCheck.checked);
    });

    card.querySelector('#btn-resume')?.addEventListener('click', () => {
      audioManager.playSfx('click');
      this.showHud();
    });

    card.querySelector('#btn-restart')?.addEventListener('click', () => {
      audioManager.playSfx('click');
      const cur = levelManager.getCurrentLevelIndex();
      this.startGame(cur);
    });

    card.querySelector('#btn-pause-menu')?.addEventListener('click', () => {
      audioManager.playSfx('click');
      this.showMenu();
    });
  }

  private bindEvents(): void {
    eventBus.on('player:grainCollected', ({ current, total }) => {
      this.grainCounterEl.innerHTML = `🌽 ${current} / ${total}`;
      const pct = Math.round((current / total) * 100);
      this.gateProgressEl.textContent = current >= total ? '🔓 Ворота ОТКРЫТЫ! Беги!' : `🔒 Ворота: ${pct}%`;
      if (current >= total) {
        this.gateProgressEl.style.color = '#2ecc71';
        this.grainCounterEl.classList.add('pulse-gold');
      }
    });

    eventBus.on('player:boxToggle', ({ isHiding }) => {
      this.touchControls.setBoxActiveState(isHiding);
    });

    eventBus.on('dog:alert', ({ state }) => {
      if (state === 'alert') {
        this.alertStatusPill.style.background = '#e74c3c';
        this.alertStatusPill.style.boxShadow = '0 0 14px #e74c3c';
        this.alertStatusPill.textContent = '🔴 ТРЕВОГА!';
      } else if (state === 'suspicious') {
        this.alertStatusPill.style.background = '#f39c12';
        this.alertStatusPill.style.boxShadow = '0 0 10px #f39c12';
        this.alertStatusPill.textContent = '🟡 Подозрение';
      } else {
        this.alertStatusPill.style.background = '#27ae60';
        this.alertStatusPill.style.boxShadow = '0 0 10px #2ecc71';
        this.alertStatusPill.textContent = '🟢 Безопасно';
      }
    });
  }

  public showMenu(): void {
    this.currentScreen = 'menu';
    this.hudContainer.style.display = 'none';
    this.victoryModal.style.display = 'none';
    this.gameOverModal.style.display = 'none';
    this.shopModal.style.display = 'none';
    this.pauseModal.style.display = 'none';
    this.menuModal.style.display = 'flex';
    this.touchControls.setVisible(false);

    // Refresh Level Grid
    const save = playgamaService.getSave();
    const grid = this.menuModal.querySelector('#menu-level-grid');
    const grainBank = this.menuModal.querySelector('#menu-grain-bank');
    if (grainBank) grainBank.textContent = `🌽 ${save.totalGrains}`;

    if (grid) {
      grid.innerHTML = '';
      for (let i = 1; i <= 15; i++) {
        const isUnlocked = i <= save.unlockedLevel;
        const stars = save.starsPerLevel[i] || 0;
        const btn = document.createElement('button');
        btn.className = `level-btn ${isUnlocked ? 'unlocked' : 'locked'}`;
        btn.innerHTML = `
          <div>${i}</div>
          <div style="font-size: 11px; margin-top: 2px;">${isUnlocked ? (stars > 0 ? '⭐'.repeat(stars) : '•') : '🔒'}</div>
        `;
        if (isUnlocked) {
          btn.addEventListener('click', () => {
            audioManager.playSfx('click');
            this.startGame(i);
          });
        }
        grid.appendChild(btn);
      }
    }

    eventBus.emit('game:stateChanged', { state: 'menu' });
    eventBus.emit('audio:setBgm', { track: 'stealth' });
  }

  public showHud(): void {
    this.currentScreen = 'hud';
    this.menuModal.style.display = 'none';
    this.victoryModal.style.display = 'none';
    this.gameOverModal.style.display = 'none';
    this.shopModal.style.display = 'none';
    this.pauseModal.style.display = 'none';
    this.hudContainer.style.display = 'block';

    if (this.isTouchForced) {
      this.touchControls.setVisible(true);
    }

    eventBus.emit('game:stateChanged', { state: 'playing' });
  }

  public showVictory(stars: number, grainsEarned: number, timeSec: number): void {
    this.currentScreen = 'victory';
    this.touchControls.setVisible(false);
    this.victoryModal.style.display = 'flex';

    const starsEl = this.victoryModal.querySelector('#victory-stars');
    const timeEl = this.victoryModal.querySelector('#victory-time');
    const grainsEl = this.victoryModal.querySelector('#victory-grains');
    const doubleBtn = this.victoryModal.querySelector('#btn-double-reward') as HTMLButtonElement;

    if (starsEl) starsEl.textContent = '⭐'.repeat(Math.max(1, stars));
    if (timeEl) {
      const m = Math.floor(timeSec / 60);
      const s = Math.floor(timeSec % 60);
      timeEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    }
    if (grainsEl) grainsEl.textContent = `+${grainsEarned}`;
    if (doubleBtn) {
      doubleBtn.style.display = 'inline-flex';
      doubleBtn.disabled = false;
    }

    eventBus.emit('game:stateChanged', { state: 'victory' });
    eventBus.emit('audio:playSfx', { name: 'victory' });
  }

  public showGameOver(): void {
    this.currentScreen = 'gameover';
    this.touchControls.setVisible(false);
    this.gameOverModal.style.display = 'flex';

    const reviveBtn = this.gameOverModal.querySelector('#btn-revive-ad') as HTMLButtonElement;
    if (reviveBtn) reviveBtn.disabled = false;

    eventBus.emit('game:stateChanged', { state: 'gameover' });
    eventBus.emit('audio:playSfx', { name: 'gameover' });
  }

  public showShop(): void {
    this.currentScreen = 'shop';
    this.touchControls.setVisible(false);
    this.shopModal.style.display = 'flex';
    this.shopModal.dispatchEvent(new Event('render'));
    eventBus.emit('game:stateChanged', { state: 'shop' });
  }

  public showPause(): void {
    this.currentScreen = 'pause';
    this.touchControls.setVisible(false);
    this.pauseModal.style.display = 'flex';
    eventBus.emit('game:stateChanged', { state: 'paused' });
  }

  public updateTimerDisplay(timeSec: number): void {
    const m = Math.floor(timeSec / 60);
    const s = Math.floor(timeSec % 60);
    this.timerEl.textContent = `⏱️ ${m}:${s < 10 ? '0' : ''}${s}`;
  }

  public setLevelTitle(title: string): void {
    this.levelTitleEl.textContent = title;
    this.grainCounterEl.classList.remove('pulse-gold');
    this.gateProgressEl.style.color = '#ecf0f1';
    this.alertStatusPill.style.background = '#27ae60';
    this.alertStatusPill.textContent = '🟢 Безопасно';
  }

  private startGame(levelIndex: number): void {
    window.dispatchEvent(new CustomEvent('action:startLevel', { detail: { levelIndex } }));
  }
}

export const uiManager = UIManager.getInstance();
