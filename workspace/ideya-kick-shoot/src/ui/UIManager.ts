import { Player, KickState } from '../entities/Player';
import { CombatSystem } from '../systems/CombatSystem';
import { WaveManager } from '../systems/WaveManager';
import { UpgradeManager } from '../systems/UpgradeManager';
import { UpgradeCard, GameState, WeaponType } from '../core/Types';
import { StorageService } from '../platform/StorageService';
import { PlaygamaService } from '../platform/PlaygamaService';
import { AudioManager } from '../audio/AudioManager';
import { TouchControls } from './TouchControls';
import { EventBus } from '../core/EventBus';

export class UIManager {
  private player: Player;
  private combatSystem: CombatSystem;
  private waveManager: WaveManager;
  private upgradeManager: UpgradeManager;
  private touchControls: TouchControls;
  private playgamaService: PlaygamaService;
  private audioManager: AudioManager;
  private eventBus: EventBus;

  // DOM Elements
  private hud: HTMLElement | null = null;
  private menuScreen: HTMLElement | null = null;
  private upgradeScreen: HTMLElement | null = null;
  private workshopScreen: HTMLElement | null = null;
  private resultScreen: HTMLElement | null = null;
  private breachOverlay: HTMLElement | null = null;
  private crosshair: HTMLElement | null = null;
  private floatingTextsContainer: HTMLElement | null = null;

  // HUD Elements
  private hudHp: HTMLElement | null = null;
  private hudEnergy: HTMLElement | null = null;
  private hudSector: HTMLElement | null = null;
  private hudComboRank: HTMLElement | null = null;
  private hudScore: HTMLElement | null = null;
  private hudPlasma: HTMLElement | null = null;
  private hudWeaponName: HTMLElement | null = null;
  private hudAmmo: HTMLElement | null = null;

  private onStartRunCallback: () => void = () => {};
  private onReviveCallback: () => void = () => {};
  private onContinueCallback: () => void = () => {};

  constructor(
    player: Player,
    combatSystem: CombatSystem,
    waveManager: WaveManager,
    upgradeManager: UpgradeManager,
    touchControls: TouchControls
  ) {
    this.player = player;
    this.combatSystem = combatSystem;
    this.waveManager = waveManager;
    this.upgradeManager = upgradeManager;
    this.touchControls = touchControls;
    this.playgamaService = PlaygamaService.getInstance();
    this.audioManager = AudioManager.getInstance();
    this.eventBus = EventBus.getInstance();

    this.cacheDom();
    this.bindButtons();
    this.setupEventSubscriptions();
  }

  private cacheDom(): void {
    this.hud = document.getElementById('hud');
    this.menuScreen = document.getElementById('menu-screen');
    this.upgradeScreen = document.getElementById('upgrade-screen');
    this.workshopScreen = document.getElementById('workshop-screen');
    this.resultScreen = document.getElementById('result-screen');
    this.breachOverlay = document.getElementById('breach-overlay');
    this.crosshair = document.getElementById('crosshair');
    this.floatingTextsContainer = document.getElementById('floating-texts');

    this.hudHp = document.getElementById('hud-hp');
    this.hudEnergy = document.getElementById('hud-energy');
    this.hudSector = document.getElementById('hud-sector');
    this.hudComboRank = document.getElementById('hud-combo-rank');
    this.hudScore = document.getElementById('hud-score');
    this.hudPlasma = document.getElementById('hud-plasma');
    this.hudWeaponName = document.getElementById('hud-weapon-name');
    this.hudAmmo = document.getElementById('hud-ammo');
  }

