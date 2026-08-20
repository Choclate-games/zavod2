import * as THREE from 'three';
import { globalEventBus } from '../core/EventBus';
import { storageService } from '../platform/StorageService';
import { playgamaService } from '../platform/PlaygamaService';
import { audioManager } from '../audio/AudioManager';
import { UpgradeCard } from '../systems/UpgradeManager';

export class UIManager {
  private hudTop: HTMLElement | null = null;
  private hpBar: HTMLElement | null = null;
  private hpText: HTMLElement | null = null;
  private staminaBar: HTMLElement | null = null;
  private staminaText: HTMLElement | null = null;
  private waveTitle: HTMLElement | null = null;
  private waveEnemies: HTMLElement | null = null;
  private favorBar: HTMLElement | null = null;
  private favorText: HTMLElement | null = null;
  private goldText: HTMLElement | null = null;

  // Modals
  private modalMenu: HTMLElement | null = null;
  private modalUpgrade: HTMLElement | null = null;
  private modalPause: HTMLElement | null = null;
  private modalGameOver: HTMLElement | null = null;
  private modalForge: HTMLElement | null = null;
  private modalControls: HTMLElement | null = null;

  private damageOverlay: HTMLElement | null = null;

  // Preloader
  private preloader: HTMLElement | null = null;
  private preloaderBar: HTMLElement | null = null;
  private preloaderStatus: HTMLElement | null = null;

  constructor() {
    this.initElements();
    this.setupEventListeners();
    this.setupButtonActions();
  }

  private initElements(): void {
    this.hudTop = document.getElementById('hud-top');
    this.hpBar = document.getElementById('hud-hp-bar');
    this.hpText = document.getElementById('hud-hp-text');
    this.staminaBar = document.getElementById('hud-stamina-bar');
    this.staminaText = document.getElementById('hud-stamina-text');
    this.waveTitle = document.getElementById('hud-wave-title');
    this.waveEnemies = document.getElementById('hud-wave-enemies');
    this.favorBar = document.getElementById('hud-favor-bar');
    this.favorText = document.getElementById('hud-favor-text');
    this.goldText = document.getElementById('hud-gold-text');

    this.modalMenu = document.getElementById('modal-menu');
    this.modalUpgrade = document.getElementById('modal-upgrade');
    this.modalPause = document.getElementById('modal-pause');
    this.modalGameOver = document.getElementById('modal-gameover');
    this.modalForge = document.getElementById('modal-forge');
    this.modalControls = document.getElementById('modal-controls-info');

    this.damageOverlay = document.getElementById('damage-overlay');
    this.preloader = document.getElementById('preloader');
    this.preloaderBar = document.getElementById('preloader-bar');
    this.preloaderStatus = document.getElementById('preloader-status');
  }

  public setPreloaderProgress(percent: number, statusText: string): void {
    if (this.preloaderBar) {
      this.preloaderBar.style.width = `${percent}%`;
    }
    if (this.preloaderStatus) {
      this.preloaderStatus.textContent = statusText;
    }
    playgamaService.setLoadingProgress(percent);
  }

  public hidePreloader(): void {
    if (this.preloader) {
      this.preloader.classList.add('hidden');
    }
    this.updateMenuStats();
  }

  public updateMenuStats(): void {
    const save = storageService.getData();
    const bestWaveEl = document.getElementById('menu-best-wave');
    const goldEl = document.getElementById('menu-gold');
    if (bestWaveEl) bestWaveEl.textContent = `${save.bestWave}`;
    if (goldEl) goldEl.textContent = `🪙 ${save.gold}`;
  }

  public showMainMenu(): void {
    this.hideAllModals();
    this.updateMenuStats();
    if (this.modalMenu) this.modalMenu.classList.add('active');
    if (this.hudTop) this.hudTop.style.display = 'none';
  }

  public showHud(): void {
    this.hideAllModals();
    if (this.hudTop) this.hudTop.style.display = 'flex';
  }

  public showPauseModal(): void {
    if (this.modalPause) this.modalPause.classList.add('active');
  }

  public hidePauseModal(): void {
    if (this.modalPause) this.modalPause.classList.remove('active');
  }

