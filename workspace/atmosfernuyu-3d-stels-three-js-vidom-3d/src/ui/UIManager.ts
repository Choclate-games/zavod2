import * as THREE from 'three';
import { eventBus } from '../core/EventBus';
import { storageService } from '../platform/StorageService';
import { playgamaService } from '../platform/PlaygamaService';
import { audioManager } from '../audio/AudioManager';
import { CardModal } from './CardModal';
import { colonySystem } from '../systems/ColonySystem';
import { telemetry } from '../telemetry/Telemetry';

export class UIManager {
  public cardModal: CardModal;

  // Screens
  private screenMainMenu = document.getElementById('screen-main-menu')!;
  private screenGarage = document.getElementById('screen-garage')!;
  private screenLeaderboard = document.getElementById('screen-leaderboard')!;
  private screenPause = document.getElementById('screen-pause')!;
  private screenGameOver = document.getElementById('screen-game-over')!;
  private screenVictory = document.getElementById('screen-victory')!;
  private touchControls = document.getElementById('touch-controls')!;

  // HUD Elements
  private hpBar = document.getElementById('hp-bar')!;
  private hpVal = document.getElementById('hp-val')!;
  private shieldBar = document.getElementById('shield-bar')!;
  private shieldVal = document.getElementById('shield-val')!;
  private energyBar = document.getElementById('energy-bar')!;
  private energyVal = document.getElementById('energy-val')!;
  private waveBadge = document.getElementById('wave-badge')!;
  private seasonIndicator = document.getElementById('season-indicator')!;
  private stealthEye = document.getElementById('stealth-eye')!;
  private stealthStatus = document.getElementById('stealth-status')!;
  private gearsVal = document.getElementById('gears-val')!;
  private scrollsVal = document.getElementById('scrolls-val')!;
  private bossBarWrap = document.getElementById('boss-bar-wrap')!;
  private bossFill = document.getElementById('boss-fill')!;
  private damageOverlay = document.getElementById('damage-overlay')!;
  private notificationToast = document.getElementById('notification-toast')!;

  private toastTimeout: number | null = null;

  constructor() {
    this.cardModal = new CardModal();
    this.setupListeners();
    this.setupButtons();
    this.updateMenuStats();
  }

  private setupListeners(): void {
    // Player HP & Shield
    eventBus.on('player:hp_changed', ({ current, max, shield, maxShield }: any) => {
      const hpPct = Math.max(0, Math.min(100, (current / max) * 100));
      this.hpBar.style.width = `${hpPct}%`;
      this.hpVal.textContent = `${Math.ceil(current)}/${Math.ceil(max)}`;

      const shieldPct = maxShield > 0 ? Math.max(0, Math.min(100, (shield / maxShield) * 100)) : 0;
      this.shieldBar.style.width = `${shieldPct}%`;
      this.shieldVal.textContent = `${Math.ceil(shield)}/${Math.ceil(maxShield)}`;
    });

    // Energy
    eventBus.on('player:energy_changed', ({ current, max }: any) => {
      const pct = Math.max(0, Math.min(100, (current / max) * 100));
      this.energyBar.style.width = `${pct}%`;
      this.energyVal.textContent = `${Math.ceil(current)}/${Math.ceil(max)}`;
    });

    // Stealth State
    eventBus.on('stealth:changed', ({ isStealthed }: { isStealthed: boolean }) => {
      if (isStealthed) {
        this.stealthEye.classList.remove('alert');
        this.stealthStatus.textContent = 'Скрыт';
        this.stealthStatus.style.color = '#aed581';
      } else {
        this.stealthEye.classList.add('alert');
        this.stealthStatus.textContent = 'Замечен / Шум';
        this.stealthStatus.style.color = '#ff8a80';
      }
    });

    // Wave start
    eventBus.on('wave:started', ({ wave, seasonName }: any) => {
      this.waveBadge.textContent = `ВОЛНА ${wave} / 10`;
      this.seasonIndicator.textContent = seasonName;
      this.showToast(`🔔 Начинается ${seasonName} (Волна ${wave})!`);
    });

    // Boss Bar
    eventBus.on('boss:spawned', ({ hp, maxHp }: any) => {
      this.bossBarWrap.classList.remove('hidden');
      const pct = (hp / maxHp) * 100;
      this.bossFill.style.width = `${pct}%`;
      this.showToast('⚠️ ПОЯВИЛСЯ ДРЕВНИЙ СТРАЖ БИБЛИОТЕКИ!');
    });

    eventBus.on('boss:hp_changed', ({ hp, maxHp }: any) => {
      const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
      this.bossFill.style.width = `${pct}%`;
    });

    eventBus.on('boss:defeated', () => {
      this.bossBarWrap.classList.add('hidden');
    });

    // Damage Popup Overlay
    eventBus.on('ui:damage_popup', ({ position, damage, isCritical }: any) => {
      this.spawnDamagePopup(position, damage, isCritical);
    });
  }

