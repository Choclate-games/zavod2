import * as THREE from 'three';
import { GameScreen, ComboRank, AugmentCard } from '../core/Types';
import { EventBus } from '../core/EventBus';
import { i18n } from '../platform/Localization';
import { Storage, KATANAS } from '../platform/StorageService';
import { Playgama } from '../platform/PlaygamaService';
import { Audio } from '../audio/AudioManager';

export class UIManager {
  // Containers
  private hudContainer: HTMLElement;
  private menuContainer: HTMLElement;
  private modalContainer: HTMLElement;
  private floatingTextContainer: HTMLElement;

  // HUD elements
  private hpBarFill: HTMLElement;
  private hpText: HTMLElement;
  private chronoBarFill: HTMLElement;
  private comboBadge: HTMLElement;
  private comboCountText: HTMLElement;
  private comboMultiplierText: HTMLElement;
  private heatBarFill: HTMLElement;
  private waveText: HTMLElement;
  private scoreText: HTMLElement;
  private creditsText: HTMLElement;
  private overdriveAlert: HTMLElement;
  private bossBarContainer: HTMLElement;
  private bossBarFill: HTMLElement;
  private bossNameText: HTMLElement;

  constructor() {
    this.hudContainer = document.getElementById('hud')!;
    this.menuContainer = document.getElementById('main-menu')!;
    this.modalContainer = document.getElementById('modal-container')!;
    this.floatingTextContainer = document.getElementById('floating-text-layer')!;

    this.hpBarFill = document.getElementById('hud-hp-fill')!;
    this.hpText = document.getElementById('hud-hp-text')!;
    this.chronoBarFill = document.getElementById('hud-chrono-fill')!;
    this.comboBadge = document.getElementById('hud-combo-badge')!;
    this.comboCountText = document.getElementById('hud-combo-count')!;
    this.comboMultiplierText = document.getElementById('hud-combo-multiplier')!;
    this.heatBarFill = document.getElementById('hud-heat-fill')!;
    this.waveText = document.getElementById('hud-wave-text')!;
    this.scoreText = document.getElementById('hud-score-text')!;
    this.creditsText = document.getElementById('hud-credits-text')!;
    this.overdriveAlert = document.getElementById('hud-overdrive-alert')!;
    this.bossBarContainer = document.getElementById('boss-bar-container')!;
    this.bossBarFill = document.getElementById('boss-hp-fill')!;
    this.bossNameText = document.getElementById('boss-name-text')!;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    document.getElementById('btn-play-game')?.addEventListener('click', () => {
      Audio.playButtonClick();
      EventBus.emit('ui:start_game');
    });

    document.getElementById('btn-open-hub')?.addEventListener('click', () => {
      Audio.playButtonClick();
      this.showHubModal();
    });

    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      Audio.playButtonClick();
      this.showSettingsModal();
    });

    document.getElementById('btn-hud-pause')?.addEventListener('click', () => {
      Audio.playButtonClick();
      EventBus.emit('ui:pause_toggle');
    });

    document.getElementById('btn-lang-toggle')?.addEventListener('click', () => {
      const current = i18n.getLocale();
      const next = current === 'ru' ? 'en' : 'ru';
      i18n.setLocale(next);
      const profile = Storage.getProfile();
      profile.settings.language = next;
      Storage.save();
      this.refreshAllTranslations();
    });

    document.getElementById('btn-sound-toggle')?.addEventListener('click', () => {
      const muted = !Audio.isMuted();
      Audio.setMuted(muted);
      this.updateSoundButtonIcons();
    });
  }

  public setScreen(screen: GameScreen): void {
    this.menuContainer.classList.add('hidden');
    this.hudContainer.classList.add('hidden');
    this.modalContainer.classList.add('hidden');
    this.modalContainer.innerHTML = '';

    switch (screen) {
      case 'MENU':
        this.menuContainer.classList.remove('hidden');
        this.updateMenuAdButtons();
        break;

      case 'PLAYING':
        this.hudContainer.classList.remove('hidden');
        break;

      case 'PAUSED':
        this.hudContainer.classList.remove('hidden');
        this.showPauseModal();
        break;

      case 'WAVE_CLEAR_DRAFT':
        this.hudContainer.classList.remove('hidden');
        break;
    }
  }

  public updateHUD(data: {
    hp: number;
    maxHp: number;
    chrono: number;
    maxChrono: number;
    combo: number;
    rank: ComboRank;
    multiplier: number;
    heat: number;
    wave: number;
    score: number;
    credits: number;
    isOverdrive: boolean;
    bossHp?: number;
    bossMaxHp?: number;
    isBossActive?: boolean;
  }): void {
    const hpPercent = Math.max(0, Math.min(100, (data.hp / data.maxHp) * 100));
    this.hpBarFill.style.width = `${hpPercent}%`;
    this.hpText.textContent = `${Math.ceil(data.hp)} / ${data.maxHp}`;

    const chronoPercent = Math.max(0, Math.min(100, (data.chrono / data.maxChrono) * 100));
    this.chronoBarFill.style.width = `${chronoPercent}%`;

    this.heatBarFill.style.width = `${Math.min(100, data.heat)}%`;

    if (data.combo > 0) {
      this.comboBadge.textContent = data.rank;
      this.comboBadge.className = `combo-rank rank-${data.rank.toLowerCase()}`;
      this.comboCountText.textContent = `${data.combo} SLICES`;
      this.comboMultiplierText.textContent = `x${data.multiplier.toFixed(1)}`;
      this.comboBadge.parentElement?.classList.remove('hidden');
    } else {
      this.comboBadge.parentElement?.classList.add('hidden');
    }

    if (data.isOverdrive) {
      this.overdriveAlert.classList.remove('hidden');
    } else {
      this.overdriveAlert.classList.add('hidden');
    }

    this.waveText.textContent = `${i18n.t('hud_wave')} ${data.wave}`;
    this.scoreText.textContent = `${i18n.t('hud_score')}: ${data.score}`;
    this.creditsText.textContent = `${data.credits}`;

    if (data.isBossActive && typeof data.bossHp === 'number' && typeof data.bossMaxHp === 'number') {
      this.bossBarContainer.classList.remove('hidden');
      const bossPercent = Math.max(0, Math.min(100, (data.bossHp / data.bossMaxHp) * 100));
      this.bossBarFill.style.width = `${bossPercent}%`;
      this.bossNameText.textContent = i18n.t('hud_boss');
    } else {
      this.bossBarContainer.classList.add('hidden');
    }
  }

  // --- Modals ---

  public showDraftModal(cards: AugmentCard[], onSelect: (card: AugmentCard) => void, onReroll: () => void): void {
    this.modalContainer.classList.remove('hidden');
    this.modalContainer.innerHTML = `
      <div class="modal-card cyberpunk-panel draft-panel">
        <h2 class="neon-title">${i18n.t('draft_title')}</h2>
        <p class="panel-subtitle">${i18n.t('draft_subtitle')}</p>
        
        <div class="cards-grid">
          ${cards.map((card, idx) => `
            <div class="draft-card rarity-${card.rarity}" data-idx="${idx}">
              <div class="card-rarity-badge">${i18n.t('card_' + card.rarity)}</div>
              <div class="card-icon">${card.icon}</div>
              <h3 class="card-title">${i18n.t(card.nameKey)}</h3>
              <p class="card-desc">${i18n.t(card.descKey)}</p>
              <button class="ui-interactive-btn cyber-btn primary">${i18n.t('btn_select')}</button>
            </div>
          `).join('')}
        </div>

        <div class="draft-footer">
          <button id="btn-draft-reroll" class="ui-interactive-btn cyber-btn secondary">
            🔄 ${i18n.t('btn_reroll')}
          </button>
        </div>
      </div>
    `;

    this.modalContainer.querySelectorAll('.draft-card').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-idx') || '0', 10);
        Audio.playUpgradeSelected();
        this.modalContainer.classList.add('hidden');
        onSelect(cards[idx]);
      });
    });

    document.getElementById('btn-draft-reroll')?.addEventListener('click', async () => {
      Audio.playButtonClick();
      if (Playgama.isRewardedSupported()) {
        const rewarded = await Playgama.showRewarded('reroll_augments');
        if (rewarded) {
          onReroll();
        }
      } else {
        onReroll();
      }
    });
  }

  public showGameOverModal(stats: {
    wave: number;
    kills: number;
    maxCombo: string;
    credits: number;
    score: number;
    canRevive: boolean;
  }, onRevive: () => void, onRestart: () => void, onMenu: () => void): void {
    this.modalContainer.classList.remove('hidden');
    this.modalContainer.innerHTML = `
      <div class="modal-card cyberpunk-panel gameover-panel">
        <h2 class="neon-title text-red">${i18n.t('gameover_title')}</h2>
        <p class="panel-subtitle">${i18n.t('gameover_desc')}</p>

        <div class="stats-summary">
          <div class="stat-row"><span>${i18n.t('stats_waves')}</span><strong>${stats.wave}</strong></div>
          <div class="stat-row"><span>${i18n.t('stats_kills')}</span><strong>${stats.kills}</strong></div>
          <div class="stat-row"><span>${i18n.t('stats_max_combo')}</span><strong class="rank-${stats.maxCombo.toLowerCase()}">${stats.maxCombo}</strong></div>
          <div class="stat-row"><span>${i18n.t('stats_credits')}</span><strong>+${stats.credits} 🪙</strong></div>
          <div class="stat-row highlight"><span>${i18n.t('stats_score')}</span><strong>${stats.score}</strong></div>
        </div>

        <div class="modal-actions">
          ${stats.canRevive && Playgama.isRewardedSupported() ? `
            <button id="btn-gameover-revive" class="ui-interactive-btn cyber-btn primary ad-glow">
              ⚡ ${i18n.t('btn_revive')}
            </button>
          ` : ''}
          <button id="btn-gameover-restart" class="ui-interactive-btn cyber-btn secondary">
            🔄 ${i18n.t('btn_restart')}
          </button>
          <button id="btn-gameover-menu" class="ui-interactive-btn cyber-btn tertiary">
            🏠 ${i18n.t('btn_menu')}
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-gameover-revive')?.addEventListener('click', async () => {
      Audio.playButtonClick();
      const rewarded = await Playgama.showRewarded('revive_hero');
      if (rewarded) {
        this.modalContainer.classList.add('hidden');
        onRevive();
      }
    });

    document.getElementById('btn-gameover-restart')?.addEventListener('click', () => {
      Audio.playButtonClick();
      this.modalContainer.classList.add('hidden');
      onRestart();
    });

    document.getElementById('btn-gameover-menu')?.addEventListener('click', () => {
      Audio.playButtonClick();
      this.modalContainer.classList.add('hidden');
      onMenu();
    });
  }

  public showVictoryModal(stats: {
    kills: number;
    maxCombo: string;
    credits: number;
    score: number;
  }, onDoubleCredits: () => void, onNext: () => void, onMenu: () => void): void {
    this.modalContainer.classList.remove('hidden');
    this.modalContainer.innerHTML = `
      <div class="modal-card cyberpunk-panel victory-panel">
        <h2 class="neon-title text-gold">👑 ${i18n.t('victory_title')} 👑</h2>
        <p class="panel-subtitle">${i18n.t('victory_desc')}</p>

        <div class="stats-summary">
          <div class="stat-row"><span>${i18n.t('stats_kills')}</span><strong>${stats.kills}</strong></div>
          <div class="stat-row"><span>${i18n.t('stats_max_combo')}</span><strong class="rank-${stats.maxCombo.toLowerCase()}">${stats.maxCombo}</strong></div>
          <div class="stat-row"><span>${i18n.t('stats_credits')}</span><strong>+${stats.credits} 🪙</strong></div>
          <div class="stat-row highlight"><span>${i18n.t('stats_score')}</span><strong>${stats.score}</strong></div>
        </div>

        <div class="modal-actions">
          ${Playgama.isRewardedSupported() ? `
            <button id="btn-victory-double" class="ui-interactive-btn cyber-btn primary ad-glow">
              🪙 ${i18n.t('btn_double_credits')}
            </button>
          ` : ''}
          <button id="btn-victory-next" class="ui-interactive-btn cyber-btn secondary">
            ⚡ БЕЗДНА / ДАЛЬШЕ
          </button>
          <button id="btn-victory-menu" class="ui-interactive-btn cyber-btn tertiary">
            🏠 ${i18n.t('btn_menu')}
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-victory-double')?.addEventListener('click', async () => {
      Audio.playButtonClick();
      const rewarded = await Playgama.showRewarded('double_credits');
      if (rewarded) {
        onDoubleCredits();
        const btn = document.getElementById('btn-victory-double');
        if (btn) btn.style.display = 'none';
      }
    });

    document.getElementById('btn-victory-next')?.addEventListener('click', () => {
      Audio.playButtonClick();
      this.modalContainer.classList.add('hidden');
      onNext();
    });

    document.getElementById('btn-victory-menu')?.addEventListener('click', () => {
      Audio.playButtonClick();
      this.modalContainer.classList.add('hidden');
      onMenu();
    });
  }

  public showHubModal(): void {
    this.modalContainer.classList.remove('hidden');

    const renderHubContent = () => {
      const p = Storage.getProfile();
      this.modalContainer.innerHTML = `
        <div class="modal-card cyberpunk-panel hub-panel">
          <div class="hub-header">
            <h2 class="neon-title">${i18n.t('hub_title')}</h2>
            <div class="credit-badge">🪙 ${p.credits}</div>
          </div>

          <div class="hub-tabs">
            <button id="tab-implants" class="ui-interactive-btn tab-btn active">${i18n.t('hub_stats_tab')}</button>
            <button id="tab-katanas" class="ui-interactive-btn tab-btn">${i18n.t('hub_katanas_tab')}</button>
          </div>

          <div id="hub-tab-body" class="hub-body"></div>

          <div class="hub-footer">
            <button id="btn-hub-close" class="ui-interactive-btn cyber-btn tertiary">
              ⬅️ ${i18n.t('btn_menu')}
            </button>
          </div>
        </div>
      `;

      const renderImplants = () => {
        const body = document.getElementById('hub-tab-body')!;
        const statKeys: Array<{ key: keyof typeof p.permanentUpgrades; title: string; cost: number }> = [
          { key: 'maxHpLevel', title: 'stat_max_hp', cost: 150 * (p.permanentUpgrades.maxHpLevel + 1) },
          { key: 'chronoCapLevel', title: 'stat_chrono_cap', cost: 200 * (p.permanentUpgrades.chronoCapLevel + 1) },
          { key: 'slicePowerLevel', title: 'stat_slice_power', cost: 250 * (p.permanentUpgrades.slicePowerLevel + 1) },
          { key: 'creditBoostLevel', title: 'stat_credit_boost', cost: 300 * (p.permanentUpgrades.creditBoostLevel + 1) }
        ];

        body.innerHTML = `
          <div class="stats-upgrade-list">
            ${statKeys.map((s) => {
              const lvl = p.permanentUpgrades[s.key];
              const maxed = lvl >= 5;
              const canAfford = p.credits >= s.cost;
              return `
                <div class="upgrade-row">
                  <div class="upgrade-info">
                    <strong>${i18n.t(s.title)}</strong>
                    <div class="pip-meter">
                      ${[1, 2, 3, 4, 5].map((i) => `<span class="pip ${i <= lvl ? 'filled' : ''}"></span>`).join('')}
                    </div>
                  </div>
                  <button class="ui-interactive-btn cyber-btn upgrade-stat-btn ${maxed ? 'disabled' : canAfford ? 'primary' : 'disabled'}" data-stat="${s.key}" data-cost="${s.cost}">
                    ${maxed ? 'MAX' : `${s.cost} 🪙 ${i18n.t('btn_upgrade')}`}
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        `;

        body.querySelectorAll('.upgrade-stat-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const stat = btn.getAttribute('data-stat') as keyof typeof p.permanentUpgrades;
            const cost = parseInt(btn.getAttribute('data-cost') || '0', 10);
            if (Storage.upgradeStat(stat, cost)) {
              Audio.playUpgradeSelected();
              renderHubContent();
            }
          });
        });
      };

      const renderKatanas = () => {
        const body = document.getElementById('hub-tab-body')!;
        body.innerHTML = `
          <div class="katana-grid">
            ${KATANAS.map((k) => {
              const isUnlocked = p.unlockedKatanas.includes(k.id);
              const isEquipped = p.selectedKatana === k.id;
              const canBuy = p.credits >= k.cost;
              return `
                <div class="katana-card ${isEquipped ? 'equipped' : ''}">
                  <div class="katana-preview-bar" style="background: ${k.trailColor}; box-shadow: 0 0 12px ${k.trailColor}"></div>
                  <h4>${i18n.t(k.nameKey)}</h4>
                  <p>${i18n.t(k.descKey)}</p>
                  <button class="ui-interactive-btn cyber-btn katana-btn ${isEquipped ? 'disabled' : isUnlocked ? 'secondary' : canBuy ? 'primary' : 'disabled'}" data-id="${k.id}">
                    ${isEquipped ? i18n.t('btn_equipped') : isUnlocked ? i18n.t('btn_select') : `${k.cost} 🪙 ${i18n.t('btn_unlock')}`}
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        `;

        body.querySelectorAll('.katana-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id')!;
            if (p.unlockedKatanas.includes(id)) {
              Storage.selectKatana(id);
              EventBus.emit('katana:changed', id);
              renderHubContent();
            } else if (Storage.unlockKatana(id)) {
              Audio.playUpgradeSelected();
              EventBus.emit('katana:changed', id);
              renderHubContent();
            }
          });
        });
      };

      document.getElementById('tab-implants')?.addEventListener('click', () => {
        document.getElementById('tab-implants')?.classList.add('active');
        document.getElementById('tab-katanas')?.classList.remove('active');
        renderImplants();
      });

      document.getElementById('tab-katanas')?.addEventListener('click', () => {
        document.getElementById('tab-katanas')?.classList.add('active');
        document.getElementById('tab-implants')?.classList.remove('active');
        renderKatanas();
      });

      document.getElementById('btn-hub-close')?.addEventListener('click', () => {
        Audio.playButtonClick();
        this.modalContainer.classList.add('hidden');
      });

      renderImplants();
    };

    renderHubContent();
  }

  public showSettingsModal(): void {
    const profile = Storage.getProfile();
    this.modalContainer.classList.remove('hidden');
    this.modalContainer.innerHTML = `
      <div class="modal-card cyberpunk-panel settings-panel">
        <h2 class="neon-title">${i18n.t('settings_title')}</h2>

        <div class="settings-list">
          <div class="setting-row">
            <span>${i18n.t('settings_sound')}</span>
            <button id="btn-toggle-sfx" class="ui-interactive-btn cyber-btn small">
              ${Audio.isMuted() ? '🔇 OFF' : '🔊 ON'}
            </button>
          </div>
          <div class="setting-row">
            <span>${i18n.t('settings_lang')}</span>
            <button id="btn-toggle-language" class="ui-interactive-btn cyber-btn small">
              ${profile.settings.language.toUpperCase()}
            </button>
          </div>
        </div>

        <div class="modal-actions">
          <button id="btn-settings-close" class="ui-interactive-btn cyber-btn tertiary">
            ⬅️ ${i18n.t('btn_resume')}
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-toggle-sfx')?.addEventListener('click', () => {
      Audio.setMuted(!Audio.isMuted());
      this.showSettingsModal();
    });

    document.getElementById('btn-toggle-language')?.addEventListener('click', () => {
      const next = profile.settings.language === 'ru' ? 'en' : 'ru';
      i18n.setLocale(next);
      profile.settings.language = next;
      Storage.save();
      this.refreshAllTranslations();
      this.showSettingsModal();
    });

    document.getElementById('btn-settings-close')?.addEventListener('click', () => {
      Audio.playButtonClick();
      this.modalContainer.classList.add('hidden');
    });
  }

  private showPauseModal(): void {
    this.modalContainer.classList.remove('hidden');
    this.modalContainer.innerHTML = `
      <div class="modal-card cyberpunk-panel pause-panel">
        <h2 class="neon-title">⏸️ ПАУЗА</h2>
        <div class="modal-actions vertical">
          <button id="btn-pause-resume" class="ui-interactive-btn cyber-btn primary">
            ▶️ ${i18n.t('btn_resume')}
          </button>
          <button id="btn-pause-settings" class="ui-interactive-btn cyber-btn secondary">
            ⚙️ ${i18n.t('btn_settings')}
          </button>
          <button id="btn-pause-menu" class="ui-interactive-btn cyber-btn tertiary">
            🏠 ${i18n.t('btn_menu')}
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
      Audio.playButtonClick();
      this.modalContainer.classList.add('hidden');
      EventBus.emit('ui:pause_toggle');
    });

    document.getElementById('btn-pause-settings')?.addEventListener('click', () => {
      Audio.playButtonClick();
      this.showSettingsModal();
    });

    document.getElementById('btn-pause-menu')?.addEventListener('click', () => {
      Audio.playButtonClick();
      this.modalContainer.classList.add('hidden');
      EventBus.emit('ui:return_menu');
    });
  }

  public showFloatingText(text: string, screenPos: THREE.Vector2, colorHex: string = '#00f3ff'): void {
    const el = document.createElement('div');
    el.className = 'floating-combat-text';
    el.textContent = text;
    el.style.left = `${screenPos.x}px`;
    el.style.top = `${screenPos.y}px`;
    el.style.color = colorHex;
    this.floatingTextContainer.appendChild(el);

    setTimeout(() => {
      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
    }, 900);
  }

  private updateMenuAdButtons(): void {
    const btnStarter = document.getElementById('btn-starter-ad');
    if (btnStarter) {
      if (Playgama.isRewardedSupported()) {
        btnStarter.classList.remove('hidden');
      } else {
        btnStarter.classList.add('hidden');
      }
    }
  }

  private refreshAllTranslations(): void {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = i18n.t(key);
      }
    });
  }

  private updateSoundButtonIcons(): void {
    const icon = document.getElementById('btn-sound-icon');
    if (icon) {
      icon.textContent = Audio.isMuted() ? '🔇' : '🔊';
    }
  }
}
