import { i18n } from '../platform/I18n';
import { storage } from '../platform/StorageService';
import { bridgeManager } from '../platform/BridgeManager';
import { audioManager } from '../audio/AudioManager';
import { evolutionManager, UPGRADE_CATALOG } from '../systems/EvolutionManager';
import { eventBus } from '../core/EventBus';

export class UIManager {
  private static instance: UIManager;

  // Top Bar elements
  private hudPopText!: HTMLElement;
  private hudBiomassText!: HTMLElement;
  private hudPheromoneFill!: HTMLElement;
  private hudPheromoneLabel!: HTMLElement;
  private hudObjectiveText!: HTMLElement;

  // Buttons
  private btnPause!: HTMLElement;
  private btnSound!: HTMLElement;
  private btnEvolutionTop!: HTMLElement;
  private btnDisperse!: HTMLElement;
  private btnSphere!: HTMLElement;

  // Caste buttons
  private casteBtns: HTMLElement[] = [];

  // Modal Layer
  private modalLayer!: HTMLElement;
  private modalContent!: HTMLElement;

  // Hint
  private drawHint!: HTMLElement;

  private constructor() {
    this.bindDomElements();
    this.setupEventListeners();
    this.updateStaticTranslations();
  }

  public static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }

  private bindDomElements(): void {
    this.hudPopText = document.getElementById('hud-pop-text')!;
    this.hudBiomassText = document.getElementById('hud-biomass-text')!;
    this.hudPheromoneFill = document.getElementById('hud-pheromone-fill')!;
    this.hudPheromoneLabel = document.getElementById('hud-pheromone-label')!;
    this.hudObjectiveText = document.getElementById('hud-objective-text')!;

    this.btnPause = document.getElementById('btn-pause')!;
    this.btnSound = document.getElementById('btn-sound')!;
    this.btnEvolutionTop = document.getElementById('btn-evolution-top')!;
    this.btnDisperse = document.getElementById('btn-action-disperse')!;
    this.btnSphere = document.getElementById('btn-action-sphere')!;

    this.casteBtns = [
      document.getElementById('btn-caste-worker')!,
      document.getElementById('btn-caste-soldier')!,
      document.getElementById('btn-caste-bomber')!
    ];

    this.modalLayer = document.getElementById('modal-layer')!;
    this.modalContent = document.getElementById('modal-content')!;
    this.drawHint = document.getElementById('draw-hint')!;
  }

  private setupEventListeners(): void {
    this.btnPause.addEventListener('click', () => {
      audioManager.playSfx('button_click');
      this.showPauseModal();
    });

    this.btnSound.addEventListener('click', () => {
      const active = audioManager.toggleSound();
      audioManager.playSfx('button_click');
      this.btnSound.textContent = active ? '🔊' : '🔇';
    });

    this.btnEvolutionTop.addEventListener('click', () => {
      audioManager.playSfx('button_click');
      this.showEvolutionModal();
    });

    this.btnDisperse.addEventListener('click', () => {
      audioManager.playSfx('button_click');
      eventBus.emit('swarm:disperse');
    });

    this.btnSphere.addEventListener('click', () => {
      audioManager.playSfx('button_click');
      eventBus.emit('swarm:sphere', { active: true });
    });

    this.casteBtns.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        audioManager.playSfx('button_click');
        this.selectCasteUI(idx);
      });
    });

    // Listen to Game Events
    eventBus.on('swarm:count_changed', (p) => {
      if (this.hudPopText) {
        this.hudPopText.textContent = `${p.playerCount} / ${p.maxCount}`;
      }
    });

    eventBus.on('biomass:changed', (p) => {
      if (this.hudBiomassText) {
        this.hudBiomassText.textContent = `${Math.floor(p.total)}`;
      }
    });

    eventBus.on('caste:selected', (p) => {
      this.selectCasteUI(p.caste);
    });
  }

  public updatePheromoneEnergy(current: number, max: number): void {
    const percent = Math.max(0, Math.min(100, (current / max) * 100));
    if (this.hudPheromoneFill) {
      this.hudPheromoneFill.style.width = `${percent}%`;
    }
  }

  public setObjective(text: string): void {
    if (this.hudObjectiveText) {
      this.hudObjectiveText.textContent = text;
    }
  }

  public showDrawHint(visible: boolean, text?: string): void {
    if (!this.drawHint) return;
    if (visible) {
      if (text) this.drawHint.textContent = text;
      this.drawHint.classList.add('visible');
    } else {
      this.drawHint.classList.remove('visible');
    }
  }

  public selectCasteUI(casteIndex: number): void {
    this.casteBtns.forEach((btn, idx) => {
      if (idx === casteIndex) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  public updateStaticTranslations(): void {
    const d = i18n.dict;
    document.getElementById('label-worker')!.textContent = d.workers;
    document.getElementById('label-soldier')!.textContent = d.soldiers;
    document.getElementById('label-bomber')!.textContent = d.bombers;
    document.getElementById('label-disperse')!.textContent = d.disperse;
    document.getElementById('label-sphere')!.textContent = d.sphere;
    this.hudPheromoneLabel.textContent = d.pheromones;
    this.hudBiomassText.textContent = `${storage.getData().biomass}`;
  }

  // --- MODAL DIALOGS ---

  public showMainMenuModal(onStart: () => void): void {
    const d = i18n.dict;
    this.modalLayer.style.display = 'flex';
    this.modalContent.innerHTML = `
      <div class="modal-title">🐜 ${d.gameTitle} 🐜</div>
      <div class="modal-subtitle">${d.gameSubtitle}</div>

      <div style="display: flex; flex-direction: column; gap: 12px; margin: 16px 0;">
        <button class="primary-btn" id="modal-btn-play">${d.play}</button>
        <button class="secondary-btn" id="modal-btn-evo">${d.evolution}</button>
        <button class="secondary-btn" id="modal-btn-settings">${d.settings}</button>
      </div>

      <div style="text-align: center; font-size: 13px; color: #88bb88;">
        🏆 ${d.level}: ${storage.getData().currentLevel} | 🧬 ${d.biomass}: ${storage.getData().biomass}
      </div>
    `;

    document.getElementById('modal-btn-play')!.onclick = () => {
      audioManager.playSfx('button_click');
      this.hideModal();
      onStart();
    };

    document.getElementById('modal-btn-evo')!.onclick = () => {
      audioManager.playSfx('button_click');
      this.showEvolutionModal(() => this.showMainMenuModal(onStart));
    };

    document.getElementById('modal-btn-settings')!.onclick = () => {
      audioManager.playSfx('button_click');
      this.showSettingsModal(() => this.showMainMenuModal(onStart));
    };
  }

  public showPauseModal(): void {
    const d = i18n.dict;
    eventBus.emit('game:state_changed', { state: 'PAUSE' });
    this.modalLayer.style.display = 'flex';
    this.modalContent.innerHTML = `
      <div class="modal-title">⏸️ ${d.resume}</div>
      <div class="modal-subtitle">${d.gameTitle}</div>

      <div style="display: flex; flex-direction: column; gap: 10px; margin: 16px 0;">
        <button class="primary-btn" id="modal-btn-resume">${d.resume}</button>
        <button class="secondary-btn" id="modal-btn-restart">${d.restart}</button>
        <button class="secondary-btn" id="modal-btn-evo">${d.evolution}</button>
        <button class="secondary-btn" id="modal-btn-menu">${d.mainMenu}</button>
      </div>
    `;

    document.getElementById('modal-btn-resume')!.onclick = () => {
      audioManager.playSfx('button_click');
      this.hideModal();
      eventBus.emit('game:state_changed', { state: 'IN_GAME' });
    };

    document.getElementById('modal-btn-restart')!.onclick = () => {
      audioManager.playSfx('button_click');
      this.hideModal();
      eventBus.emit('level:restart', { levelNumber: storage.getData().currentLevel });
    };

    document.getElementById('modal-btn-evo')!.onclick = () => {
      audioManager.playSfx('button_click');
      this.showEvolutionModal(() => this.showPauseModal());
    };

    document.getElementById('modal-btn-menu')!.onclick = () => {
      audioManager.playSfx('button_click');
      this.hideModal();
      eventBus.emit('game:state_changed', { state: 'MAIN_MENU' });
    };
  }

  public showVictoryModal(levelNum: number, biomassEarned: number, onNext: () => void): void {
    const d = i18n.dict;
    this.modalLayer.style.display = 'flex';

    let isDoubled = false;

    const render = () => {
      const isRewarded = bridgeManager.isRewardedSupported;
      const displayBiomass = isDoubled ? biomassEarned * 2 : biomassEarned;

      this.modalContent.innerHTML = `
        <div class="modal-title">${d.victory}</div>
        <div class="modal-subtitle">${d.victoryDesc}</div>

        <div style="background: rgba(30, 50, 35, 0.8); border-radius: 14px; padding: 14px; text-align: center; border: 1.5px solid rgba(57, 255, 20, 0.4);">
          <div style="font-size: 14px; color: #a0dba0;">${d.level} ${levelNum} Cleared!</div>
          <div style="font-size: 24px; font-weight: 800; color: #55eeff; margin: 6px 0;">+${displayBiomass} 🧬</div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
          ${isRewarded && !isDoubled ? `<button class="rewarded-btn" id="btn-double-biomass">${i18n.t('rewardDoubleBiomass', { amount: biomassEarned })}</button>` : ''}
          <button class="primary-btn" id="modal-btn-next">${d.nextLevel}</button>
          <button class="secondary-btn" id="modal-btn-evo">${d.evolution}</button>
        </div>
      `;

      if (isRewarded && !isDoubled) {
        document.getElementById('btn-double-biomass')!.onclick = () => {
          bridgeManager.showRewarded('rewarded_double_biomass', () => {
            isDoubled = true;
            evolutionManager.addBiomass(biomassEarned);
            render();
          });
        };
      }

      document.getElementById('modal-btn-next')!.onclick = () => {
        audioManager.playSfx('button_click');
        // Show Interstitial ad with cooldown check
        bridgeManager.showInterstitial('level_complete');
        this.hideModal();
        onNext();
      };

      document.getElementById('modal-btn-evo')!.onclick = () => {
        audioManager.playSfx('button_click');
        this.showEvolutionModal(() => this.showVictoryModal(levelNum, biomassEarned, onNext));
      };
    };

    render();
  }

  public showDefeatModal(levelNum: number, onRestart: () => void): void {
    const d = i18n.dict;
    this.modalLayer.style.display = 'flex';

    const isRewarded = bridgeManager.isRewardedSupported;

    this.modalContent.innerHTML = `
      <div class="modal-title" style="color: #ff4466;">💀 ${d.defeat}</div>
      <div class="modal-subtitle">${d.defeatDesc}</div>

      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 14px;">
        ${isRewarded ? `<button class="rewarded-btn" id="btn-revive-swarm">${d.rewardInstantSwarm}</button>` : ''}
        <button class="primary-btn" id="modal-btn-retry">${d.restart}</button>
        <button class="secondary-btn" id="modal-btn-evo">${d.evolution}</button>
        <button class="secondary-btn" id="modal-btn-menu">${d.mainMenu}</button>
      </div>
    `;

    if (isRewarded) {
      document.getElementById('btn-revive-swarm')!.onclick = () => {
        bridgeManager.showRewarded('rewarded_instant_swarm', () => {
          this.hideModal();
          eventBus.emit('ad:reward_granted', { placement: 'rewarded_instant_swarm' });
        });
      };
    }

    document.getElementById('modal-btn-retry')!.onclick = () => {
      audioManager.playSfx('button_click');
      bridgeManager.showInterstitial('restart_level');
      this.hideModal();
      onRestart();
    };

    document.getElementById('modal-btn-evo')!.onclick = () => {
      audioManager.playSfx('button_click');
      this.showEvolutionModal(() => this.showDefeatModal(levelNum, onRestart));
    };

    document.getElementById('modal-btn-menu')!.onclick = () => {
      audioManager.playSfx('button_click');
      this.hideModal();
      eventBus.emit('game:state_changed', { state: 'MAIN_MENU' });
    };
  }

  public showEvolutionModal(onCloseCallback?: () => void): void {
    const d = i18n.dict;
    this.modalLayer.style.display = 'flex';

    const render = () => {
      const lang = i18n.getLanguage();
      const currentBiomass = evolutionManager.getBiomass();

      let cardsHtml = '';
      for (const node of UPGRADE_CATALOG) {
        const lvl = evolutionManager.getUpgradeLevel(node.id);
        const isMax = lvl >= node.maxLevel;
        const cost = evolutionManager.getUpgradeCost(node);
        const canBuy = !isMax && currentBiomass >= cost;

        const name = lang === 'ru' ? node.nameRu : node.nameEn;
        const desc = lang === 'ru' ? node.descRu : node.descEn;

        cardsHtml += `
          <div class="evolution-card ${lvl > 0 ? 'unlocked' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 18px;">${node.icon}</span>
              <span style="font-size: 11px; font-weight: 800; color: #88ff88;">Ур. ${lvl}/${node.maxLevel}</span>
            </div>
            <div class="evo-name">${name}</div>
            <div class="evo-desc">${desc}</div>
            <div class="evo-cost">
              ${isMax ? `<span style="color: #76ff03;">${d.maxLevel}</span>` : `<span>🧬 ${cost}</span>`}
            </div>
            <button class="evo-btn" data-id="${node.id}" ${canBuy ? '' : 'disabled'}>
              ${isMax ? d.upgraded : d.buy}
            </button>
          </div>
        `;
      }

      this.modalContent.innerHTML = `
        <div class="modal-title">🧬 ${d.evolution}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(10,25,15,0.7); padding: 8px 14px; border-radius: 12px; border: 1px solid rgba(57,255,20,0.3);">
          <span style="font-size: 13px; color: #a0cfa0;">${d.biomass}:</span>
          <span style="font-size: 18px; font-weight: 800; color: #55eeff;">🧬 ${currentBiomass}</span>
        </div>

        <div class="evolution-grid">
          ${cardsHtml}
        </div>

        <button class="secondary-btn" id="modal-btn-close-evo" style="margin-top: 8px;">${d.close}</button>
      `;

      // Attach buy listeners
      this.modalContent.querySelectorAll('.evo-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const target = e.currentTarget as HTMLElement;
          const upgradeId = target.dataset.id;
          const node = UPGRADE_CATALOG.find((n) => n.id === upgradeId);
          if (node && evolutionManager.purchaseUpgrade(node)) {
            render();
          }
        });
      });

      document.getElementById('modal-btn-close-evo')!.onclick = () => {
        audioManager.playSfx('button_click');
        if (onCloseCallback) {
          onCloseCallback();
        } else {
          this.hideModal();
        }
      };
    };

    render();
  }

  public showSettingsModal(onCloseCallback?: () => void): void {
    const d = i18n.dict;
    this.modalLayer.style.display = 'flex';

    const render = () => {
      const curData = storage.getData();
      this.modalContent.innerHTML = `
        <div class="modal-title">⚙️ ${d.settings}</div>
        <div class="modal-subtitle">${d.gameTitle}</div>

        <div style="display: flex; flex-direction: column; gap: 14px; margin: 16px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>🔊 ${d.sound}</span>
            <button class="secondary-btn" id="toggle-sound">${curData.soundEnabled ? 'ВКЛ / ON' : 'ВЫКЛ / OFF'}</button>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>🎵 ${d.music}</span>
            <button class="secondary-btn" id="toggle-music">${curData.musicEnabled ? 'ВКЛ / ON' : 'ВЫКЛ / OFF'}</button>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>🌐 ${d.language}</span>
            <button class="secondary-btn" id="toggle-lang">${i18n.getLanguage() === 'ru' ? 'Русский 🇷🇺' : 'English 🇬🇧'}</button>
          </div>
        </div>

        <button class="primary-btn" id="modal-btn-close-settings">${d.close}</button>
      `;

      document.getElementById('toggle-sound')!.onclick = () => {
        audioManager.toggleSound();
        render();
      };

      document.getElementById('toggle-music')!.onclick = () => {
        audioManager.toggleMusic();
        render();
      };

      document.getElementById('toggle-lang')!.onclick = () => {
        const nextLang = i18n.getLanguage() === 'ru' ? 'en' : 'ru';
        i18n.setLanguage(nextLang);
        storage.getData().language = nextLang;
        storage.save();
        this.updateStaticTranslations();
        render();
      };

      document.getElementById('modal-btn-close-settings')!.onclick = () => {
        audioManager.playSfx('button_click');
        if (onCloseCallback) {
          onCloseCallback();
        } else {
          this.hideModal();
        }
      };
    };

    render();
  }

  public hideModal(): void {
    this.modalLayer.style.display = 'none';
  }
}

export const uiManager = UIManager.getInstance();