  private bindButtons(): void {
    // Menu Buttons
    document.getElementById('btn-start')?.addEventListener('click', () => {
      this.audioManager.playPickup();
      this.onStartRunCallback();
    });

    document.getElementById('btn-workshop')?.addEventListener('click', () => {
      this.audioManager.playPickup();
      this.showWorkshop();
    });

    document.getElementById('btn-close-workshop')?.addEventListener('click', () => {
      this.audioManager.playPickup();
      this.showMenu();
    });

    const muteBtn = document.getElementById('btn-mute');
    muteBtn?.addEventListener('click', () => {
      const isMuted = !this.audioManager.isMuted();
      this.audioManager.setPlayerMuted(isMuted);
      muteBtn.innerText = isMuted ? '🔇 ЗВУК: ВЫКЛ' : '🔊 ЗВУК: ВКЛ';
    });

    const touchBtn = document.getElementById('btn-touch-toggle');
    touchBtn?.addEventListener('click', () => {
      const active = this.touchControls.toggleTouchMode();
      touchBtn.innerText = active ? '📱 ТАЧ: ВКЛ' : '💻 ТАЧ: ВЫКЛ';
    });

    // 3-Card Reroll Rewarded
    document.getElementById('btn-reroll-cards')?.addEventListener('click', async () => {
      const rewarded = await this.playgamaService.showRewarded('free_card_reroll');
      if (rewarded) {
        this.renderUpgradeCards(true);
      }
    });

    // Result Buttons
    document.getElementById('btn-revive')?.addEventListener('click', async () => {
      const rewarded = await this.playgamaService.showRewarded('revive_run');
      if (rewarded) {
        this.onReviveCallback();
      }
    });

    document.getElementById('btn-double-reward')?.addEventListener('click', async () => {
      const rewarded = await this.playgamaService.showRewarded('double_gold_run');
      if (rewarded) {
        const data = StorageService.getInstance().getData();
        const earned = this.combatSystem.comboScore / 10;
        data.bioplasma += Math.round(earned);
        StorageService.getInstance().save();
        document.getElementById('btn-double-reward')!.style.display = 'none';
        this.renderResultScreen(this.waveManager.currentSector >= this.waveManager.maxSectors, true);
      }
    });

    document.getElementById('btn-result-continue')?.addEventListener('click', () => {
      this.playgamaService.showInterstitial('run_end');
      this.onContinueCallback();
    });
  }

  private setupEventSubscriptions(): void {
    this.eventBus.on('game:slowmo', (data: { scale: number; duration: number }) => {
      if (this.breachOverlay) {
        this.breachOverlay.classList.add('active');
        setTimeout(() => {
          this.breachOverlay?.classList.remove('active');
        }, data.duration * 1000);
      }
    });
  }

  public setCallbacks(callbacks: { onStartRun: () => void; onRevive: () => void; onContinue: () => void }): void {
    this.onStartRunCallback = callbacks.onStartRun;
    this.onReviveCallback = callbacks.onRevive;
    this.onContinueCallback = callbacks.onContinue;
  }

  public showMenu(): void {
    this.hideAllModals();
    this.menuScreen?.classList.remove('hidden');
    this.hud?.classList.add('hidden');
    this.touchControls.setVisible(false);

    const data = StorageService.getInstance().getData();
    const highscoreElem = document.getElementById('menu-highscore');
    if (highscoreElem) {
      highscoreElem.innerText = `РЕКОРД: ${data.highScore} ОЧКОВ | 🧪 ${data.bioplasma} БИО-ПЛАЗМЫ`;
    }
  }

  public showHud(): void {
    this.hideAllModals();
    this.hud?.classList.remove('hidden');
    this.touchControls.setVisible(true);
  }

  public showUpgradeModal(): void {
    this.upgradeScreen?.classList.remove('hidden');
    this.touchControls.setVisible(false);
    this.renderUpgradeCards();
  }

