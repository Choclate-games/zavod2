import { TouchControls } from './TouchControls';
import { PlaygamaService } from '../platform/PlaygamaService';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { UpgradeSystem, UpgradeModule } from '../systems/UpgradeSystem';
import { EventBus } from '../core/EventBus';

export class UIManager {
  private static instance: UIManager;
  readonly touch: TouchControls;

  // DOM Elements - Layers
  private loadingScreen = document.getElementById('loading-screen');
  private loadingBar = document.getElementById('loading-bar');
  private loadingStatus = document.getElementById('loading-status');

  private hudLayer = document.getElementById('hud-layer');
  private garageModal = document.getElementById('garage-modal');
  private upgradeModal = document.getElementById('upgrade-modal');
  private gameoverModal = document.getElementById('gameover-modal');
  private pauseModal = document.getElementById('pause-modal');

  // HUD Elements
  private hpBar = document.getElementById('hp-bar');
  private hpVal = document.getElementById('hp-val');
  private shieldBar = document.getElementById('shield-bar');
  private shieldVal = document.getElementById('shield-val');
  private heatLevelElem = document.getElementById('heat-level');
  private speedDisplay = document.getElementById('speed-display');
  private nitroBar = document.getElementById('nitro-bar');
  private driftMeter = document.getElementById('drift-meter');
  private gearCount = document.getElementById('gear-count');
  private repCount = document.getElementById('rep-count');
  private hudBanner = document.getElementById('hud-banner');

  // Boss HUD
  private bossBar = document.getElementById('boss-bar');
  private bossHpFill = document.getElementById('boss-hp-fill');
  private bossPrompt = document.getElementById('boss-prompt');

  // Upgrade Modal Elements
  private upgradeCardsGrid = document.getElementById('upgrade-cards');
  private btnRerollCards = document.getElementById('btn-reroll-cards');

  // Garage Elements
  private garageGears = document.getElementById('garage-gears');
  private garageRep = document.getElementById('garage-rep');
  private garageRank = document.getElementById('garage-blacklist-rank');
  private statArmorVal = document.getElementById('stat-armor-val');
  private statRamVal = document.getElementById('stat-ram-val');
  private statNitroVal = document.getElementById('stat-nitro-val');
  private statMagnetVal = document.getElementById('stat-magnet-val');

  // Results Screen Elements
  private resTime = document.getElementById('res-time');
  private resCops = document.getElementById('res-cops');
  private resBreakers = document.getElementById('res-breakers');
  private resCost = document.getElementById('res-cost');
  private resGears = document.getElementById('res-gears');
  private resRep = document.getElementById('res-rep');
  private btnRevive = document.getElementById('btn-revive');
  private btnDoubleGold = document.getElementById('btn-double-gold');

  private bannerTimeout: number | null = null;

  static get(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }

  constructor() {
    this.touch = new TouchControls();
    this.bindButtons();
    this.bindEvents();
  }

