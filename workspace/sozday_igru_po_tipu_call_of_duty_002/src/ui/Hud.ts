import { eventBus } from '../core/EventBus';
import { WeaponDef, GAME_BALANCE } from '../config/balance';
import { RadarBlip } from '../systems/KillstreakDroneRadarSystem';

export class Hud {
  public element: HTMLDivElement;

  private timerEl: HTMLElement;
  private scoreEl: HTMLElement;
  private weaponNameEl: HTMLElement;
  private weaponRankEl: HTMLElement;
  private ammoEl: HTMLElement;
  private healthBarEl: HTMLElement;
  private hitmarkerEl: HTMLElement;
  private radarWidget: HTMLElement;
  private radarBlipsContainer: HTMLElement;

  private hitmarkerTimeout: number | null = null;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'hud-root';
    this.element.className = 'ui-layer';

    // 1. Top Bar: Match Timer & Score
    const topBar = document.createElement('div');
    topBar.className = 'hud-top-bar';

    // Top-Left Mini Radar
    this.radarWidget = document.createElement('div');
    this.radarWidget.className = 'radar-widget';
    const sweep = document.createElement('div');
    sweep.className = 'radar-sweep-line';
    this.radarWidget.appendChild(sweep);

    const playerCenter = document.createElement('div');
    playerCenter.className = 'radar-blip player-center';
    this.radarWidget.appendChild(playerCenter);

    this.radarBlipsContainer = document.createElement('div');
    this.radarWidget.appendChild(this.radarBlipsContainer);
    topBar.appendChild(this.radarWidget);

    // Top-Center Timer & Frags
    const timerBox = document.createElement('div');
    timerBox.className = 'match-timer-box';
    this.timerEl = document.createElement('div');
    this.timerEl.className = 'match-timer-text tabular-numbers';
    this.timerEl.textContent = '01:30';
    timerBox.appendChild(this.timerEl);

    this.scoreEl = document.createElement('div');
    this.scoreEl.className = 'match-score-text tabular-numbers';
    this.scoreEl.textContent = 'ФРАГИ: 0 / 12';
    timerBox.appendChild(this.scoreEl);
    topBar.appendChild(timerBox);

    // Placeholder right box for balance
    const topPadding = document.createElement('div');
    topPadding.style.width = '120px';
    topBar.appendChild(topPadding);

    this.element.appendChild(topBar);

    // 2. Center Reticle & Hitmarker Crosshair
    const reticleContainer = document.createElement('div');
    reticleContainer.className = 'reticle-container';

    const tLine = document.createElement('div'); tLine.className = 'reticle-line top';
    const bLine = document.createElement('div'); bLine.className = 'reticle-line bottom';
    const lLine = document.createElement('div'); lLine.className = 'reticle-line left';
    const rLine = document.createElement('div'); rLine.className = 'reticle-line right';
    const dot = document.createElement('div'); dot.className = 'reticle-dot';
    reticleContainer.append(tLine, bLine, lLine, rLine, dot);

    this.hitmarkerEl = document.createElement('div');
    this.hitmarkerEl.className = 'hitmarker-cross';
    const hmLine1 = document.createElement('div');
    hmLine1.style.position = 'absolute';
    hmLine1.style.width = '100%';
    hmLine1.style.height = '2px';
    hmLine1.style.top = '11px';
    hmLine1.style.background = 'var(--color-white)';
    const hmLine2 = document.createElement('div');
    hmLine2.style.position = 'absolute';
    hmLine2.style.height = '100%';
    hmLine2.style.width = '2px';
    hmLine2.style.left = '11px';
    hmLine2.style.background = 'var(--color-white)';
    this.hitmarkerEl.append(hmLine1, hmLine2);
    reticleContainer.appendChild(this.hitmarkerEl);

    this.element.appendChild(reticleContainer);

    // 3. Bottom Bar: Weapon Card & Health
    const bottomBar = document.createElement('div');
    bottomBar.className = 'hud-bottom-bar';

    const card = document.createElement('div');
    card.className = 'weapon-card';

    this.weaponRankEl = document.createElement('div');
    this.weaponRankEl.className = 'weapon-rank';
    this.weaponRankEl.textContent = 'РАНГ 1 / 12';
    card.appendChild(this.weaponRankEl);