  private renderUpgradeCards(isReroll: boolean = false): void {
    const container = document.getElementById('upgrade-cards-container');
    if (!container) return;
    container.innerHTML = '';

    const cards = this.upgradeManager.generateThreeCardChoices(isReroll);
    cards.forEach((card) => {
      const cardEl = document.createElement('div');
      cardEl.className = `upgrade-card ${card.rarity === 'rare' ? 'card-rare' : card.rarity === 'epic' ? 'card-epic' : ''}`;
      cardEl.innerHTML = `
        <div class="card-icon">${card.icon}</div>
        <div class="card-title">${card.title}</div>
        <div class="card-desc">${card.description}</div>
        <div class="card-rarity">${card.rarity.toUpperCase()}</div>
      `;

      cardEl.addEventListener('click', () => {
        this.audioManager.playPickup();
        card.apply();
        this.upgradeScreen?.classList.add('hidden');
        this.eventBus.emit('game:upgradeSelected');
      });

      container.appendChild(cardEl);
    });
  }

  public showWorkshop(): void {
    this.hideAllModals();
    this.workshopScreen?.classList.remove('hidden');

    const data = StorageService.getInstance().getData();
    const wallet = document.getElementById('workshop-wallet');
    if (wallet) wallet.innerText = `🧪 БИО-ПЛАЗМА: ${data.bioplasma}`;

    const container = document.getElementById('workshop-items-container');
    if (!container) return;
    container.innerHTML = '';

    for (const meta of this.upgradeManager.metaUpgrades) {
      const cost = Math.round(meta.baseCost * Math.pow(meta.costMultiplier, meta.level));
      const isMax = meta.level >= meta.maxLevel;

      const item = document.createElement('div');
      item.className = 'workshop-item';
      item.innerHTML = `
        <div class="workshop-info">
          <div class="workshop-title">${meta.name} [УР. ${meta.level}/${meta.maxLevel}]</div>
          <div class="workshop-level">${meta.description}</div>
        </div>
        <div>
          ${
            isMax
              ? `<button class="btn btn-small" disabled style="opacity: 0.5;">МАКС</button>`
              : `<button class="btn btn-gold btn-small" id="btn-buy-${meta.id}">🧪 ${cost}</button>`
          }
        </div>
      `;

      container.appendChild(item);

      if (!isMax) {
        item.querySelector(`#btn-buy-${meta.id}`)?.addEventListener('click', () => {
          const success = this.upgradeManager.purchaseMetaUpgrade(meta.id);
          if (success) {
            this.audioManager.playPickup();
            this.showWorkshop();
          }
        });
      }
    }
  }

  public showResultScreen(isVictory: boolean): void {
    this.hideAllModals();
    this.resultScreen?.classList.remove('hidden');
    this.touchControls.setVisible(false);
    this.renderResultScreen(isVictory, false);
  }

  private renderResultScreen(isVictory: boolean, isDoubled: boolean): void {
    const title = document.getElementById('result-title');
    if (title) {
      title.innerText = isVictory ? '🏆 СЕКТОР ПОЛНОСТЬЮ ЗАЧИЩЕН!' : '💀 ЭКЗОСКЕЛЕТ ПОВРЕЖДЕН';
    }

    const stats = document.getElementById('result-stats');
    const earnedPlasma = Math.round(this.combatSystem.comboScore / 12) + (isVictory ? 50 : 10);
    const finalPlasma = isDoubled ? earnedPlasma * 2 : earnedPlasma;

    if (stats) {
      stats.innerHTML = `
        <div>⚔️ <b>ОТСЕКОВ ПРОЙДЕНО:</b> ${this.waveManager.currentSector} / ${this.waveManager.maxSectors}</div>
        <div>🎯 <b>ОБЩИЙ СЧЕТ:</b> ${this.combatSystem.comboScore}</div>
        <div>🦵 <b>УНИЧТОЖЕНО ВРАГОВ:</b> ${this.combatSystem.totalKills}</div>
        <div>🚀 <b>ВОЗДУШНЫХ SKEET-КРИТОВ:</b> ${this.combatSystem.skeetKills}</div>
        <div>🚪 <b>ВЫБИТО БРОНЕДВЕРЕЙ:</b> ${this.combatSystem.doorsBreached}</div>
        <div>💥 <b>ВЗОРВАНО БОЧЕК:</b> ${this.combatSystem.barrelsExploded}</div>
        <div style="color: var(--neon-yellow); margin-top: 8px;">🧪 <b>ДОБЫТО БИО-ПЛАЗМЫ:</b> +${finalPlasma}</div>
      `;
    }

    const btnRevive = document.getElementById('btn-revive');
    if (btnRevive) {
      btnRevive.style.display = !isVictory && this.playgamaService.isRewardedSupported() ? 'inline-flex' : 'none';
    }

    const btnDouble = document.getElementById('btn-double-reward');
    if (btnDouble) {
      btnDouble.style.display = !isDoubled && this.playgamaService.isRewardedSupported() ? 'inline-flex' : 'none';
    }
  }