  private bindButtons(): void {
    // Start Run Button
    document.getElementById('btn-start-run')?.addEventListener('click', () => {
      SoundSynthesizer.get().playButtonClick();
      EventBus.get().emit('ui:start_game');
    });

    // Pause / Resume
    document.getElementById('btn-pause')?.addEventListener('click', () => {
      SoundSynthesizer.get().playButtonClick();
      EventBus.get().emit('ui:toggle_pause');
    });
    document.getElementById('btn-resume')?.addEventListener('click', () => {
      SoundSynthesizer.get().playButtonClick();
      EventBus.get().emit('ui:toggle_pause');
    });
    document.getElementById('btn-quit-run')?.addEventListener('click', () => {
      SoundSynthesizer.get().playButtonClick();
      EventBus.get().emit('ui:return_garage');
    });

    // Return to Garage from Game Over
    document.getElementById('btn-return-garage')?.addEventListener('click', () => {
      SoundSynthesizer.get().playButtonClick();
      PlaygamaService.get().showInterstitial();
      EventBus.get().emit('ui:return_garage');
    });

    // Sound toggle in Pause & Settings
    const toggleSound = () => {
      const synth = SoundSynthesizer.get();
      synth.setMuted(!synth.isMuted);
      SoundSynthesizer.get().playButtonClick();
      const text = synth.isMuted ? 'ВЫКЛ 🔇' : 'ВКЛ 🔊';
      const btnSound = document.getElementById('btn-sound-toggle');
      if (btnSound) btnSound.textContent = text;
      PlaygamaService.get().updateSaveData(s => s.soundEnabled = !synth.isMuted);
    };

    document.getElementById('btn-sound-toggle')?.addEventListener('click', toggleSound);
    document.getElementById('btn-settings-toggle')?.addEventListener('click', toggleSound);

    // Car Selector
    const carBtns = document.querySelectorAll('.car-select-btn');
    carBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        SoundSynthesizer.get().playButtonClick();
        carBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const carIdx = parseInt(btn.getAttribute('data-car') || '0', 10);
        PlaygamaService.get().updateSaveData(s => s.selectedCar = carIdx);
        EventBus.get().emit('ui:car_selected', carIdx);
      });
    });

    // Garage Stat Upgrades
    document.getElementById('btn-up-armor')?.addEventListener('click', () => this.buyGarageStat('armorLevel'));
    document.getElementById('btn-up-ram')?.addEventListener('click', () => this.buyGarageStat('ramLevel'));
    document.getElementById('btn-up-nitro')?.addEventListener('click', () => this.buyGarageStat('nitroLevel'));
    document.getElementById('btn-up-magnet')?.addEventListener('click', () => this.buyGarageStat('magnetLevel'));

    // Rewarded: Reroll Cards
    this.btnRerollCards?.addEventListener('click', async () => {
      SoundSynthesizer.get().playButtonClick();
      const granted = await PlaygamaService.get().showRewarded('free_card_reroll');
      if (granted) {
        EventBus.get().emit('ui:reroll_upgrades');
      }
    });

    // Rewarded: Revive
    this.btnRevive?.addEventListener('click', async () => {
      SoundSynthesizer.get().playButtonClick();
      const granted = await PlaygamaService.get().showRewarded('revive_run');
      if (granted) {
        EventBus.get().emit('ui:revive_player');
      }
    });

    // Rewarded: Double Gold
    this.btnDoubleGold?.addEventListener('click', async () => {
      SoundSynthesizer.get().playButtonClick();
      const granted = await PlaygamaService.get().showRewarded('double_gold_run');
      if (granted) {
        EventBus.get().emit('ui:double_gold');
        if (this.btnDoubleGold) this.btnDoubleGold.style.display = 'none';
      }
    });
  }

  private buyGarageStat(statKey: 'armorLevel' | 'ramLevel' | 'nitroLevel' | 'magnetLevel'): void {
    const save = PlaygamaService.get().getSaveData();
    const curLevel = save.carUpgrades[statKey] || 0;
    const cost = 50 * (curLevel + 1);

    if (save.gears >= cost && curLevel < 10) {
      SoundSynthesizer.get().playButtonClick();
      PlaygamaService.get().updateSaveData(s => {
        s.gears -= cost;
        s.carUpgrades[statKey] = curLevel + 1;
      });
      this.refreshGarageUI();
    }
  }

  private bindEvents(): void {
    EventBus.get().on('boss:spawned', ({ hp, maxHp }) => {
      this.bossBar?.classList.remove('hidden');
      if (this.bossHpFill) this.bossHpFill.style.width = '100%';
    });

    EventBus.get().on('boss:hp_update', ({ hp, maxHp }) => {
      if (this.bossHpFill) {
        const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
        this.bossHpFill.style.width = `${pct}%`;
      }
    });

    EventBus.get().on('boss:staggered', () => {
      this.bossPrompt?.classList.remove('hidden');
      this.showBanner('⚡ БОСС ОГЛУШЕН! ТАРАНЬ С НИТРО! ⚡', 'gold');
    });

    EventBus.get().on('pursuit_breaker:collapsed', () => {
      this.showBanner('PURSUIT BREAKER! 💥', 'gold');
    });

    EventBus.get().on('cop:destroyed', () => {
      this.showBanner('TAKEDOWN! 🚔⚡', 'red');
    });
  }

  showLoadingProgress(percent: number, statusText: string): void {
    if (this.loadingBar) this.loadingBar.style.width = `${percent}%`;
    if (this.loadingStatus) this.loadingStatus.textContent = statusText;
    PlaygamaService.get().setLoadingProgress(percent);
  }

  hideLoadingScreen(): void {
    if (this.loadingScreen) {
      this.loadingScreen.style.opacity = '0';
      this.loadingScreen.style.transition = 'opacity 0.6s ease-out';
      setTimeout(() => {
        this.loadingScreen?.classList.add('hidden');
      }, 650);
    }
  }

  showGarage(): void {
    this.hudLayer?.classList.add('hidden');
    this.upgradeModal?.classList.add('hidden');
    this.gameoverModal?.classList.add('hidden');
    this.pauseModal?.classList.add('hidden');
    this.bossBar?.classList.add('hidden');

    this.garageModal?.classList.remove('hidden');
    this.touch.setVisible(false);
    this.refreshGarageUI();
  }

  showHud(): void {
    this.garageModal?.classList.add('hidden');
    this.upgradeModal?.classList.add('hidden');
    this.gameoverModal?.classList.add('hidden');
    this.pauseModal?.classList.add('hidden');

    this.hudLayer?.classList.remove('hidden');
    this.touch.setVisible(true);
  }

  showPause(): void {
    this.pauseModal?.classList.remove('hidden');
    this.touch.setVisible(false);
  }

  hidePause(): void {
    this.pauseModal?.classList.add('hidden');
    this.touch.setVisible(true);
  }

  showUpgradeModal(choices: UpgradeModule[], onSelect: (modId: string) => void): void {
    if (!this.upgradeCardsGrid) return;
    this.upgradeCardsGrid.innerHTML = '';

    choices.forEach(c => {
      const card = document.createElement('div');
      card.className = `upgrade-card ${c.rarity}`;
      card.innerHTML = `
        <div class="card-tag ${c.rarity}">${c.rarity}</div>
        <div class="card-icon">${c.icon}</div>
        <div class="card-title">${c.name} (Ур.${c.level + 1})</div>
        <div class="card-desc">${c.desc}</div>
      `;
      card.addEventListener('click', () => {
        SoundSynthesizer.get().playButtonClick();
        this.upgradeModal?.classList.add('hidden');
        this.touch.setVisible(true);
        onSelect(c.id);
      });
      this.upgradeCardsGrid?.appendChild(card);
    });

    this.upgradeModal?.classList.remove('hidden');
    this.touch.setVisible(false);
  }

  showGameOver(stats: {
    timeStr: string;
    copsCount: number;
    breakersCount: number;
    costUsd: number;
    gearsEarned: number;
    repEarned: number;
    canRevive: boolean;
    isVictory: boolean;
  }): void {
    this.hudLayer?.classList.add('hidden');
    this.touch.setVisible(false);

    const title = document.getElementById('gameover-title');
    if (title) {
      title.textContent = stats.isVictory ? 'УСПЕШНЫЙ ПРОРЫВ! 🏆' : 'ТРАНСПОРТ УНИЧТОЖЕН';
      title.style.color = stats.isVictory ? 'var(--neon-cyan)' : 'var(--neon-red)';
    }

    if (this.resTime) this.resTime.textContent = stats.timeStr;
    if (this.resCops) this.resCops.textContent = `${stats.copsCount} шт`;
    if (this.resBreakers) this.resBreakers.textContent = `${stats.breakersCount} шт`;
    if (this.resCost) this.resCost.textContent = `$${stats.costUsd.toLocaleString()}`;
    if (this.resGears) this.resGears.textContent = `⚙️ +${stats.gearsEarned}`;
    if (this.resRep) this.resRep.textContent = `⭐ +${stats.repEarned}`;

    const reviveSec = document.getElementById('revive-section');
    if (reviveSec) {
      reviveSec.style.display = stats.canRevive && !stats.isVictory ? 'flex' : 'none';
    }

    if (this.btnDoubleGold) this.btnDoubleGold.style.display = 'flex';

    this.gameoverModal?.classList.remove('hidden');
  }

  updateHud(
    hp: number,
    maxHp: number,
    shield: number,
    maxShield: number,
    speedKmH: number,
    nitroRage: number,
    isNitroReady: boolean,
    slipAngleDeg: number,
    isDrifting: boolean,
    driftMult: number,
    gears: number,
    rep: number,
    heat: number
  ): void {
    if (this.hpBar) this.hpBar.style.width = `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%`;
    if (this.hpVal) this.hpVal.textContent = `${Math.ceil(hp)}/${maxHp}`;

    if (this.shieldBar) this.shieldBar.style.width = `${Math.max(0, Math.min(100, (shield / maxShield) * 100))}%`;
    if (this.shieldVal) this.shieldVal.textContent = `${Math.ceil(shield)}/${maxShield}`;

    if (this.speedDisplay) this.speedDisplay.textContent = `${Math.round(speedKmH)}`;

    if (this.nitroBar) {
      this.nitroBar.style.width = `${Math.max(0, Math.min(100, nitroRage))}%`;
      if (isNitroReady) {
        this.nitroBar.classList.add('ready');
      } else {
        this.nitroBar.classList.remove('ready');
      }
    }

    if (this.driftMeter) {
      if (isDrifting) {
        this.driftMeter.textContent = `DRIFT ${Math.round(slipAngleDeg)}° • x${driftMult.toFixed(1)}`;
      } else {
        this.driftMeter.textContent = '';
      }
    }

    if (this.gearCount) this.gearCount.textContent = `${gears}`;
    if (this.repCount) this.repCount.textContent = `${rep}`;
    if (this.heatLevelElem) this.heatLevelElem.textContent = `HEAT ${heat}`;
  }

  showBanner(text: string, theme: 'normal' | 'gold' | 'red' = 'normal'): void {
    if (!this.hudBanner) return;
    this.hudBanner.textContent = text;
    this.hudBanner.className = `banner-notification show ${theme}`;

    if (this.bannerTimeout !== null) clearTimeout(this.bannerTimeout);
    this.bannerTimeout = window.setTimeout(() => {
      this.hudBanner?.classList.remove('show');
    }, 1800);
  }

  private refreshGarageUI(): void {
    const save = PlaygamaService.get().getSaveData();
    if (this.garageGears) this.garageGears.textContent = `${save.gears}`;
    if (this.garageRep) this.garageRep.textContent = `${save.reputation}`;
    if (this.garageRank) this.garageRank.textContent = `#${save.blacklistRank}`;

    const up = save.carUpgrades;
    if (this.statArmorVal) this.statArmorVal.textContent = `+${up.armorLevel * 10}%`;
    if (this.statRamVal) this.statRamVal.textContent = `+${up.ramLevel * 15}%`;
    if (this.statNitroVal) this.statNitroVal.textContent = `+${up.nitroLevel * 12}%`;
    if (this.statMagnetVal) this.statMagnetVal.textContent = `${(4.5 + up.magnetLevel * 0.8).toFixed(1)}м`;
  }
}
