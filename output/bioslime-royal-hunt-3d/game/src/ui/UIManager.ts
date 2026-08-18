import { EventBus } from '../core/EventBus';
import { PlayerSlime } from '../entities/PlayerSlime';
import { MutationDefinition, SaveData } from '../types';
import { StorageService } from '../platform/StorageService';
import { LAB_GENES_DATABASE } from '../config/LabUpgradesData';
import { AudioManager } from '../audio/AudioManager';
import { PlaygamaService } from '../platform/PlaygamaService';
import { VirtualJoystick } from './VirtualJoystick';

export class UIManager {
  private container: HTMLElement;
  public joystick!: VirtualJoystick;

  // HUD elements
  private hudRoot: HTMLElement | null = null;
  private massValEl: HTMLElement | null = null;
  private timerTextEl: HTMLElement | null = null;
  private waveLabelEl: HTMLElement | null = null;
  private expFillEl: HTMLElement | null = null;
  private levelBadgeEl: HTMLElement | null = null;
  private dnaValEl: HTMLElement | null = null;
  private killsValEl: HTMLElement | null = null;
  private dashCooldownEl: HTMLElement | null = null;
  private bossBannerEl: HTMLElement | null = null;
  private bossBannerTitleEl: HTMLElement | null = null;
  private bossPointerEl: HTMLElement | null = null;

  // Active modal
  private activeModal: HTMLElement | null = null;

  constructor() {
    this.container = document.getElementById('screens-container') || document.body;
  }

