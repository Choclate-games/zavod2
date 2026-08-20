// src/ui/UIManager.ts
// DOM HUD overlay, screen transitions, 3-Card modal, Armory, Game Over and floating numbers

import * as THREE from 'three';
import { sceneManager } from '../rendering/SceneManager';
import { eventBus } from '../core/EventBus';
import { storageService } from '../platform/StorageService';
import { playgamaService } from '../platform/PlaygamaService';
import { audioManager } from '../audio/AudioManager';
import { buildManager } from '../systems/BuildManager';
import { upgradeManager } from '../systems/UpgradeManager';
import { player } from '../entities/Player';
import { UpgradeCard } from '../core/GameState';
import { virtualJoystick } from './VirtualJoystick';
import { telemetry } from '../telemetry/Telemetry';

export class UIManager {
  private static instance: UIManager;

  // DOM Elements
  private mechHpBar!: HTMLElement;
  private mechHpText!: HTMLElement;
  private mechShieldBar!: HTMLElement;
  private mechShieldText!: HTMLElement;
  private baseHpBar!: HTMLElement;
  private baseHpText!: HTMLElement;

  private waveBadge!: HTMLElement;
  private enemyCounter!: HTMLElement;
  private scrapCounter!: HTMLElement;

  private banner!: HTMLElement;
  private bannerTitle!: HTMLElement;
  private bannerSubtitle!: HTMLElement;
  private damageLayer!: HTMLElement;

  // Modals
  private modalMainMenu!: HTMLElement;
  private modalArmory!: HTMLElement;
  private modalUpgrade!: HTMLElement;
  private modalGameOver!: HTMLElement;
  private modalPause!: HTMLElement;
  private modalSettings!: HTMLElement;

  // Quick Build Buttons
  private buildButtons: HTMLElement[] = [];

  private currentScrap = 0;
  private killsThisRun = 0;
  private hasRevivedThisRun = false;
  private hasDoubledScrapThisRun = false;

  private constructor() {}

