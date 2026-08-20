/**
 * Comprehensive DOM UI & HUD Manager with Camp Upgrades & Leaderboards
 */

import { eventBus } from '../core/EventBus';
import { StorageService } from '../platform/StorageService';
import { PlaygamaService } from '../platform/PlaygamaService';
import { AudioManager } from '../audio/AudioManager';
import { TouchControls } from './VirtualJoystick';

export class UIManager {
  public touchControls: TouchControls;

  // DOM references
  private hudTopEl: HTMLElement | null;
  private hudBottomEl: HTMLElement | null;
  private stealthIndicatorEl: HTMLElement | null;
  private stealthStatusTextEl: HTMLElement | null;

  private barHp: HTMLElement | null;
  private labelHp: HTMLElement | null;
  private barStealth: HTMLElement | null;
  private labelStealth: HTMLElement | null;
  private labelWave: HTMLElement | null;
  private labelSeason: HTMLElement | null;
  private labelEnemies: HTMLElement | null;
  private labelSalt: HTMLElement | null;
  private labelHerbs: HTMLElement | null;
  private labelCoins: HTMLElement | null;
  private barFavor: HTMLElement | null;
  private labelFavor: HTMLElement | null;

  // Modals
  private modalMainMenu: HTMLElement | null;
  private modalPause: HTMLElement | null;
  private modalGameOver: HTMLElement | null;
  private modalTalents: HTMLElement | null;
  private modalLeaderboard: HTMLElement | null;
  private fctContainer: HTMLElement | null;

  // Callbacks
  private onStartGameCb: (() => void) | null = null;
  private onRestartGameCb: (() => void) | null = null;
  private onReviveGameCb: (() => void) | null = null;
  private onQuitToMenuCb: (() => void) | null = null;

  constructor() {
    this.touchControls = new TouchControls();

    this.hudTopEl = document.getElementById('hud-top');
    this.hudBottomEl = document.getElementById('hud-bottom');
    this.stealthIndicatorEl = document.getElementById('stealth-indicator');
    this.stealthStatusTextEl = document.getElementById('stealth-status-text');

    this.barHp = document.getElementById('bar-hp');
    this.labelHp = document.getElementById('label-hp');
    this.barStealth = document.getElementById('bar-stealth');
    this.labelStealth = document.getElementById('label-stealth');
    this.labelWave = document.getElementById('label-wave');
    this.labelSeason = document.getElementById('label-season');
    this.labelEnemies = document.getElementById('label-enemies');
    this.labelSalt = document.getElementById('label-salt');
    this.labelHerbs = document.getElementById('label-herbs');
    this.labelCoins = document.getElementById('label-coins');
    this.barFavor = document.getElementById('bar-favor');
    this.labelFavor = document.getElementById('label-favor');

    this.modalMainMenu = document.getElementById('modal-main-menu');
    this.modalPause = document.getElementById('modal-pause');
    this.modalGameOver = document.getElementById('modal-gameover');
    this.modalTalents = document.getElementById('modal-talents');
    this.modalLeaderboard = document.getElementById('modal-leaderboard');
    this.fctContainer = document.getElementById('fct-container');

    this.setupEventListeners();
    this.setupButtonBinds();
  }

