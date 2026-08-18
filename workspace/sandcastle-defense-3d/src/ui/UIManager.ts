import { Localization } from '../platform/Localization.ts';
import { SaveService } from '../platform/SaveService.ts';
import { UpgradeManager, TALENTS_CONFIG } from '../game/systems/UpgradeManager.ts';
import { LEVELS } from '../game/systems/LevelsData.ts';
import { Tower, TOWER_CONFIGS, TowerType } from '../game/entities/Tower.ts';
import { BridgeService } from '../platform/BridgeService.ts';
import { audio } from '../audio/AudioManager.ts';
import { events } from '../core/EventBus.ts';

export class UIManager {
  // DOM Elements
  private loadingScreen: HTMLElement;
  private loadingProgressBar: HTMLElement;
  private loadingStatusText: HTMLElement;

  private castleHpText: HTMLElement;
  private castleHpBar: HTMLElement;
  private waveText: HTMLElement;
  private shellsText: HTMLElement;
  private pearlsText: HTMLElement;
  private speedBtn: HTMLElement;
  private flowToggleBtn: HTMLElement;
  private pauseBtn: HTMLElement;

  private cardCannon: HTMLElement;
  private cardSplasher: HTMLElement;
  private cardWall: HTMLElement;
  private startWaveBtn: HTMLElement;
  private tsunamiBtn: HTMLElement;

  private towerInspector: HTMLElement;
  private inspectorName: HTMLElement;
  private inspectorStats: HTMLElement;
  private inspectorUpgradeBtn: HTMLElement;
  private inspectorUpgradeCost: HTMLElement;
  private inspectorSellBtn: HTMLElement;
  private inspectorSellRefund: HTMLElement;
  private inspectorCloseBtn: HTMLElement;

  private toastContainer: HTMLElement;

  // Modals
  private mainMenuModal: HTMLElement;
  private levelSelectModal: HTMLElement;
  private levelListContainer: HTMLElement;
  private workshopModal: HTMLElement;
  private workshopPearls: HTMLElement;
  private talentsGrid: HTMLElement;
  private victoryModal: HTMLElement;
  private victoryStars: HTMLElement;
  private victoryPearls: HTMLElement;
  private victoryDoubleBtn: HTMLElement;
  private defeatModal: HTMLElement;
  private defeatReviveBtn: HTMLElement;
  private pauseModal: HTMLElement;
  private settingsModal: HTMLElement;
  private settingSfx: HTMLInputElement;
  private settingBgm: HTMLInputElement;
  private settingLang: HTMLSelectElement;

  private inspectedTower: Tower | null = null;
  public selectedBuildTool: TowerType | null = 'cannon';