  public showUpgradeModal(
    cards: UpgradeCard[],
    onSelect: (card: UpgradeCard) => void,
    onReroll: () => void
  ): void {
    if (!this.modalUpgrade) return;
    const container = document.getElementById('cards-container');
    if (container) {
      container.innerHTML = '';
      cards.forEach((card) => {
        const el = document.createElement('div');
        el.className = `upgrade-card ${card.rarity}`;
        el.innerHTML = `
          <div class="card-icon">${card.icon}</div>
          <div class="card-title">${card.title}</div>
          <div class="card-desc">${card.desc}</div>
          <div class="card-rarity">${card.rarity.toUpperCase()}</div>
        `;
        el.addEventListener('click', () => {
          audioManager.playSfx('pickup', 1.1);
          this.modalUpgrade?.classList.remove('active');
          onSelect(card);
        });
        container.appendChild(el);
      });
    }

    const btnReroll = document.getElementById('btn-reroll-cards');
    if (btnReroll) {
      btnReroll.onclick = () => {
        audioManager.playSfx('whoosh', 1.0);
        onReroll();
      };
    }

    this.modalUpgrade.classList.add('active');
  }

  public showGameOverModal(
    won: boolean,
    wave: number,
    kills: number,
    gold: number,
    onRevive: () => void,
    onDoubleGold: () => void,
    onMenu: () => void
  ): void {
    if (!this.modalGameOver) return;

    const titleEl = document.getElementById('gameover-title');
    const descEl = document.getElementById('gameover-desc');
    const wavesEl = document.getElementById('gameover-waves');
    const killsEl = document.getElementById('gameover-kills');
    const goldEl = document.getElementById('gameover-gold');

    if (titleEl) {
      titleEl.textContent = won ? '🏛️ ТРИУМФ КОЛИЗЕЯ!' : 'ПАВШИЙ НА ПЕСКЕ';
      titleEl.style.color = won ? '#eab308' : '#e63946';
    }
    if (descEl) {
      descEl.textContent = won
        ? 'Вы повергли Титана Рима и навеки вписали своё имя в историю!'
        : 'Ваш гладиус выбит из рук, но легенда о вас будет жить вечно.';
    }
    if (wavesEl) wavesEl.textContent = `${wave}/10`;
    if (killsEl) killsEl.textContent = `${kills}`;
    if (goldEl) goldEl.textContent = `🪙 ${gold}`;

    const btnRevive = document.getElementById('btn-revive');
    if (btnRevive) {
      btnRevive.style.display = won ? 'none' : 'flex';
      btnRevive.onclick = () => onRevive();
    }

    const btnDoubleGold = document.getElementById('btn-double-gold');
    if (btnDoubleGold) {
      btnDoubleGold.onclick = () => onDoubleGold();
    }

    const btnMenu = document.getElementById('btn-gameover-menu');
    if (btnMenu) {
      btnMenu.onclick = () => onMenu();
    }

    this.modalGameOver.classList.add('active');
  }

  public showForgeModal(): void {
    if (!this.modalForge) return;
    this.renderForgeItems();
    this.modalForge.classList.add('active');
  }

  public hideForgeModal(): void {
    if (this.modalForge) this.modalForge.classList.remove('active');
    this.updateMenuStats();
  }

  private renderForgeItems(): void {
    const container = document.getElementById('forge-items');
    const goldDisplay = document.getElementById('forge-gold-display');
    const save = storageService.getData();
    if (goldDisplay) goldDisplay.textContent = `${save.gold}`;
    if (!container) return;

    const upgrades = [
      {
        key: 'jointTorqueLevel' as const,
        name: '🦾 Мышечные Приводы Торса',
        desc: '+150 Н·м крутящего момента суставов (стойкость к сбитию)',
        baseCost: 50,
      },
      {
        key: 'bladeBalanceLevel' as const,
        name: '🗡️ Балансировочный Станок',
        desc: '+15% кинетического урона при взмахе меча',
        baseCost: 60,
      },
      {
        key: 'sandFireLevel' as const,
        name: '🔥 Смола Весты',
        desc: 'Начальный урон огнем при критических ударах',
        baseCost: 100,
      },
      {
        key: 'startingFavorLevel' as const,
        name: '👑 Благосклонность Патрициев',
        desc: '+20 стартовых очков ликования трибун',
        baseCost: 80,
      },
    ];

    container.innerHTML = '';
    upgrades.forEach((u) => {
      const level = save.metaUpgrades[u.key];
      const cost = Math.floor(u.baseCost * Math.pow(1.6, level));
      const canAfford = save.gold >= cost;

      const itemEl = document.createElement('div');
      itemEl.className = 'hud-block';
      itemEl.style.flexDirection = 'row';
      itemEl.style.justifyContent = 'space-between';
      itemEl.style.alignItems = 'center';
      itemEl.innerHTML = `
        <div style="text-align: left;">
          <div style="font-weight: bold; color: var(--primary-gold);">${u.name} (Ур. ${level})</div>
          <div style="font-size: 11px; color: var(--text-muted);">${u.desc}</div>
        </div>
        <button class="btn-primary" style="font-size: 13px; padding: 6px 14px; opacity: ${canAfford ? '1' : '0.5'};" ${canAfford ? '' : 'disabled'}>
          🪙 ${cost}
        </button>
      `;

      const btn = itemEl.querySelector('button');
      if (btn && canAfford) {
        btn.onclick = () => {
          if (storageService.upgradeMeta(u.key, cost)) {
            audioManager.playSfx('coin', 1.1);
            this.renderForgeItems();
          }
        };
      }
      container.appendChild(itemEl);
    });
  }