  private setupEventListeners(): void {
    eventBus.on('player:stats', (stats) => {
      if (this.labelHp && this.barHp) {
        this.labelHp.textContent = `${Math.ceil(stats.hp)}/${stats.maxHp}`;
        const hpPercent = Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100));
        this.barHp.style.width = `${hpPercent}%`;
      }
      if (this.labelSalt) this.labelSalt.textContent = `${stats.salt}`;
      if (this.labelHerbs) this.labelHerbs.textContent = `${stats.herbs}`;
      if (this.labelCoins) this.labelCoins.textContent = `${stats.coins}`;
    });

    eventBus.on('stealth:state', (stealth) => {
      if (this.barStealth && this.labelStealth) {
        const pct = Math.round(stealth.concealment * 100);
        this.barStealth.style.width = `${pct}%`;
        this.labelStealth.textContent = `${pct}%`;
      }

      if (this.stealthIndicatorEl && this.stealthStatusTextEl) {
        if (stealth.isHidden) {
          this.stealthIndicatorEl.className = 'hidden-mode';
          this.stealthStatusTextEl.textContent = 'В тени кустов (Невидим)';
        } else if (stealth.isSpotted) {
          this.stealthIndicatorEl.className = 'spotted-mode';
          this.stealthStatusTextEl.textContent = 'ОБНАРУЖЕН ДУХАМИ!';
        } else {
          this.stealthIndicatorEl.className = '';
          this.stealthStatusTextEl.textContent = 'В движении по лесу';
        }
      }
    });

    eventBus.on('colony:favor', (payload) => {
      if (this.barFavor && this.labelFavor) {
        this.barFavor.style.width = `${payload.favor}%`;
        this.labelFavor.textContent = `${Math.round(payload.favor)}%`;
      }
    });

    eventBus.on('wave:start', (payload) => {
      if (this.labelWave) this.labelWave.textContent = payload.title;
      if (this.labelEnemies) this.labelEnemies.textContent = `${payload.enemyCount}`;
    });

    eventBus.on('ui:fct', (fct) => {
      this.spawnFloatingText(fct.text, fct.x, fct.y, fct.color, fct.size);
    });
  }

  private setupButtonBinds(): void {
    // Start Game
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      this.onStartGameCb?.();
    });

    // Pause button
    document.getElementById('btn-pause')?.addEventListener('click', () => {
      this.showPause();
    });

    // Pause menu buttons
    document.getElementById('btn-resume')?.addEventListener('click', () => {
      this.hidePause();
      eventBus.emit('game:resume');
    });

    document.getElementById('btn-toggle-sound')?.addEventListener('click', (e) => {
      const isMuted = AudioManager.toggleMute();
      (e.target as HTMLElement).textContent = isMuted ? '🔇 Звук: ВЫКЛ' : '🔊 Звук: ВКЛ';
    });

    document.getElementById('btn-quit-menu')?.addEventListener('click', () => {
      this.hidePause();
      this.showMainMenu();
      this.onQuitToMenuCb?.();
    });

    // Talents modal
    document.getElementById('btn-open-talents')?.addEventListener('click', () => {
      this.showTalentsModal();
    });
    document.getElementById('btn-close-talents')?.addEventListener('click', () => {
      this.hideTalentsModal();
    });

    // Leaderboard modal
    document.getElementById('btn-open-leaderboard')?.addEventListener('click', () => {
      this.showLeaderboardModal();
    });
    document.getElementById('btn-close-leaderboard')?.addEventListener('click', () => {
      this.hideLeaderboardModal();
    });

    // Game Over Buttons
    document.getElementById('btn-gameover-restart')?.addEventListener('click', () => {
      PlaygamaService.flushInterstitial();
      this.onRestartGameCb?.();
    });

    document.getElementById('btn-gameover-menu')?.addEventListener('click', () => {
      PlaygamaService.flushInterstitial();
      this.showMainMenu();
      this.onQuitToMenuCb?.();
    });

    document.getElementById('btn-revive-ad')?.addEventListener('click', async () => {
      const rewarded = await PlaygamaService.showRewarded('revive_run');
      if (rewarded) {
        this.hideGameOver();
        this.onReviveGameCb?.();
      }
    });

    document.getElementById('btn-double-gold-ad')?.addEventListener('click', async () => {
      const rewarded = await PlaygamaService.showRewarded('double_gold_run');
      if (rewarded) {
        const save = StorageService.getSaveData();
        save.coins += save.coins;
        StorageService.saveDebounced();
        document.getElementById('btn-double-gold-ad')!.style.display = 'none';
        this.spawnFloatingText('💰 Золото удвоено!', window.innerWidth / 2, window.innerHeight / 2, '#ffd54f', 22);
      }
    });
  }

  showMainMenu(): void {
    const save = StorageService.getSaveData();
    const menuCoins = document.getElementById('menu-coins');
    const menuHighscore = document.getElementById('menu-highscore');
    if (menuCoins) menuCoins.textContent = `${save.coins}`;
    if (menuHighscore) menuHighscore.textContent = `Ночь ${save.highNight}`;

    this.setHudVisible(false);
    this.touchControls.setVisible(false);
    this.hideAllModals();
    this.modalMainMenu?.classList.add('active');

    PlaygamaService.showBanner('bottom');
  }

  showGameplayHud(): void {
    this.hideAllModals();
    this.setHudVisible(true);
    this.touchControls.setVisible(true);
    PlaygamaService.hideBanner();
  }

  showPause(): void {
    this.touchControls.setVisible(false);
    this.modalPause?.classList.add('active');
    eventBus.emit('game:pause', true);
  }

  hidePause(): void {
    this.modalPause?.classList.remove('active');
    this.touchControls.setVisible(true);
  }

  showGameOver(nights: number, kills: number, coins: number, reason: string): void {
    this.touchControls.setVisible(false);
    this.setHudVisible(false);

    const titleEl = document.getElementById('gameover-title');
    const descEl = document.getElementById('gameover-desc');
    const nightsEl = document.getElementById('gameover-nights');
    const killsEl = document.getElementById('gameover-kills');
    const coinsEl = document.getElementById('gameover-coins');
    const reviveBtn = document.getElementById('btn-revive-ad');
    const doubleGoldBtn = document.getElementById('btn-double-gold-ad');

    if (titleEl) titleEl.textContent = 'ВЫ ПОГЛОЩЕНЫ ТЬМОЙ';
    if (descEl) descEl.textContent = reason;
    if (nightsEl) nightsEl.textContent = `${nights}`;
    if (killsEl) killsEl.textContent = `${kills}`;
    if (coinsEl) coinsEl.textContent = `${coins}`;

    if (reviveBtn) reviveBtn.style.display = PlaygamaService.isRewardedSupported ? 'flex' : 'none';
    if (doubleGoldBtn) doubleGoldBtn.style.display = PlaygamaService.isRewardedSupported ? 'flex' : 'none';

    this.hideAllModals();
    this.modalGameOver?.classList.add('active');

    PlaygamaService.armInterstitial('game_over');
    PlaygamaService.showBanner('bottom');
  }

  hideGameOver(): void {
    this.modalGameOver?.classList.remove('active');
    this.showGameplayHud();
  }

  showTalentsModal(): void {
    this.renderTalentsList();
    this.modalTalents?.classList.add('active');
  }

  hideTalentsModal(): void {
    this.modalTalents?.classList.remove('active');
    this.showMainMenu();
  }

  private renderTalentsList(): void {
    const listEl = document.getElementById('talents-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const save = StorageService.getSaveData();

    const talents = [
      {
        id: 'maxHpLevel',
        name: 'Стойкость Знахаря',
        desc: '+20 к максимальному здоровью',
        icon: '❤️',
        level: save.talents.maxHpLevel,
        cost: (save.talents.maxHpLevel + 1) * 20,
      },
      {
        id: 'stealthLevel',
        name: 'Лесная Невидимка',
        desc: '+15% к скорости в скрытности',
        icon: '🌿',
        level: save.talents.stealthLevel,
        cost: (save.talents.stealthLevel + 1) * 25,
      },
      {
        id: 'saltCapacityLevel',
        name: 'Священный Мешочек',
        desc: '+1 к начальному запасу соли',
        icon: '🧂',
        level: save.talents.saltCapacityLevel,
        cost: (save.talents.saltCapacityLevel + 1) * 30,
      },
      {
        id: 'torchDurationLevel',
        name: 'Смоляная Береста',
        desc: '+25% к длительности горения факелов',
        icon: '🔥',
        level: save.talents.torchDurationLevel,
        cost: (save.talents.torchDurationLevel + 1) * 20,
      },
      {
        id: 'bladeDamageLevel',
        name: 'Закалённый Клинок',
        desc: '+6 к урону базовой атаки',
        icon: '🗡️',
        level: save.talents.bladeDamageLevel,
        cost: (save.talents.bladeDamageLevel + 1) * 35,
      },
    ];

    talents.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      row.style.alignItems = 'center';

      const canAfford = save.coins >= t.cost;

      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px;">${t.icon}</span>
          <div style="text-align: left;">
            <div style="font-weight: 800; color: #fff3cd;">${t.name} (Ур. ${t.level})</div>
            <div style="font-size: 11px; color: #aed581;">${t.desc}</div>
          </div>
        </div>
        <button class="btn-primary" style="padding: 6px 14px; font-size: 13px;" ${!canAfford ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
          🪙 ${t.cost}
        </button>
      `;

      const btn = row.querySelector('button');
      if (canAfford && btn) {
        btn.addEventListener('click', () => {
          save.coins -= t.cost;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (save.talents as any)[t.id]++;
          StorageService.saveDebounced();
          this.renderTalentsList();
          this.spawnFloatingText('✨ Улучшение получено!', window.innerWidth / 2, window.innerHeight / 2, '#fff3cd', 18);
        });
      }

      listEl.appendChild(row);
    });
  }

  async showLeaderboardModal(): Promise<void> {
    const listEl = document.getElementById('leaderboard-content');
    if (listEl) {
      listEl.innerHTML = '<div style="color: #9eb692; padding: 12px;">Загрузка рекордов...</div>';
    }
    this.modalLeaderboard?.classList.add('active');

    const entries = await PlaygamaService.getLeaderboardEntries('highestwave');
    if (listEl) {
      listEl.innerHTML = '';
      entries.forEach((e) => {
        const row = document.createElement('div');
        row.className = `leaderboard-row ${e.rank === 1 ? 'me' : ''}`;
        row.innerHTML = `
          <span>#${e.rank} ${e.name}</span>
          <span style="font-weight: 800; color: var(--color-gold);">Ночь ${e.score}</span>
        `;
        listEl.appendChild(row);
      });
    }
  }

  hideLeaderboardModal(): void {
    this.modalLeaderboard?.classList.remove('active');
  }

  private hideAllModals(): void {
    document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.remove('active'));
  }

  private setHudVisible(visible: boolean): void {
    if (this.hudTopEl) this.hudTopEl.style.display = visible ? 'flex' : 'none';
    if (this.hudBottomEl) this.hudBottomEl.style.display = visible ? 'flex' : 'none';
    if (this.stealthIndicatorEl) this.stealthIndicatorEl.style.display = visible ? 'flex' : 'none';
  }

  spawnFloatingText(text: string, x: number, y: number, color = '#ffffff', size = 16): void {
    if (!this.fctContainer) return;
    const el = document.createElement('div');
    el.className = 'fct-item';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color;
    el.style.fontSize = `${size}px`;

    this.fctContainer.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 850);
  }

  setCallbacks(
    onStart: () => void,
    onRestart: () => void,
    onRevive: () => void,
    onQuit: () => void
  ): void {
    this.onStartGameCb = onStart;
    this.onRestartGameCb = onRestart;
    this.onReviveGameCb = onRevive;
    this.onQuitToMenuCb = onQuit;
  }
}