  constructor() {
    // Cache DOM
    this.loadingScreen = document.getElementById('loading-screen')!;
    this.loadingProgressBar = document.getElementById('loading-progress-bar')!;
    this.loadingStatusText = document.getElementById('loading-status-text')!;

    this.castleHpText = document.getElementById('castle-hp-text')!;
    this.castleHpBar = document.getElementById('castle-hp-bar')!;
    this.waveText = document.getElementById('wave-text')!;
    this.shellsText = document.getElementById('shells-text')!;
    this.pearlsText = document.getElementById('pearls-text')!;
    this.speedBtn = document.getElementById('speed-btn')!;
    this.flowToggleBtn = document.getElementById('flow-toggle-btn')!;
    this.pauseBtn = document.getElementById('pause-btn')!;

    this.cardCannon = document.getElementById('card-cannon')!;
    this.cardSplasher = document.getElementById('card-splasher')!;
    this.cardWall = document.getElementById('card-wall')!;
    this.startWaveBtn = document.getElementById('start-wave-btn')!;
    this.tsunamiBtn = document.getElementById('tsunami-btn')!;

    this.towerInspector = document.getElementById('tower-inspector')!;
    this.inspectorName = document.getElementById('inspector-name')!;
    this.inspectorStats = document.getElementById('inspector-stats')!;
    this.inspectorUpgradeBtn = document.getElementById('inspector-upgrade-btn')!;
    this.inspectorUpgradeCost = document.getElementById('inspector-upgrade-cost')!;
    this.inspectorSellBtn = document.getElementById('inspector-sell-btn')!;
    this.inspectorSellRefund = document.getElementById('inspector-sell-refund')!;
    this.inspectorCloseBtn = document.getElementById('inspector-close')!;

    this.toastContainer = document.getElementById('toast-container')!;

    this.mainMenuModal = document.getElementById('main-menu-modal')!;
    this.levelSelectModal = document.getElementById('level-select-modal')!;
    this.levelListContainer = document.getElementById('level-list-container')!;
    this.workshopModal = document.getElementById('workshop-modal')!;
    this.workshopPearls = document.getElementById('workshop-pearls')!;
    this.talentsGrid = document.getElementById('talents-grid')!;
    this.victoryModal = document.getElementById('victory-modal')!;
    this.victoryStars = document.getElementById('victory-stars')!;
    this.victoryPearls = document.getElementById('victory-pearls')!;
    this.victoryDoubleBtn = document.getElementById('victory-double-btn')!;
    this.defeatModal = document.getElementById('defeat-modal')!;
    this.defeatReviveBtn = document.getElementById('defeat-revive-btn')!;
    this.pauseModal = document.getElementById('pause-modal')!;
    this.settingsModal = document.getElementById('settings-modal')!;
    this.settingSfx = document.getElementById('setting-sfx') as HTMLInputElement;
    this.settingBgm = document.getElementById('setting-bgm') as HTMLInputElement;
    this.settingLang = document.getElementById('setting-lang') as HTMLSelectElement;

    this.bindEvents();
  }

  public setLoadingProgress(percent: number, status: string): void {
    const p = Math.max(0, Math.min(100, percent));
    this.loadingProgressBar.style.width = `${p}%`;
    this.loadingStatusText.textContent = `${status} ${Math.round(p)}%`;
  }

  public hideLoadingScreen(): void {
    this.loadingScreen.classList.add('hidden');
    setTimeout(() => {
      this.loadingScreen.style.display = 'none';
    }, 550);
  }