    this.weaponNameEl = document.createElement('div');
    this.weaponNameEl.className = 'weapon-name';
    this.weaponNameEl.textContent = 'P99 Tactical';
    card.appendChild(this.weaponNameEl);

    this.ammoEl = document.createElement('div');
    this.ammoEl.className = 'ammo-counter tabular-numbers';
    this.ammoEl.textContent = '12 / 12';
    card.appendChild(this.ammoEl);

    // Health bar container
    const hpTrack = document.createElement('div');
    hpTrack.style.width = '100%';
    hpTrack.style.height = '4px';
    hpTrack.style.background = 'var(--color-border)';
    hpTrack.style.marginTop = '8px';

    this.healthBarEl = document.createElement('div');
    this.healthBarEl.style.width = '100%';
    this.healthBarEl.style.height = '100%';
    this.healthBarEl.style.background = 'var(--color-primary)';
    this.healthBarEl.style.transition = 'width 0.15s ease';
    hpTrack.appendChild(this.healthBarEl);
    card.appendChild(hpTrack);

    bottomBar.appendChild(card);
    this.element.appendChild(bottomBar);

    parent.appendChild(this.element);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventBus.on('MATCH_TIME_UPDATED', (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      this.timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    });

    eventBus.on('MATCH_SCORE_UPDATED', (data: { player: number; leader: number; target: number }) => {
      this.scoreEl.textContent = `ФРАГИ: ${data.player} / ${data.target} (ЛИДЕР: ${data.leader})`;
    });

    eventBus.on('WEAPON_CHANGED', (weapon: WeaponDef) => {
      this.weaponNameEl.textContent = weapon.name;
      this.weaponRankEl.textContent = `РАНГ ${weapon.rank} / ${GAME_BALANCE.ladder_tier_count}`;
    });

    eventBus.on('PLAYER_AMMO_CHANGED', (ammo: { current: number; max: number }) => {
      this.ammoEl.textContent = `${ammo.current} / ${ammo.max}`;
    });

    eventBus.on('PLAYER_HEALTH_CHANGED', (hp: { current: number; max: number }) => {
      const pct = Math.max(0, Math.min(100, (hp.current / hp.max) * 100));
      this.healthBarEl.style.width = `${pct}%`;
      if (pct < 30) {
        this.healthBarEl.style.background = 'var(--color-danger)';
      } else {
        this.healthBarEl.style.background = 'var(--color-primary)';
      }
    });

    eventBus.on('ENEMY_HIT', (hit: { headshot: boolean; damage: number }) => {
      this.showHitmarker(hit.headshot);
    });

    eventBus.on('UAV_ACTIVATED', (_data: { duration: number }) => {
      this.radarWidget.classList.add('active-uav');
    });

    eventBus.on('UAV_EXPIRED', () => {
      this.radarWidget.classList.remove('active-uav');
    });

    eventBus.on('REWARD_DOUBLE_CLAIMED', (_success: boolean) => {
      // Reward claimed notification handled in victory screen
    });
  }

  public showHitmarker(isHeadshot: boolean): void {
    if (this.hitmarkerTimeout !== null) {
      clearTimeout(this.hitmarkerTimeout);
    }

    this.hitmarkerEl.className = isHeadshot ? 'hitmarker-cross active-headshot' : 'hitmarker-cross active-normal';

    this.hitmarkerTimeout = window.setTimeout(() => {
      this.hitmarkerEl.className = 'hitmarker-cross';
      this.hitmarkerTimeout = null;
    }, GAME_BALANCE.hitmarker_duration * 1000);
  }

  public updateRadar(blips: RadarBlip[]): void {
    this.radarBlipsContainer.innerHTML = '';
    for (const b of blips) {
      const blipEl = document.createElement('div');
      blipEl.className = 'radar-blip';
      const px = 60 + b.x * 50;
      const py = 60 + b.y * 50;
      blipEl.style.left = `${px}px`;
      blipEl.style.top = `${py}px`;
      this.radarBlipsContainer.appendChild(blipEl);
    }
  }

  public setVisible(visible: boolean): void {
    this.element.style.display = visible ? 'block' : 'none';
  }
}