  private hideAllModals(): void {
    this.menuScreen?.classList.add('hidden');
    this.upgradeScreen?.classList.add('hidden');
    this.workshopScreen?.classList.add('hidden');
    this.resultScreen?.classList.add('hidden');
  }

  public updateHud(): void {
    // Health & Energy
    if (this.hudHp) {
      const hpPct = Math.max(0, Math.min(100, (this.player.hp / this.player.maxHp) * 100));
      this.hudHp.style.width = `${hpPct}%`;
    }

    if (this.hudEnergy) {
      const energyPct = Math.max(0, Math.min(100, (this.player.energy / this.player.maxEnergy) * 100));
      this.hudEnergy.style.width = `${energyPct}%`;
    }

    if (this.hudSector) {
      this.hudSector.innerText = `ОТСЕК ${this.waveManager.currentSector.toString().padStart(2, '0')} / ${this.waveManager.maxSectors}`;
    }

    if (this.hudComboRank) {
      this.hudComboRank.innerText = this.combatSystem.comboRank;
    }

    if (this.hudScore) {
      this.hudScore.innerText = `СЧЕТ: ${this.combatSystem.comboScore}`;
    }

    const data = StorageService.getInstance().getData();
    if (this.hudPlasma) {
      this.hudPlasma.innerText = `🧪 ${data.bioplasma} БИО-ПЛАЗМА`;
    }

    if (this.hudWeaponName) {
      this.hudWeaponName.innerText = this.player.currentWeapon.stats.name;
    }

    if (this.hudAmmo) {
      if (this.player.currentWeapon.stats.type === WeaponType.PISTOL) {
        this.hudAmmo.innerText = `${this.player.currentWeapon.currentAmmo} / ∞`;
      } else {
        this.hudAmmo.innerText = `${this.player.currentWeapon.currentAmmo} / ${this.player.currentWeapon.stats.maxAmmo}`;
      }
    }

    // Crosshair dynamic lockon state
    if (this.crosshair) {
      if (this.player.kickState === KickState.WINDUP || this.player.kickState === KickState.ACTIVE_HITBOX) {
        this.crosshair.classList.add('kick-target-active');
      } else {
        this.crosshair.classList.remove('kick-target-active');
      }
    }

    // Floating text DOM sync
    this.updateFloatingTexts();
  }

  private updateFloatingTexts(): void {
    if (!this.floatingTextsContainer) return;

    if (this.combatSystem.floatingTexts.length > 0) {
      const txt = this.combatSystem.floatingTexts.shift();
      if (txt) {
        const el = document.createElement('div');
        el.className = `float-text ${txt.style === 'crit' ? 'float-crit' : txt.style === 'skeet' ? 'float-skeet' : txt.style === 'domino' ? 'float-domino' : ''}`;
        el.innerText = txt.text;
        el.style.left = '50%';
        el.style.top = '45%';
        this.floatingTextsContainer.appendChild(el);

        setTimeout(() => {
          el.remove();
        }, 800);
      }
    }
  }
}