  // ---------------- HUD VIEW ----------------
  public showHUD(onDashClick: () => void, onPauseClick: () => void): void {
    this.clearModals();
    this.container.innerHTML = `
      <div class="hud-root">
        <!-- Top HUD Bar -->
        <div class="hud-top-bar">
          <!-- Mass & HP -->
          <div class="hud-hp-mass-widget">
            <div class="hud-slime-avatar">
              <span class="hud-slime-icon">🦠</span>
            </div>
            <div class="hud-hp-text-group">
              <span class="hud-mass-title">МАССА / HP</span>
              <span class="hud-mass-value" id="hud-mass">10</span>
            </div>
          </div>

          <!-- Center Timer & Exp -->
          <div class="hud-center-group">
            <div class="hud-timer-badge">
              <span class="hud-timer-icon">⏳</span>
              <span class="hud-timer-text" id="hud-timer">00:00</span>
            </div>
            <div class="hud-exp-container">
              <div class="hud-exp-fill" id="hud-exp-fill"></div>
              <span class="hud-level-badge" id="hud-level-badge">LVL 1</span>
            </div>
            <span class="hud-wave-label" id="hud-wave-label">Волна 1: Крестьяне</span>
          </div>

          <!-- Right Counters & Pause -->
          <div class="hud-right-group">
            <div class="hud-stat-pill">
              <span class="hud-stat-icon">🧬</span>
              <span class="hud-stat-val dna-val" id="hud-dna">0</span>
            </div>
            <div class="hud-stat-pill">
              <span class="hud-stat-icon">💀</span>
              <span class="hud-stat-val" id="hud-kills">0</span>
            </div>
            <button class="hud-btn-icon" id="btn-pause">⏸️</button>
          </div>
        </div>

        <!-- Boss Warning Banner -->
        <div class="boss-banner" id="boss-banner">
          <div class="boss-banner-title" id="boss-banner-title">ВНИМАНИЕ: БОСС!</div>
          <div class="boss-banner-subtitle">Королевская Гвардия наступает!</div>
        </div>

        <!-- Boss Pointer Arrow -->
        <div class="boss-pointer" id="boss-pointer">
          <svg class="boss-pointer-icon" viewBox="0 0 24 24" fill="#ff3344">
            <path d="M12 2L2 22L12 17L22 22L12 2Z"/>
          </svg>
        </div>

        <!-- Touch Controls -->
        <div class="joystick-zone" id="joy-zone">
          <div class="joystick-base" id="joy-base">
            <div class="joystick-knob" id="joy-knob"></div>
          </div>
        </div>

        <!-- Dash Action Button -->
        <div class="dash-btn-container">
          <button class="dash-btn" id="btn-dash">
            <div class="dash-cooldown-overlay" id="dash-cooldown-fill"></div>
            <span class="dash-btn-icon">⚡</span>
            <span class="dash-btn-label">РЫВОК</span>
          </button>
        </div>
      </div>
    `;

    // Bind HUD references
    this.hudRoot = this.container.querySelector('.hud-root');
    this.massValEl = document.getElementById('hud-mass');
    this.timerTextEl = document.getElementById('hud-timer');
    this.waveLabelEl = document.getElementById('hud-wave-label');
    this.expFillEl = document.getElementById('hud-exp-fill');
    this.levelBadgeEl = document.getElementById('hud-level-badge');
    this.dnaValEl = document.getElementById('hud-dna');
    this.killsValEl = document.getElementById('hud-kills');
    this.dashCooldownEl = document.getElementById('dash-cooldown-fill');
    this.bossBannerEl = document.getElementById('boss-banner');
    this.bossBannerTitleEl = document.getElementById('boss-banner-title');
    this.bossPointerEl = document.getElementById('boss-pointer');

    // Init Joystick
    const zone = document.getElementById('joy-zone')!;
    const base = document.getElementById('joy-base')!;
    const knob = document.getElementById('joy-knob')!;
    this.joystick = new VirtualJoystick(zone, base, knob);

    // Button actions
    document.getElementById('btn-dash')?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onDashClick();
    });

    document.getElementById('btn-pause')?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onPauseClick();
    });
  }

  public updateHUD(player: PlayerSlime, gameTimer: number): void {
    if (!this.hudRoot) return;

    // Mass / HP
    if (this.massValEl) {
      this.massValEl.textContent = `${Math.floor(player.stats.mass)} (HP: ${Math.floor(player.stats.hp)})`;
    }

    // Timer (MM:SS)
    if (this.timerTextEl) {
      const mins = Math.floor(gameTimer / 60);
      const secs = Math.floor(gameTimer % 60);
      this.timerTextEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Exp Bar
    if (this.expFillEl) {
      const pct = Math.min(100, (player.stats.biomass / player.stats.biomassToNextLevel) * 100);
      this.expFillEl.style.width = `${pct}%`;
    }
    if (this.levelBadgeEl) {
      this.levelBadgeEl.textContent = `LVL ${player.stats.level}`;
    }

    // DNA & Kills
    if (this.dnaValEl) {
      this.dnaValEl.textContent = `${player.stats.dnaEarned}`;
    }
    if (this.killsValEl) {
      this.killsValEl.textContent = `${player.stats.enemiesAbsorbed}`;
    }

    // Dash Cooldown Overlay
    if (this.dashCooldownEl) {
      if (player.dashCooldownTimer > 0) {
        const cdPct = (player.dashCooldownTimer / player.stats.dashCooldown) * 100;
        this.dashCooldownEl.style.height = `${cdPct}%`;
      } else {
        this.dashCooldownEl.style.height = `0%`;
      }
    }

    // Wave label
    if (this.waveLabelEl) {
      if (gameTimer < 90) {
        this.waveLabelEl.textContent = 'Волна 1: Сбор биомассы';
      } else if (gameTimer < 180) {
        this.waveLabelEl.textContent = 'Волна 2: Стража и Лучники';
      } else if (gameTimer < 360) {
        this.waveLabelEl.textContent = 'Волна 3: Рыцарская Конница';
      } else if (gameTimer < 540) {
        this.waveLabelEl.textContent = 'Волна 4: Королевские Паладины';
      } else {
        this.waveLabelEl.textContent = 'ФИНАЛ: Осадная Инквизиция';
      }
    }
  }

  public showBossBanner(bossName: string): void {
    if (!this.bossBannerEl || !this.bossBannerTitleEl) return;
    this.bossBannerTitleEl.textContent = bossName.toUpperCase();
    this.bossBannerEl.classList.add('show');
    setTimeout(() => {
      this.bossBannerEl?.classList.remove('show');
    }, 4000);
  }

  // ---------------- MAIN MENU ----------------
  public showMainMenu(
    onPlay: () => void,
    onOpenLab: () => void,
    onToggleSound: () => void
  ): void {
    this.clearModals();
    const data = StorageService.getInstance().getData();

    const menu = document.createElement('div');
    menu.className = 'modal-backdrop';
    menu.innerHTML = `
      <div class="modal-dialog menu-container">
        <div class="menu-game-title">БИОСЛИЗЬ 3D</div>
        <div class="menu-game-subtitle">КОРОЛЕВСКАЯ ОХОТА</div>

        <div class="lab-balance-bar">
          <span>🧬 ДНК БАЛАНС:</span>
          <strong class="dna-val" style="font-size: 20px;">${data.dnaBalance}</strong>
        </div>

        <div class="menu-btn-group">
          <button class="btn-primary" id="btn-play">В БОЙ! ⚔️</button>
          <button class="btn-secondary" id="btn-lab">🧬 ЛАБОРАТОРИЯ МУТАЦИЙ</button>
          <button class="btn-secondary" id="btn-audio">🔊 ЗВУК: ${data.soundEnabled ? 'ВКЛ' : 'ВЫКЛ'}</button>
        </div>
      </div>
    `;

    this.container.appendChild(menu);
    this.activeModal = menu;

    document.getElementById('btn-play')?.addEventListener('click', onPlay);
    document.getElementById('btn-lab')?.addEventListener('click', onOpenLab);
    document.getElementById('btn-audio')?.addEventListener('click', () => {
      onToggleSound();
      const newData = StorageService.getInstance().getData();
      const btn = document.getElementById('btn-audio');
      if (btn) btn.textContent = `🔊 ЗВУК: ${newData.soundEnabled ? 'ВКЛ' : 'ВЫКЛ'}`;
    });
  }

  // ---------------- LEVEL UP MODAL ----------------
  public showLevelUp(
    choices: MutationDefinition[],
    activeLevels: Map<string, number>,
    onSelect: (id: string) => void,
    onReroll: () => void
  ): void {
    this.clearModals();

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';

    let cardsHtml = '';
    choices.forEach((card, idx) => {
      const curLvl = activeLevels.get(card.id) || 0;
      const nextLvl = curLvl + 1;
      const rarityClass = card.rarity;

      cardsHtml += `
        <div class="mutation-card ${rarityClass}" data-id="${card.id}">
          <div class="card-rarity-tag">${card.rarity}</div>
          <div class="card-icon">${card.icon}</div>
          <div class="card-title">${card.name}</div>
          <div class="card-desc">${card.description}</div>
          <div class="card-level-tag">Уровень: ${curLvl > 0 ? `${curLvl} ➜ ${nextLvl}` : 'НОВОЕ!'}</div>
        </div>
      `;
    });

    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="levelup-title">🧬 МУТАЦИЯ БИОМАССЫ!</div>
        <div class="levelup-subtitle">Выберите генетическое улучшение слизи</div>

        <div class="cards-row">
          ${cardsHtml}
        </div>

        <div class="levelup-actions">
          <button class="btn-secondary" id="btn-reroll">🎲 РЕРОЛЛ (РЕКЛАМА)</button>
        </div>
      </div>
    `;

    this.container.appendChild(modal);
    this.activeModal = modal;

    // Card selection
    modal.querySelectorAll('.mutation-card').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (id) onSelect(id);
      });
    });

    document.getElementById('btn-reroll')?.addEventListener('click', onReroll);
  }

  // ---------------- GAME OVER MODAL ----------------
  public showGameOver(
    timeSurvived: number,
    maxMass: number,
    enemiesAbsorbed: number,
    dnaEarned: number,
    canRevive: boolean,
    onRevive: () => void,
    onMenu: () => void
  ): void {
    this.clearModals();

    const mins = Math.floor(timeSurvived / 60);
    const secs = Math.floor(timeSurvived % 60);
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="gameover-title">💀 БИОМАССА УНИЧТОЖЕНА</div>
        <div style="font-family: var(--font-tech); color: #94a3b8; letter-spacing: 1px;">Королевская армия временно остановила ваше шествие</div>

        <div class="stats-grid">
          <div class="stat-box">
            <span class="stat-box-title">ВРЕМЯ ВЫЖИВАНИЯ</span>
            <span class="stat-box-value">${timeStr}</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-title">ДОСТИГНУТА МАССА</span>
            <span class="stat-box-value" style="color: var(--slime-primary);">${Math.floor(maxMass)}</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-title">ПОГЛОЩЕНО ВРАГОВ</span>
            <span class="stat-box-value">${enemiesAbsorbed}</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-title">СОБРАНО ДНК</span>
            <span class="stat-box-value dna-val">+${dnaEarned}</span>
          </div>
        </div>

        <div style="display: flex; gap: 14px;">
          ${canRevive ? `<button class="btn-primary" id="btn-revive">💖 ВТОРОЕ ДЫХАНИЕ (РЕКЛАМА)</button>` : ''}
          <button class="btn-secondary" id="btn-gameover-menu">В МЕНЮ 🏠</button>
        </div>
      </div>
    `;

    this.container.appendChild(modal);
    this.activeModal = modal;

    if (canRevive) {
      document.getElementById('btn-revive')?.addEventListener('click', onRevive);
    }
    document.getElementById('btn-gameover-menu')?.addEventListener('click', onMenu);
  }

  // ---------------- VICTORY MODAL ----------------
  public showVictory(
    dnaEarned: number,
    onDoubleDna: () => void,
    onMenu: () => void
  ): void {
    this.clearModals();

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="victory-title">👑 КОРОЛЕВСТВО ПОГЛОЩЕНО!</div>
        <div style="font-family: var(--font-tech); color: #cbd5e1; font-size: 16px; margin-bottom: 12px;">
          Вы выжили все 10 минут и сокрушили Королевского Осадного Голема!
        </div>

        <div class="lab-balance-bar">
          <span>ПОЛУЧЕНО ДНК ЗА ПОБЕДУ:</span>
          <strong class="dna-val" style="font-size: 24px;">+${dnaEarned}</strong>
        </div>

        <div style="display: flex; gap: 14px; margin-top: 18px;">
          <button class="btn-gold" id="btn-double-dna">✨ УДВОИТЬ ДНК x2 (РЕКЛАМА)</button>
          <button class="btn-secondary" id="btn-victory-menu">В ГЛАВНОЕ МЕНЮ 🏠</button>
        </div>
      </div>
    `;

    this.container.appendChild(modal);
    this.activeModal = modal;

    document.getElementById('btn-double-dna')?.addEventListener('click', onDoubleDna);
    document.getElementById('btn-victory-menu')?.addEventListener('click', onMenu);
  }

  // ---------------- GENETIC LAB MODAL ----------------
  public showLab(onBack: () => void): void {
    this.clearModals();
    const storage = StorageService.getInstance();
    const data = storage.getData();

    const renderLab = () => {
      let gridHtml = '';
      LAB_GENES_DATABASE.forEach((gene) => {
        const curLvl = data.geneLevels[gene.id] || 0;
        const isMax = curLvl >= gene.maxLevel;
        const cost = Math.floor(gene.baseCost * Math.pow(gene.costMultiplier, curLvl));
        const canAfford = data.dnaBalance >= cost && !isMax;

        let pipsHtml = '';
        for (let i = 0; i < gene.maxLevel; i++) {
          pipsHtml += `<div class="gene-pip ${i < curLvl ? 'filled' : ''}"></div>`;
        }

        gridHtml += `
          <div class="lab-gene-item">
            <div class="gene-flask-icon">${gene.icon}</div>
            <div class="gene-info">
              <div class="gene-name">${gene.name} (Lvl ${curLvl}/${gene.maxLevel})</div>
              <div class="gene-stat">${gene.statDescription}</div>
              <div class="gene-pips">${pipsHtml}</div>
            </div>
            <button class="btn-gene-buy" data-gene="${gene.id}" ${canAfford ? '' : 'disabled'}>
              ${isMax ? 'МАКС' : `<span>КУПИТЬ</span><small>${cost} 🧬</small>`}
            </button>
          </div>
        `;
      });

      return `
        <div class="modal-dialog">
          <div class="lab-title">🧪 ЛАБОРАТОРИЯ МУТАЦИЙ</div>
          <div class="lab-balance-bar">
            <span>ВАШ ЗАПАС ДНК:</span>
            <strong class="dna-val" style="font-size: 22px;">${data.dnaBalance} 🧬</strong>
          </div>

          <div class="lab-grid">
            ${gridHtml}
          </div>

          <button class="btn-secondary" id="btn-lab-back">НАЗАД В МЕНЮ ↩️</button>
        </div>
      `;
    };

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = renderLab();

    this.container.appendChild(modal);
    this.activeModal = modal;

    const bindActions = () => {
      modal.querySelectorAll('.btn-gene-buy').forEach((btn) => {
        btn.addEventListener('click', () => {
          const geneId = btn.getAttribute('data-gene');
          if (!geneId) return;
          const gene = LAB_GENES_DATABASE.find((g) => g.id === geneId)!;
          const curLvl = data.geneLevels[geneId] || 0;
          const cost = Math.floor(gene.baseCost * Math.pow(gene.costMultiplier, curLvl));

          if (storage.spendDNA(cost)) {
            storage.upgradeGene(geneId);
            AudioManager.getInstance().playLevelUp();
            modal.innerHTML = renderLab();
            bindActions();
          }
        });
      });

      document.getElementById('btn-lab-back')?.addEventListener('click', onBack);
    };

    bindActions();
  }

  // ---------------- PAUSE MODAL ----------------
  public showPause(onResume: () => void, onRestart: () => void, onMenu: () => void): void {
    this.clearModals();

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="levelup-title" style="color: #fff; margin-bottom: 20px;">⏸️ ИГРА НА ПАУЗЕ</div>
        <div class="menu-btn-group">
          <button class="btn-primary" id="btn-resume">ПРОДОЛЖИТЬ ▶️</button>
          <button class="btn-secondary" id="btn-restart">РЕСТАРТ 🔄</button>
          <button class="btn-secondary" id="btn-pause-menu">В ГЛАВНОЕ МЕНЮ 🏠</button>
        </div>
      </div>
    `;

    this.container.appendChild(modal);
    this.activeModal = modal;

    document.getElementById('btn-resume')?.addEventListener('click', onResume);
    document.getElementById('btn-restart')?.addEventListener('click', onRestart);
    document.getElementById('btn-pause-menu')?.addEventListener('click', onMenu);
  }

  public clearModals(): void {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }
  }
}