  private setupButtons(): void {
    // Menu Buttons
    document.getElementById('btn-open-garage')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.showGarage();
    });

    document.getElementById('btn-close-garage')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.screenGarage.classList.add('hidden');
      this.screenMainMenu.classList.remove('hidden');
      this.updateMenuStats();
    });

    document.getElementById('btn-open-leaderboard')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.screenLeaderboard.classList.remove('hidden');
    });

    document.getElementById('btn-close-leaderboard')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      this.screenLeaderboard.classList.add('hidden');
    });

    // Sound Toggles
    const updateSoundBtnText = (btnId: string) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.textContent = audioManager.isMuted ? '🔇 ЗВУК: ВЫКЛ' : '🔊 ЗВУК: ВКЛ';
      }
    };

    document.getElementById('btn-toggle-sound')?.addEventListener('click', () => {
      audioManager.toggleMute();
      updateSoundBtnText('btn-toggle-sound');
      updateSoundBtnText('btn-pause-sound');
    });

    document.getElementById('btn-pause-sound')?.addEventListener('click', () => {
      audioManager.toggleMute();
      updateSoundBtnText('btn-toggle-sound');
      updateSoundBtnText('btn-pause-sound');
    });

    // In-game Pause button
    document.getElementById('btn-pause')?.addEventListener('click', () => {
      audioManager.playButtonClick();
      eventBus.emit('game:request_pause', {});
    });
  }

  setTouchControlsVisible(visible: boolean): void {
    if (visible) {
      this.touchControls.classList.remove('hidden');
    } else {
      this.touchControls.classList.add('hidden');
    }
  }

  updateHUDResources(gears: number, scrolls: number): void {
    this.gearsVal.textContent = `${gears}`;
    this.scrollsVal.textContent = `${scrolls}`;
  }

  updateMenuStats(): void {
    const data = storageService.getData();
    const highWave = document.getElementById('menu-high-wave');
    const highScore = document.getElementById('menu-high-score');
    if (highWave) highWave.textContent = `${data.highestWave}`;
    if (highScore) highScore.textContent = `${data.highScore}`;
  }

  showMainMenu(): void {
    this.hideAllModals();
    this.bossBarWrap.classList.add('hidden');
    this.setTouchControlsVisible(false);
    this.screenMainMenu.classList.remove('hidden');
    this.updateMenuStats();
    playgamaService.showBanner();
  }

  hideMainMenu(): void {
    this.screenMainMenu.classList.add('hidden');
    playgamaService.hideBanner();
  }

  showPauseModal(): void {
    this.setTouchControlsVisible(false);
    this.screenPause.classList.remove('hidden');
  }

  hidePauseModal(): void {
    this.screenPause.classList.add('hidden');
    this.setTouchControlsVisible(true);
  }

  showGameOver(wave: number, gears: number, score: number, onRevive: () => void, onDoubleGears: () => void, onRestart: () => void, onMenu: () => void): void {
    this.hideAllModals();
    this.setTouchControlsVisible(false);
    this.screenGameOver.classList.remove('hidden');

    document.getElementById('over-wave-val')!.textContent = `${wave}`;
    document.getElementById('over-gears-val')!.textContent = `${gears} ⚙️`;
    document.getElementById('over-score-val')!.textContent = `${score}`;

    const reviveBtn = document.getElementById('btn-revive-ad')!;
    const doubleBtn = document.getElementById('btn-double-gold-ad')!;
    const restartBtn = document.getElementById('btn-restart-game')!;
    const menuBtn = document.getElementById('btn-over-to-menu')!;

    // Rewarded Revive
    reviveBtn.onclick = async () => {
      audioManager.playButtonClick();
      const success = await playgamaService.showRewarded('revive_run');
      if (success) {
        telemetry.track('revive_used');
        this.screenGameOver.classList.add('hidden');
        this.setTouchControlsVisible(true);
        onRevive();
      }
    };

    // Rewarded 2x Gold
    doubleBtn.onclick = async () => {
      audioManager.playButtonClick();
      const success = await playgamaService.showRewarded('double_gold_run');
      if (success) {
        onDoubleGears();
        doubleBtn.style.display = 'none';
        this.showToast('💰 Добыча успешно удвоена 2X!');
      }
    };

    restartBtn.onclick = () => {
      audioManager.playButtonClick();
      this.screenGameOver.classList.add('hidden');
      onRestart();
    };

    menuBtn.onclick = () => {
      audioManager.playButtonClick();
      this.screenGameOver.classList.add('hidden');
      onMenu();
    };
  }

  showVictory(score: number, scrolls: number, onDoubleGears: () => void, onRestart: () => void, onMenu: () => void): void {
    this.hideAllModals();
    this.setTouchControlsVisible(false);
    this.screenVictory.classList.remove('hidden');

    document.getElementById('vic-score-val')!.textContent = `${score}`;
    document.getElementById('vic-scrolls-val')!.textContent = `${scrolls} 📜`;

    const doubleBtn = document.getElementById('btn-vic-double-ad')!;
    const restartBtn = document.getElementById('btn-vic-restart')!;
    const menuBtn = document.getElementById('btn-vic-menu')!;

    doubleBtn.onclick = async () => {
      audioManager.playButtonClick();
      const success = await playgamaService.showRewarded('double_gold_run');
      if (success) {
        onDoubleGears();
        doubleBtn.style.display = 'none';
        this.showToast('💰 Награды удвоены 2X!');
      }
    };

    restartBtn.onclick = () => {
      audioManager.playButtonClick();
      this.screenVictory.classList.add('hidden');
      onRestart();
    };

    menuBtn.onclick = () => {
      audioManager.playButtonClick();
      this.screenVictory.classList.add('hidden');
      onMenu();
    };
  }

  showGarage(): void {
    this.screenMainMenu.classList.add('hidden');
    this.screenGarage.classList.remove('hidden');
    this.renderGaragePerks();
  }

  private renderGaragePerks(): void {
    const container = document.getElementById('perks-container')!;
    const data = storageService.getData();
    document.getElementById('garage-gears')!.textContent = `${data.gears}`;
    container.innerHTML = '';

    const perks = colonySystem.getPerks();
    perks.forEach((perk) => {
      const row = document.createElement('div');
      row.className = 'perk-row';

      const costGears = perk.costGears * (perk.level + 1);
      const costScrolls = perk.costScrolls;
      const isMax = perk.level >= perk.maxLevel;
      const canAfford = data.gears >= costGears && data.scrolls >= costScrolls;

      row.innerHTML = `
        <div class="perk-info">
          <span class="perk-name">${perk.name}</span>
          <span class="perk-level">Уровень ${perk.level}/${perk.maxLevel} — ${perk.desc}</span>
        </div>
        <button class="btn btn-primary" style="font-size: 12px; padding: 6px 14px;" ${isMax || !canAfford ? 'disabled' : ''}>
          ${isMax ? 'МАКС' : `Улучшить (${costGears} ⚙️ ${costScrolls > 0 ? costScrolls + ' 📜' : ''})`}
        </button>
      `;

      const btn = row.querySelector('button')!;
      if (!isMax && canAfford) {
        btn.addEventListener('click', () => {
          audioManager.playButtonClick();
          const upgraded = colonySystem.upgradePerk(perk.id);
          if (upgraded) {
            this.renderGaragePerks();
          }
        });
      }

      container.appendChild(row);
    });
  }

  hideAllModals(): void {
    this.screenMainMenu.classList.add('hidden');
    this.screenGarage.classList.add('hidden');
    this.screenLeaderboard.classList.add('hidden');
    this.screenPause.classList.add('hidden');
    this.screenGameOver.classList.add('hidden');
    this.screenVictory.classList.add('hidden');
    this.cardModal.hide();
  }

  showToast(message: string): void {
    if (this.toastTimeout !== null) {
      clearTimeout(this.toastTimeout);
    }
    this.notificationToast.textContent = message;
    this.notificationToast.classList.add('show');
    this.toastTimeout = window.setTimeout(() => {
      this.notificationToast.classList.remove('show');
    }, 2800);
  }

  spawnDamagePopup(pos: THREE.Vector3, damage: number, isCritical = false): void {
    // Project 3D position to 2D screen coordinates
    const el = document.createElement('div');
    el.className = 'damage-popup';
    el.textContent = isCritical ? `💥 ${damage}!` : `${damage}`;
    el.style.color = isCritical ? '#ff1744' : '#fff';
    if (isCritical) el.style.fontSize = '26px';

    // Simple screen projection
    const screenX = window.innerWidth / 2 + (pos.x * 20);
    const screenY = window.innerHeight / 2 - (pos.z * 10);

    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;

    this.damageOverlay.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 800);
  }
}
