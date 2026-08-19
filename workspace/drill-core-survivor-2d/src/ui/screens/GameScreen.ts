import { gameState } from '../../core/GameState';
import { Localization } from '../../core/Localization';
import { eventBus } from '../../core/EventBus';

export class GameScreen {
  private container: HTMLElement;
  private hpFill!: HTMLElement;
  private hpText!: HTMLElement;
  private heatFill!: HTMLElement;
  private craftFill!: HTMLElement;
  private craftText!: HTMLElement;
  private depthVal!: HTMLElement;
  private biomeName!: HTMLElement;
  private crystalsVal!: HTMLElement;
  private perksShelf!: HTMLElement;
  private bossWarning!: HTMLElement;
  private pauseModal!: HTMLElement;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.display = 'none';
    parent.appendChild(this.container);

    this.buildDom();
    this.attachEvents();
  }

  private buildDom(): void {
    this.container.innerHTML = `
      <!-- HUD Header -->
      <div class="hud-header interactive">
        <!-- Left: HP & Heat -->
        <div class="hud-panel">
          <div class="bar-container">
            <div class="bar-label">
              <span>${Localization.t('hpLabel')}</span>
              <span id="hud-hp-text">100/100</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill hp-fill" id="hud-hp-fill" style="width: 100%;"></div>
            </div>

            <div class="bar-label" style="margin-top: 4px;">
              <span>${Localization.t('heatLabel')}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill heat-fill" id="hud-heat-fill" style="width: 0%;"></div>
            </div>
          </div>

          <!-- Active Perks mini bar -->
          <div class="perks-shelf" id="hud-perks-shelf"></div>
        </div>

        <!-- Center: Craft XP Bar -->
        <div class="hud-panel" style="flex: 1; max-width: 180px;">
          <div class="bar-container">
            <div class="bar-label">
              <span>⚡ ${Localization.t('craftLabel')}</span>
              <span id="hud-craft-text">Lv.1</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill craft-fill" id="hud-craft-fill" style="width: 0%;"></div>
            </div>
          </div>
        </div>

        <!-- Right: Pause & Crystals -->
        <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-end;">
          <button class="btn-secondary" id="btn-hud-pause" style="padding: 6px 12px; font-weight: 800;">
            ⏸️
          </button>
          <div class="hud-panel" style="font-size: 13px; font-weight: 800; color: var(--accent-gold);">
            💎 <span id="hud-crystals-val">0</span>
          </div>
        </div>
      </div>

      <!-- Depth & Biome indicator on right edge -->
      <div class="depth-indicator">
        <div style="font-size: 10px; color: var(--text-muted);">${Localization.t('depthLabel')}</div>
        <div class="depth-val" id="hud-depth-val">0 m</div>
        <div class="depth-record" id="hud-biome-name">B-0</div>
      </div>

      <!-- Boss Warning Banner -->
      <div class="boss-warning-banner" id="hud-boss-warning">
        ⚠️ ${Localization.t('bossWarning')} ⚠️
      </div>

      <!-- Pause Modal -->
      <div class="modal-overlay" id="hud-pause-modal">
        <div class="modal-card interactive" style="text-align: center; gap: 16px;">
          <h2 style="font-size: 26px; color: #fff;">${Localization.t('pausedTitle')}</h2>
          <button class="btn-main" id="btn-pause-resume">
            ▶️ ${Localization.t('resumeBtn')}
          </button>
          <button class="btn-secondary" id="btn-pause-exit">
            🚪 ${Localization.t('exitToMenuBtn')}
          </button>
        </div>
      </div>
    `;

    this.hpFill = document.getElementById('hud-hp-fill')!;
    this.hpText = document.getElementById('hud-hp-text')!;
    this.heatFill = document.getElementById('hud-heat-fill')!;
    this.craftFill = document.getElementById('hud-craft-fill')!;
    this.craftText = document.getElementById('hud-craft-text')!;
    this.depthVal = document.getElementById('hud-depth-val')!;
    this.biomeName = document.getElementById('hud-biome-name')!;
    this.crystalsVal = document.getElementById('hud-crystals-val')!;
    this.perksShelf = document.getElementById('hud-perks-shelf')!;
    this.bossWarning = document.getElementById('hud-boss-warning')!;
    this.pauseModal = document.getElementById('hud-pause-modal')!;
  }

  private attachEvents(): void {
    document.getElementById('btn-hud-pause')?.addEventListener('click', () => {
      eventBus.emit('ui:toggle_pause');
    });

    document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
      eventBus.emit('ui:toggle_pause');
    });

    document.getElementById('btn-pause-exit')?.addEventListener('click', () => {
      eventBus.emit('ui:exit_to_hangar');
    });

    eventBus.on('game:boss_warning', () => {
      this.bossWarning.style.display = 'block';
      setTimeout(() => {
        this.bossWarning.style.display = 'none';
      }, 3500);
    });
  }

  public update(): void {
    // HP
    const hpPct = Math.max(0, (gameState.currentHp / gameState.maxHp) * 100);
    this.hpFill.style.width = `${hpPct}%`;
    this.hpText.textContent = `${Math.ceil(gameState.currentHp)}/${gameState.maxHp}`;

    // Heat
    const heatPct = Math.min(100, (gameState.currentHeat / gameState.maxHeat) * 100);
    this.heatFill.style.width = `${heatPct}%`;

    // Craft XP
    const craftPct = Math.min(100, (gameState.craftXp / gameState.craftXpNeeded) * 100);
    this.craftFill.style.width = `${craftPct}%`;
    this.craftText.textContent = `Lv.${gameState.currentPerkDraftLevel}`;

    // Depth
    this.depthVal.textContent = `${Math.floor(gameState.currentDepth)} m`;
    const biomeKey = `biome_${gameState.currentBiomeIndex}`;
    this.biomeName.textContent = Localization.t(biomeKey);

    // Crystals
    this.crystalsVal.textContent = `${gameState.runStats.crystalsEarned}`;

    // Active perks badges
    this.renderPerksShelf();
  }

  private renderPerksShelf(): void {
    const perks = Array.from(gameState.equippedPerks.values());
    if (perks.length === 0) {
      this.perksShelf.innerHTML = '';
      return;
    }

    let html = '';
    for (const p of perks) {
      let icon = '⚡';
      if (p.category === 'cryo') icon = '❄️';
      else if (p.category === 'nuclear') icon = '☢️';
      else if (p.category === 'drone') icon = '🔫';
      else if (p.category === 'chassis') icon = '🛡️';

      html += `
        <div class="perk-badge">
          <span>${icon}</span>
          <div class="badge-lvl">${p.level}</div>
        </div>
      `;
    }
    this.perksShelf.innerHTML = html;
  }

  public show(): void {
    this.container.style.display = 'block';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public setPauseModal(show: boolean): void {
    if (show) {
      this.pauseModal.classList.add('active');
    } else {
      this.pauseModal.classList.remove('active');
    }
  }
}