  private bindEvents(): void {
    // Tool Selection Cards
    this.cardCannon.addEventListener('click', () => this.selectBuildTool('cannon'));
    this.cardSplasher.addEventListener('click', () => this.selectBuildTool('splasher'));
    this.cardWall.addEventListener('click', () => this.selectBuildTool('wall'));

    // Start Wave Button
    this.startWaveBtn.addEventListener('click', () => {
      audio.playClick();
      events.emit('ui:start_wave_clicked');
    });

    // Speed Toggle
    this.speedBtn.addEventListener('click', () => {
      audio.playClick();
      events.emit('input:toggle_speed');
    });

    // Flow Toggle
    this.flowToggleBtn.addEventListener('click', () => {
      audio.playClick();
      events.emit('ui:toggle_flow');
    });

    // Pause Button
    this.pauseBtn.addEventListener('click', () => {
      audio.playClick();
      this.showPauseModal();
    });

    // Tsunami Button
    this.tsunamiBtn.addEventListener('click', () => {
      audio.playClick();
      events.emit('ui:tsunami_clicked');
    });

    // Tower Inspector Actions
    this.inspectorCloseBtn.addEventListener('click', () => this.hideTowerInspector());
    this.inspectorUpgradeBtn.addEventListener('click', () => {
      if (this.inspectedTower) {
        audio.playClick();
        events.emit('ui:upgrade_tower', this.inspectedTower);
      }
    });
    this.inspectorSellBtn.addEventListener('click', () => {
      if (this.inspectedTower) {
        audio.playClick();
        events.emit('ui:sell_tower', this.inspectedTower);
        this.hideTowerInspector();
      }
    });

    // Main Menu Buttons
    document.getElementById('menu-play-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.hideAllModals();
      this.showLevelSelectModal();
    });
    document.getElementById('menu-workshop-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.showWorkshopModal();
    });
    document.getElementById('menu-settings-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.showSettingsModal();
    });

    // Level Select Back
    document.getElementById('level-select-back-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.hideAllModals();
      this.showMainMenu();
    });

    // Workshop Close
    document.getElementById('workshop-close-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.hideAllModals();
      this.showMainMenu();
    });

    // Victory Buttons
    document.getElementById('victory-double-btn')?.addEventListener('click', () => {
      audio.playClick();
      events.emit('ui:victory_double_reward');
    });
    document.getElementById('victory-next-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.hideAllModals();
      events.emit('ui:next_level_clicked');
    });
    document.getElementById('victory-menu-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.hideAllModals();
      this.showMainMenu();
      events.emit('ui:return_to_menu');
    });

    // Defeat Buttons
    document.getElementById('defeat-revive-btn')?.addEventListener('click', () => {
      audio.playClick();
      events.emit('ui:defeat_revive_clicked');
    });
    document.getElementById('defeat-retry-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.hideAllModals();
      events.emit('ui:restart_level');
    });
    document.getElementById('defeat-menu-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.hideAllModals();
      this.showMainMenu();
      events.emit('ui:return_to_menu');
    });

    // Pause Buttons
    document.getElementById('pause-resume-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.hideAllModals();
      events.emit('ui:resume_game');
    });
    document.getElementById('pause-restart-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.hideAllModals();
      events.emit('ui:restart_level');
    });
    document.getElementById('pause-settings-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.showSettingsModal();
    });
    document.getElementById('pause-menu-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.hideAllModals();
      this.showMainMenu();
      events.emit('ui:return_to_menu');
    });

    // Settings Controls
    this.settingSfx.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      audio.setPlayerSfxMuted(!enabled);
      const save = SaveService.get();
      save.settings.sfxEnabled = enabled;
      SaveService.saveDebounced();
    });

    this.settingBgm.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      audio.setPlayerBgmMuted(!enabled);
      const save = SaveService.get();
      save.settings.bgmEnabled = enabled;
      SaveService.saveDebounced();
    });

    this.settingLang.addEventListener('change', (e) => {
      const lang = (e.target as HTMLSelectElement).value;
      Localization.setLanguage(lang);
      const save = SaveService.get();
      save.settings.language = lang;
      SaveService.saveDebounced();
      this.refreshTexts();
    });

    document.getElementById('settings-close-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.settingsModal.style.display = 'none';
    });
  }

  public selectBuildTool(type: TowerType | null): void {
    this.selectedBuildTool = type;
    this.hideTowerInspector();

    this.cardCannon.classList.toggle('selected', type === 'cannon');
    this.cardSplasher.classList.toggle('selected', type === 'splasher');
    this.cardWall.classList.toggle('selected', type === 'wall');

    audio.playClick();
    events.emit('ui:build_tool_changed', type);
  }

  public updateHud(castleHp: number, maxCastleHp: number, waveNum: number, totalWaves: number, shells: number, pearls: number, isWaveActive: boolean, speedScale: number): void {
    const hpRatio = Math.max(0, Math.min(1, castleHp / maxCastleHp));
    const hpPercent = Math.round(hpRatio * 100);
    this.castleHpText.textContent = `${hpPercent}%`;
    this.castleHpBar.style.width = `${hpPercent}%`;

    this.waveText.textContent = `Волна ${waveNum}/${totalWaves}`;
    this.shellsText.textContent = `${shells}`;
    this.pearlsText.textContent = `${pearls}`;

    this.speedBtn.textContent = `${speedScale}x`;

    if (isWaveActive) {
      this.startWaveBtn.textContent = '🌊 ВОЛНА ИДЁТ...';
      this.startWaveBtn.classList.add('wave-active');
    } else {
      this.startWaveBtn.textContent = '▶ СТАРТ ВОЛНЫ';
      this.startWaveBtn.classList.remove('wave-active');
    }

    // Card affordability states
    this.cardCannon.classList.toggle('disabled', shells < TOWER_CONFIGS.cannon.baseCost);
    this.cardSplasher.classList.toggle('disabled', shells < TOWER_CONFIGS.splasher.baseCost);
    this.cardWall.classList.toggle('disabled', shells < TOWER_CONFIGS.wall.baseCost);

    // Tsunami capability check
    if (BridgeService.isRewardedSupported()) {
      this.tsunamiBtn.style.display = isWaveActive ? 'inline-flex' : 'none';
    } else {
      this.tsunamiBtn.style.display = 'none';
    }
  }

  public showTowerInspector(tower: Tower, screenX: number, screenY: number, playerShells: number): void {
    this.inspectedTower = tower;
    this.selectedBuildTool = null;
    this.cardCannon.classList.remove('selected');
    this.cardSplasher.classList.remove('selected');
    this.cardWall.classList.remove('selected');

    const cfg = TOWER_CONFIGS[tower.type];
    this.inspectorName.textContent = `${Localization.t(cfg.nameKey)} (Ур. ${tower.level})`;
    this.inspectorStats.textContent = `Урон: ${tower.damage} | Радиус: ${tower.range.toFixed(1)}`;

    const upCost = tower.getUpgradeCost();
    const canUp = tower.canUpgrade();
    this.inspectorUpgradeCost.textContent = `${upCost}`;
    this.inspectorUpgradeBtn.style.display = canUp ? 'inline-flex' : 'none';
    if (canUp && playerShells < upCost) {
      this.inspectorUpgradeBtn.setAttribute('disabled', 'true');
      this.inspectorUpgradeBtn.style.opacity = '0.5';
    } else {
      this.inspectorUpgradeBtn.removeAttribute('disabled');
      this.inspectorUpgradeBtn.style.opacity = '1.0';
    }

    this.inspectorSellRefund.textContent = `${tower.getSellRefund()}`;

    // Position inspector box near clicked screen pos
    const safeX = Math.max(120, Math.min(window.innerWidth - 120, screenX));
    const safeY = Math.max(160, Math.min(window.innerHeight - 120, screenY));
    this.towerInspector.style.left = `${safeX}px`;
    this.towerInspector.style.top = `${safeY}px`;
    this.towerInspector.style.display = 'flex';
  }

  public hideTowerInspector(): void {
    this.inspectedTower = null;
    this.towerInspector.style.display = 'none';
  }

  public showToast(message: string, type: 'error' | 'info' | 'gold' = 'error'): void {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'info' ? 'toast-info' : type === 'gold' ? 'toast-gold' : ''}`;
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2600);
  }

  public hideAllModals(): void {
    this.mainMenuModal.style.display = 'none';
    this.levelSelectModal.style.display = 'none';
    this.workshopModal.style.display = 'none';
    this.victoryModal.style.display = 'none';
    this.defeatModal.style.display = 'none';
    this.pauseModal.style.display = 'none';
    this.settingsModal.style.display = 'none';
    this.hideTowerInspector();
  }

  public showMainMenu(): void {
    this.hideAllModals();
    this.mainMenuModal.style.display = 'flex';
  }

  public showLevelSelectModal(): void {
    this.hideAllModals();
    const save = SaveService.get();
    this.levelListContainer.innerHTML = '';

    LEVELS.forEach((lvl) => {
      const isUnlocked = lvl.id <= save.unlockedLevel;
      const stars = save.levelStars[lvl.id] || 0;
      const starsStr = isUnlocked ? '⭐'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars)) : '🔒';

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.background = 'rgba(255,255,255,0.08)';
      row.style.padding = '12px 16px';
      row.style.borderRadius = '12px';

      row.innerHTML = `
        <div>
          <div style="font-weight:bold; font-size:1.05rem; color:#FFF0B8;">${lvl.id}. ${Localization.t(lvl.nameKey)}</div>
          <div style="font-size:0.85rem; color:#ced6e0;">${starsStr}</div>
        </div>
      `;

      const playBtn = document.createElement('button');
      playBtn.className = 'btn btn-coral';
      playBtn.textContent = isUnlocked ? 'Играть' : 'Закрыто';
      if (!isUnlocked) {
        playBtn.setAttribute('disabled', 'true');
        playBtn.style.opacity = '0.5';
      } else {
        playBtn.addEventListener('click', () => {
          audio.playClick();
          this.hideAllModals();
          events.emit('ui:level_selected', lvl.id);
        });
      }

      row.appendChild(playBtn);
      this.levelListContainer.appendChild(row);
    });

    this.levelSelectModal.style.display = 'flex';
  }

  public showWorkshopModal(): void {
    this.hideAllModals();
    const save = SaveService.get();
    this.workshopPearls.textContent = `${save.pearls}`;
    this.talentsGrid.innerHTML = '';

    TALENTS_CONFIG.forEach((t) => {
      const currentLvl = UpgradeManager.getTalentLevel(t.id);
      const nextCost = UpgradeManager.getNextUpgradeCost(t.id);
      const isMax = currentLvl >= t.maxLevel;
      const canAfford = save.pearls >= nextCost;

      const card = document.createElement('div');
      card.className = 'talent-card';
      card.innerHTML = `
        <div>
          <div class="talent-name">${Localization.t(t.nameKey)} (${currentLvl}/${t.maxLevel})</div>
          <div class="talent-desc">${Localization.t(t.descKey)}</div>
        </div>
        <div class="talent-footer">
          <span style="font-weight:bold; color:#F7D070; font-size:0.85rem;">
            ${isMax ? Localization.t('max_level') : `🔮 ${nextCost}`}
          </span>
        </div>
      `;

      const buyBtn = document.createElement('button');
      buyBtn.className = 'btn btn-sea';
      buyBtn.style.fontSize = '0.8rem';
      buyBtn.style.padding = '6px 12px';
      buyBtn.textContent = Localization.t('buy');

      if (isMax || !canAfford) {
        buyBtn.setAttribute('disabled', 'true');
        buyBtn.style.opacity = '0.5';
      } else {
        buyBtn.addEventListener('click', () => {
          audio.playClick();
          if (UpgradeManager.buyTalent(t.id)) {
            this.showWorkshopModal(); // Refresh view
          }
        });
      }

      card.querySelector('.talent-footer')?.appendChild(buyBtn);
      this.talentsGrid.appendChild(card);
    });

    this.workshopModal.style.display = 'flex';
  }

  public showVictoryModal(stars: number, pearlsEarned: number): void {
    this.hideAllModals();
    this.victoryStars.textContent = '⭐'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
    this.victoryPearls.textContent = `${pearlsEarned}`;

    if (BridgeService.isRewardedSupported()) {
      this.victoryDoubleBtn.style.display = 'inline-flex';
    } else {
      this.victoryDoubleBtn.style.display = 'none';
    }

    this.victoryModal.style.display = 'flex';
    audio.playVictory();
  }

  public showDefeatModal(hasReviveAvailable: boolean): void {
    this.hideAllModals();
    if (hasReviveAvailable && BridgeService.isRewardedSupported()) {
      this.defeatReviveBtn.style.display = 'inline-flex';
    } else {
      this.defeatReviveBtn.style.display = 'none';
    }

    this.defeatModal.style.display = 'flex';
    audio.playDefeat();
  }

  public showPauseModal(): void {
    this.hideAllModals();
    this.pauseModal.style.display = 'flex';
    events.emit('ui:pause_game');
  }

  public showSettingsModal(): void {
    const save = SaveService.get();
    this.settingSfx.checked = save.settings.sfxEnabled;
    this.settingBgm.checked = save.settings.bgmEnabled;
    this.settingLang.value = Localization.getLanguage();
    this.settingsModal.style.display = 'flex';
  }

  public refreshTexts(): void {
    // Re-render strings dynamically
  }
}