  public static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }

  public init(): void {
    // Cache DOM
    this.mechHpBar = document.getElementById('mech-hp-bar')!;
    this.mechHpText = document.getElementById('mech-hp-text')!;
    this.mechShieldBar = document.getElementById('mech-shield-bar')!;
    this.mechShieldText = document.getElementById('mech-shield-text')!;
    this.baseHpBar = document.getElementById('base-hp-bar')!;
    this.baseHpText = document.getElementById('base-hp-text')!;

    this.waveBadge = document.getElementById('wave-badge')!;
    this.enemyCounter = document.getElementById('enemy-counter')!;
    this.scrapCounter = document.getElementById('scrap-counter')!;

    this.banner = document.getElementById('announcement-banner')!;
    this.bannerTitle = document.getElementById('banner-title')!;
    this.bannerSubtitle = document.getElementById('banner-subtitle')!;
    this.damageLayer = document.getElementById('damage-text-layer')!;

    this.modalMainMenu = document.getElementById('modal-mainmenu')!;
    this.modalArmory = document.getElementById('modal-armory')!;
    this.modalUpgrade = document.getElementById('modal-upgrade')!;
    this.modalGameOver = document.getElementById('modal-gameover')!;
    this.modalPause = document.getElementById('modal-pause')!;
    this.modalSettings = document.getElementById('modal-settings')!;

    this.setupQuickBuildToolbar();
    this.setupModalButtons();
    this.bindEvents();
  }

  public resetRunStats(): void {
    this.currentScrap = 30; // Starting scrap budget
    this.killsThisRun = 0;
    this.hasRevivedThisRun = false;
    this.hasDoubledScrapThisRun = false;
    this.updateScrapDisplay();
  }

  public addScrap(amount: number): void {
    this.currentScrap += amount;
    this.updateScrapDisplay();
  }

  public getScrap(): number {
    return this.currentScrap;
  }

  private updateScrapDisplay(): void {
    this.scrapCounter.innerText = `${this.currentScrap}`;
    this.updateBuildButtonStates();
  }

  private setupQuickBuildToolbar(): void {
    const types: ('gatling' | 'tesla' | 'shield' | 'repair')[] = ['gatling', 'tesla', 'shield', 'repair'];
    types.forEach((type, idx) => {
      const btn = document.getElementById(`build-btn-${type}`)!;
      this.buildButtons.push(btn);

      btn.addEventListener('click', () => {
        const current = buildManager.getSelectedType();
        if (current === type) {
          // Place turret in front of player
          const angle = player.root.rotation.y;
          const px = player.x + Math.sin(angle) * 3.5;
          const pz = player.z + Math.cos(angle) * 3.5;
          if (buildManager.placeTurret(type, px, pz, this.currentScrap)) {
            const cost = type === 'gatling' ? 25 : type === 'tesla' ? 40 : type === 'shield' ? 35 : 50;
            this.currentScrap -= cost;
            this.updateScrapDisplay();
            telemetry.track('turret_built', { type, cost });
          }
          buildManager.selectType(null);
          btn.classList.remove('selected');
        } else {
          buildManager.selectType(type);
          this.buildButtons.forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
        }
      });
    });

    // Keyboard 1-4 hotkeys for building
    window.addEventListener('keydown', (e) => {
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
        const index = parseInt(e.code.replace('Digit', ''), 10) - 1;
        if (this.buildButtons[index]) {
          this.buildButtons[index].click();
        }
      }
      if (e.code === 'KeyB') {
        const selected = buildManager.getSelectedType();
        if (selected) {
          const type = selected as 'gatling' | 'tesla' | 'shield' | 'repair';
          const angle = player.root.rotation.y;
          const px = player.x + Math.sin(angle) * 3.5;
          const pz = player.z + Math.cos(angle) * 3.5;
          if (buildManager.placeTurret(type, px, pz, this.currentScrap)) {
            const cost = type === 'gatling' ? 25 : type === 'tesla' ? 40 : type === 'shield' ? 35 : 50;
            this.currentScrap -= cost;
            this.updateScrapDisplay();
          }
        }
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.togglePause();
      }
    });
  }

  private updateBuildButtonStates(): void {
    const costs = { gatling: 25, tesla: 40, shield: 35, repair: 50 };
    Object.entries(costs).forEach(([type, cost]) => {
      const btn = document.getElementById(`build-btn-${type}`);
      if (btn) {
        if (this.currentScrap < cost) {
          btn.classList.add('disabled');
        } else {
          btn.classList.remove('disabled');
        }
      }
    });
  }

  private setupModalButtons(): void {
    // Main Menu Buttons
    document.getElementById('btn-play-game')?.addEventListener('click', () => {
      this.closeAllModals();
      eventBus.emit('game:restart', undefined);
      telemetry.trackOnce('first_action', { action: 'start_game' });
    });

    document.getElementById('btn-open-armory')?.addEventListener('click', () => {
      this.openArmoryModal();
    });

    document.getElementById('btn-open-leaderboard')?.addEventListener('click', () => {
      const data = storageService.getData();
      alert(`🏆 ВАШИ РЕКОРДЫ:\n- Пройдено волн: ${data.highWave}\n- Уничтожено врагов: ${data.totalKills}`);
    });

    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      this.openSettingsModal();
    });

    // Armory Close
    document.getElementById('btn-close-armory')?.addEventListener('click', () => {
      this.modalArmory.classList.remove('active');
      this.modalMainMenu.classList.add('active');
    });

    // Pause Buttons
    document.getElementById('btn-pause')?.addEventListener('click', () => {
      this.togglePause();
    });

    document.getElementById('btn-resume-game')?.addEventListener('click', () => {
      this.togglePause();
    });

    document.getElementById('btn-pause-settings')?.addEventListener('click', () => {
      this.openSettingsModal();
    });

    document.getElementById('btn-quit-to-menu')?.addEventListener('click', () => {
      this.closeAllModals();
      this.modalMainMenu.classList.add('active');
      eventBus.emit('game:pause', true);
      eventBus.emit('game:state_changed', { state: 'MENU' });
    });

    // Settings Modal
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      this.modalSettings.classList.remove('active');
    });

    const sfxBtn = document.getElementById('btn-toggle-sfx')!;
    sfxBtn.addEventListener('click', () => {
      const next = !audioManager.isSfxOn();
      audioManager.setSfxEnabled(next);
      sfxBtn.innerText = next ? 'ВКЛ' : 'ВЫКЛ';
    });

    const musicBtn = document.getElementById('btn-toggle-music')!;
    musicBtn.addEventListener('click', () => {
      const next = !audioManager.isMusicOn();
      audioManager.setMusicEnabled(next);
      musicBtn.innerText = next ? 'ВКЛ' : 'ВЫКЛ';
    });

    const touchBtn = document.getElementById('btn-toggle-touch')!;
    touchBtn.addEventListener('click', () => {
      const cur = storageService.getData().settings.touchMode;
      const next = cur === 'auto' ? 'touch' : cur === 'touch' ? 'mouse' : 'auto';
      storageService.setData({
        settings: {
          ...storageService.getData().settings,
          touchMode: next,
        },
      });
      touchBtn.innerText = next === 'auto' ? 'АВТО' : next === 'touch' ? 'ТАЧ' : 'МЫШЬ';
      virtualJoystick.checkVisibility();
    });

    // Upgrade Modal: Rewarded Reroll
    document.getElementById('btn-reroll-cards')?.addEventListener('click', async () => {
      if (upgradeManager.rerollsLeft <= 0) return;
      const rewarded = await playgamaService.showRewarded('free_card_reroll');
      if (rewarded) {
        upgradeManager.rerollsLeft--;
        this.renderUpgradeCards(true);
      }
    });

    // Game Over: Rewarded Revive & 2x Scrap
    const reviveBtn = document.getElementById('btn-revive-game')!;
    reviveBtn.addEventListener('click', async () => {
      if (this.hasRevivedThisRun) return;
      const rewarded = await playgamaService.showRewarded('revive_run');
      if (rewarded) {
        this.hasRevivedThisRun = true;
        this.modalGameOver.classList.remove('active');
        player.revive();
        eventBus.emit('game:pause', false);
        eventBus.emit('game:state_changed', { state: 'PLAYING' });
      }
    });

    const doubleScrapBtn = document.getElementById('btn-double-scrap')!;
    doubleScrapBtn.addEventListener('click', async () => {
      if (this.hasDoubledScrapThisRun) return;
      const rewarded = await playgamaService.showRewarded('double_gold_run');
      if (rewarded) {
        this.hasDoubledScrapThisRun = true;
        doubleScrapBtn.style.display = 'none';
        const earned = this.currentScrap;
        this.currentScrap *= 2;
        const totalSaved = storageService.getData().scrap + earned;
        storageService.setData({ scrap: totalSaved });
        document.getElementById('stat-scrap')!.innerText = `${this.currentScrap} ⚙️ (Удвоено!)`;
      }
    });

    document.getElementById('btn-restart-game')?.addEventListener('click', () => {
      // Flush interstitial ad on leaving result screen
      playgamaService.flushInterstitial();
      this.closeAllModals();
      eventBus.emit('game:restart', undefined);
    });

    document.getElementById('btn-menu-from-gameover')?.addEventListener('click', () => {
      playgamaService.flushInterstitial();
      this.closeAllModals();
      this.modalMainMenu.classList.add('active');
      eventBus.emit('game:state_changed', { state: 'MENU' });
    });
  }

  private bindEvents(): void {
    eventBus.on('player:damaged', ({ currentHp, maxHp, currentShield, maxShield }) => {
      const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
      const shieldPct = Math.max(0, Math.min(100, (currentShield / maxShield) * 100));
      this.mechHpBar.style.width = `${hpPct}%`;
      this.mechHpText.innerText = `${Math.round(currentHp)} / ${maxHp}`;
      this.mechShieldBar.style.width = `${shieldPct}%`;
      this.mechShieldText.innerText = `${Math.round(currentShield)} / ${maxShield}`;
    });

    eventBus.on('base:damaged', ({ currentHp, maxHp }) => {
      const basePct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
      this.baseHpBar.style.width = `${basePct}%`;
      this.baseHpText.innerText = `${Math.round(currentHp)} / ${maxHp}`;
    });

    eventBus.on('wave:started', ({ waveNumber, totalWaves, enemyCount }) => {
      this.waveBadge.innerText = `ВОЛНА ${waveNumber} / ${totalWaves}`;
      this.enemyCounter.innerText = `ВРАГОВ: ${enemyCount}`;
      this.showAnnouncement(`ВОЛНА ${waveNumber}`, waveNumber === 10 ? 'ФИНАЛЬНЫЙ ТИТАН-БОСС!' : 'ОТРАЗИТЕ НАПАДЕНИЕ ОРДЫ!');
    });

    eventBus.on('enemy:killed', ({ scrapValue }) => {
      this.killsThisRun++;
      telemetry.trackOnce('first_reward', { reward: 'scrap' });
    });

    eventBus.on('scrap:collected', ({ amount }) => {
      this.addScrap(amount);
    });

    eventBus.on('entity:hit', ({ damage, isCrit, x, y, z }) => {
      this.spawnDamageNumber(damage, isCrit, x, y, z);
    });

    eventBus.on('wave:cleared', ({ waveNumber }) => {
      this.showAnnouncement(`ВОЛНА ${waveNumber} ПРОЙДЕНА!`, 'ВЫБЕРИТЕ УЛУЧШЕНИЕ');
      setTimeout(() => {
        this.openUpgradeModal();
      }, 1000);
    });
  }

  public showAnnouncement(title: string, subtitle: string): void {
    this.bannerTitle.innerText = title;
    this.bannerSubtitle.innerText = subtitle;
    this.banner.classList.add('show');
    setTimeout(() => {
      this.banner.classList.remove('show');
    }, 2400);
  }

  public openUpgradeModal(): void {
    eventBus.emit('game:pause', true);
    eventBus.emit('game:state_changed', { state: 'UPGRADE' });
    this.renderUpgradeCards(false);
    this.modalUpgrade.classList.add('active');
  }

  private renderUpgradeCards(forceHighRarity: boolean = false): void {
    const container = document.getElementById('upgrade-cards-list')!;
    container.innerHTML = '';

    const cards = upgradeManager.drawCards(forceHighRarity);
    cards.forEach((card) => {
      const el = document.createElement('div');
      el.className = `upgrade-card rarity-${card.rarity}`;
      el.innerHTML = `
        <div class="card-rarity">${card.rarity}</div>
        <div class="card-icon">${card.icon}</div>
        <div class="card-title">${card.name}</div>
        <div class="card-desc">${card.desc}</div>
      `;
      el.addEventListener('click', () => {
        upgradeManager.selectCard(card);
        audioManager.playBuild();
        this.modalUpgrade.classList.remove('active');
        eventBus.emit('game:pause', false);
        eventBus.emit('game:state_changed', { state: 'PLAYING' });
        telemetry.track('card_selected', { card: card.id, rarity: card.rarity });
      });
      container.appendChild(el);
    });

    const rerollBtn = document.getElementById('btn-reroll-cards')!;
    rerollBtn.innerText = `📺 Перебросить (${upgradeManager.rerollsLeft} ост.)`;
    rerollBtn.style.display = upgradeManager.rerollsLeft > 0 && playgamaService.isRewardedSupported() ? 'inline-flex' : 'none';
  }

  public openArmoryModal(): void {
    const data = storageService.getData();
    document.getElementById('armory-scrap-balance')!.innerText = `${data.scrap} ⚙️`;
    const container = document.getElementById('armory-upgrades-container')!;
    container.innerHTML = '';

    const metaUpgrades = [
      { id: 'vitality', name: 'Броня Корпуса (+20 HP)', baseCost: 15 },
      { id: 'firepower', name: 'Калибр Орудий (+10% Урон)', baseCost: 20 },
      { id: 'shield_capacity', name: 'Емкость Щита (+15 Щит)', baseCost: 15 },
      { id: 'scrap_magnet', name: 'Тракторный Магнит (+1.5м)', baseCost: 10 },
      { id: 'turret_engineering', name: 'Нано-Инженерия (+15% Турели)', baseCost: 25 },
    ];

    metaUpgrades.forEach((u) => {
      const lvl = (data.armoryUpgrades as any)[u.id] || 0;
      const cost = Math.round(u.baseCost * Math.pow(1.5, lvl));

      const row = document.createElement('div');
      row.className = 'armory-item';
      row.innerHTML = `
        <div class="armory-info">
          <div class="armory-name">${u.name}</div>
          <div class="armory-level">Уровень: ${lvl} / 10</div>
        </div>
        <button class="btn btn-primary" style="padding: 6px 14px; font-size: 13px;">
          ${lvl >= 10 ? 'МАКС' : `${cost} ⚙️`}
        </button>
      `;

      const btn = row.querySelector('button')!;
      if (lvl >= 10 || data.scrap < cost) {
        btn.classList.add('disabled');
      } else {
        btn.addEventListener('click', () => {
          if (data.scrap >= cost && lvl < 10) {
            data.scrap -= cost;
            (data.armoryUpgrades as any)[u.id] = lvl + 1;
            storageService.setData(data);
            player.applyMetaUpgrades();
            audioManager.playPickup();
            this.openArmoryModal();
          }
        });
      }
      container.appendChild(row);
    });

    this.modalArmory.classList.add('active');
  }

  public showGameOver(victory: boolean, wave: number): void {
    eventBus.emit('game:pause', true);
    eventBus.emit('game:state_changed', { state: 'GAMEOVER' });

    // Arm Interstitial ad for when player leaves results screen
    playgamaService.armInterstitial('game_over_leave');

    // Bank scrap permanently
    const data = storageService.getData();
    data.scrap += this.currentScrap;
    data.highWave = Math.max(data.highWave, wave);
    data.totalKills += this.killsThisRun;
    storageService.setData(data);

    // Leaderboards
    playgamaService.submitScore('globalhighscore', data.scrap);
    playgamaService.submitScore('highestwave', data.highWave);

    document.getElementById('gameover-title')!.innerText = victory ? 'ПОБЕДА! ОРБИТА СПАСЕНА' : 'БАЗА УНИЧТОЖЕНА';
    document.getElementById('gameover-subtitle')!.innerText = victory
      ? 'Все 10 волн осады успешно отражены'
      : 'Энергетическое ядро перегружено';

    document.getElementById('stat-waves')!.innerText = `${wave} / 10`;
    document.getElementById('stat-kills')!.innerText = `${this.killsThisRun}`;
    document.getElementById('stat-scrap')!.innerText = `${this.currentScrap} ⚙️`;

    const reviveBtn = document.getElementById('btn-revive-game')!;
    reviveBtn.style.display = !victory && !this.hasRevivedThisRun && playgamaService.isRewardedSupported() ? 'inline-flex' : 'none';

    const doubleBtn = document.getElementById('btn-double-scrap')!;
    doubleBtn.style.display = !this.hasDoubledScrapThisRun && playgamaService.isRewardedSupported() ? 'inline-flex' : 'none';

    this.modalGameOver.classList.add('active');
    telemetry.track('run_end', { victory, wave, kills: this.killsThisRun, scrap: this.currentScrap });
  }

  public togglePause(): void {
    const isPaused = this.modalPause.classList.contains('active');
    if (isPaused) {
      this.modalPause.classList.remove('active');
      eventBus.emit('game:pause', false);
    } else {
      this.modalPause.classList.add('active');
      eventBus.emit('game:pause', true);
    }
  }

  public openSettingsModal(): void {
    const data = storageService.getData();
    document.getElementById('btn-toggle-sfx')!.innerText = data.settings.sfxEnabled ? 'ВКЛ' : 'ВЫКЛ';
    document.getElementById('btn-toggle-music')!.innerText = data.settings.musicEnabled ? 'ВКЛ' : 'ВЫКЛ';
    document.getElementById('btn-toggle-touch')!.innerText =
      data.settings.touchMode === 'auto' ? 'АВТО' : data.settings.touchMode === 'touch' ? 'ТАЧ' : 'МЫШЬ';
    this.modalSettings.classList.add('active');
  }

  public closeAllModals(): void {
    this.modalMainMenu.classList.remove('active');
    this.modalArmory.classList.remove('active');
    this.modalUpgrade.classList.remove('active');
    this.modalGameOver.classList.remove('active');
    this.modalPause.classList.remove('active');
    this.modalSettings.classList.remove('active');
  }

  public spawnDamageNumber(amount: number, isCrit: boolean, worldX: number, worldY: number, worldZ: number): void {
    const camera = sceneManager.getCamera();
    const vec = new THREE.Vector3(worldX, worldY, worldZ).project(camera);

    const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vec.y * 0.5 + 0.5) * window.innerHeight;

    const el = document.createElement('div');
    el.className = `floating-dmg ${isCrit ? 'crit' : 'normal'}`;
    el.innerText = `${Math.round(amount)}${isCrit ? '!' : ''}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    this.damageLayer.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = `translate(-50%, -120%) scale(1.2)`;
      el.style.opacity = '0';
    });

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 600);
  }
}

export const uiManager = UIManager.getInstance();