  public spawnFloatingText(text: string, color: string, screenX: number, screenY: number): void {
    if (!this.damageOverlay) return;

    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    el.style.color = color;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;

    this.damageOverlay.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 850);
  }

  public spawnWorldFloatingText(
    text: string,
    color: string,
    worldPos: THREE.Vector3,
    camera: THREE.PerspectiveCamera
  ): void {
    const tempVec = worldPos.clone();
    tempVec.project(camera);

    const x = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(tempVec.y * 0.5) + 0.5) * window.innerHeight;

    if (tempVec.z < 1) {
      this.spawnFloatingText(text, color, x, y);
    }
  }

  public hideAllModals(): void {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach((m) => m.classList.remove('active'));
  }

  private setupEventListeners(): void {
    globalEventBus.on('player:damaged', (data) => {
      if (this.hpBar && this.hpText) {
        const pct = Math.max(0, Math.min(100, (data.currentHp / data.maxHp) * 100));
        this.hpBar.style.width = `${pct}%`;
        this.hpText.textContent = `${Math.ceil(data.currentHp)}/${data.maxHp}`;
      }
    });

    globalEventBus.on('player:stamina_changed', (data) => {
      if (this.staminaBar && this.staminaText) {
        const pct = Math.max(0, Math.min(100, (data.current / data.max) * 100));
        this.staminaBar.style.width = `${pct}%`;
        this.staminaText.textContent = `${Math.ceil(pct)}%`;
      }
    });

    globalEventBus.on('wave:started', (data) => {
      if (this.waveTitle && this.waveEnemies) {
        this.waveTitle.textContent = `ВОЛНА ${data.wave}/10`;
        this.waveEnemies.textContent = `Врагов: ${data.totalEnemies}`;
      }
    });

    globalEventBus.on('wave:enemy_killed', (data) => {
      if (this.waveEnemies) {
        this.waveEnemies.textContent = `Врагов: ${data.remaining}`;
      }
    });

    globalEventBus.on('favor:changed', (data) => {
      if (this.favorBar && this.favorText) {
        const pct = Math.max(0, Math.min(100, (data.current / data.max) * 100));
        this.favorBar.style.width = `${pct}%`;
        this.favorText.textContent = `${Math.ceil(pct)}% (x${data.level})`;
      }
    });

    globalEventBus.on('gold:changed', (data) => {
      const current = storageService.updateGold(data.delta);
      if (this.goldText) {
        this.goldText.textContent = `${current}`;
      }
    });

    globalEventBus.on('audio:play_sfx', (data) => {
      audioManager.playSfx(data.sound, data.pitchVariation, data.volume);
    });
  }

  private setupButtonActions(): void {
    // Main Menu Sound Toggle
    const btnSound = document.getElementById('btn-toggle-sound');
    if (btnSound) {
      btnSound.onclick = () => {
        const isEnabled = audioManager.toggleSound();
        btnSound.textContent = isEnabled ? '🔊 Звук: ВКЛ' : '🔇 Звук: ВЫКЛ';
      };
    }

    // Pause Sound Toggle
    const btnPauseSound = document.getElementById('btn-pause-sound');
    if (btnPauseSound) {
      btnPauseSound.onclick = () => {
        const isEnabled = audioManager.toggleSound();
        btnPauseSound.textContent = isEnabled ? '🔊 Звук: ВКЛ' : '🔇 Звук: ВЫКЛ';
      };
    }

    // Controls modal
    const btnShowControls = document.getElementById('btn-show-controls');
    if (btnShowControls) {
      btnShowControls.onclick = () => {
        this.modalControls?.classList.add('active');
      };
    }

    const btnCloseControls = document.getElementById('btn-close-controls');
    if (btnCloseControls) {
      btnCloseControls.onclick = () => {
        this.modalControls?.classList.remove('active');
      };
    }

    // Open Forge
    const btnOpenForge = document.getElementById('btn-open-forge');
    if (btnOpenForge) {
      btnOpenForge.onclick = () => {
        this.showForgeModal();
      };
    }

    const btnCloseForge = document.getElementById('btn-close-forge');
    if (btnCloseForge) {
      btnCloseForge.onclick = () => {
        this.hideForgeModal();
      };
    }
  }
}
