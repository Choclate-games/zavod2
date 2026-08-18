import confetti from 'canvas-confetti';
import { EventBus } from '../core/EventBus';
import { UpgradeType, VoxelModelData } from '../core/Types';
import { COLLECTIONS_DATA, getAllModels } from '../data/ModelsData';
import { UPGRADE_DEFINITIONS } from '../data/UpgradeConfig';
import { t } from '../data/Localization';
import { EconomySystem } from '../systems/EconomySystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { ComboSystem } from '../systems/ComboSystem';
import { AudioManager } from '../audio/AudioManager';
import { PlaygamaService } from '../platform/PlaygamaService';
import { StorageService } from '../platform/StorageService';

export class UIManager {
  private eventBus: EventBus;
  private economy: EconomySystem;
  private upgrades: UpgradeSystem;
  private combo: ComboSystem;
  private audio: AudioManager;
  private playgama: PlaygamaService;
  private storage: StorageService;

  // DOM Elements Cache
  private loadingScreen!: HTMLElement;
  private loadingProgressBar!: HTMLElement;
  private loadingStatusText!: HTMLElement;

  private gameHud!: HTMLElement;
  private hudCoinsText!: HTMLElement;
  private modelNameText!: HTMLElement;
  private modelProgressFill!: HTMLElement;
  private modelPercentText!: HTMLElement;
  private galleryBadge!: HTMLElement;
  private soundBtn!: HTMLElement;
  private soundIcon!: HTMLElement;

  private turboBanner!: HTMLElement;
  private comboFill!: HTMLElement;
  private floatingContainer!: HTMLElement;
  private toastContainer!: HTMLElement;

  private megaBoostBtn!: HTMLElement;
  private megaBoostTimer!: HTMLElement;

  // Upgrade Cards
  private upgradeCards: Record<UpgradeType, { btn: HTMLElement; lvl: HTMLElement; cost: HTMLElement }> = {} as any;

  // Modals
  private victoryModal!: HTMLElement;
  private victoryModelTitle!: HTMLElement;
  private victoryVoxelsCount!: HTMLElement;
  private victoryCoinsEarned!: HTMLElement;
  private victoryDoubleBtn!: HTMLElement;
  private victoryNextBtn!: HTMLElement;

  private galleryModal!: HTMLElement;
  private galleryTabs!: HTMLElement;
  private galleryItemsGrid!: HTMLElement;

  private shopModal!: HTMLElement;
  private goldSkinPriceText!: HTMLElement;
  private buyGoldSkinBtn!: HTMLElement;
  private rewardUpgradeBtn!: HTMLElement;
  private rewardCoinsBtn!: HTMLElement;

  private currentSelectedCategory = 'food_fruits';
  public onSelectModelRequest?: (model: VoxelModelData) => void;
  public onNextModelRequest?: () => void;
  public onDoubleRewardRequest?: () => void;

  constructor(
    eventBus: EventBus,
    economy: EconomySystem,
    upgrades: UpgradeSystem,
    combo: ComboSystem,
    audio: AudioManager
  ) {
    this.eventBus = eventBus;
    this.economy = economy;
    this.upgrades = upgrades;
    this.combo = combo;
    this.audio = audio;
    this.playgama = PlaygamaService.getInstance();
    this.storage = StorageService.getInstance();

    this.cacheElements();
    this.bindEvents();
    this.subscribeEventBus();
  }

  private cacheElements(): void {
    this.loadingScreen = document.getElementById('loading-screen')!;
    this.loadingProgressBar = document.getElementById('loading-progress-bar')!;
    this.loadingStatusText = document.getElementById('loading-status-text')!;

    this.gameHud = document.getElementById('game-hud')!;
    this.hudCoinsText = document.getElementById('hud-coins-text')!;
    this.modelNameText = document.getElementById('model-name-text')!;
    this.modelProgressFill = document.getElementById('model-progress-fill')!;
    this.modelPercentText = document.getElementById('model-percent-text')!;
    this.galleryBadge = document.getElementById('gallery-badge')!;
    this.soundBtn = document.getElementById('btn-sound')!;
    this.soundIcon = document.getElementById('sound-icon')!;

    this.turboBanner = document.getElementById('turbo-banner')!;
    this.comboFill = document.getElementById('combo-fill')!;
    this.floatingContainer = document.getElementById('floating-numbers-container')!;
    this.toastContainer = document.getElementById('toast-container')!;

    this.megaBoostBtn = document.getElementById('btn-mega-boost')!;
    this.megaBoostTimer = document.getElementById('mega-boost-timer')!;

    this.upgradeCards = {
      WIDTH: {
        btn: document.getElementById('btn-upgrade-width')!,
        lvl: document.getElementById('upg-width-lvl')!,
        cost: document.getElementById('upg-width-cost')!
      },
      SHARPNESS: {
        btn: document.getElementById('btn-upgrade-sharpness')!,
        lvl: document.getElementById('upg-sharpness-lvl')!,
        cost: document.getElementById('upg-sharpness-cost')!
      },
      VALUE: {
        btn: document.getElementById('btn-upgrade-value')!,
        lvl: document.getElementById('upg-value-lvl')!,
        cost: document.getElementById('upg-value-cost')!
      },
      SPEED: {
        btn: document.getElementById('btn-upgrade-speed')!,
        lvl: document.getElementById('upg-speed-lvl')!,
        cost: document.getElementById('upg-speed-cost')!
      }
    };

    // Victory Modal
    this.victoryModal = document.getElementById('modal-victory')!;
    this.victoryModelTitle = document.getElementById('victory-model-title')!;
    this.victoryVoxelsCount = document.getElementById('victory-voxels-count')!;
    this.victoryCoinsEarned = document.getElementById('victory-coins-earned')!;
    this.victoryDoubleBtn = document.getElementById('btn-victory-double')!;
    this.victoryNextBtn = document.getElementById('btn-victory-next')!;

    // Gallery Modal
    this.galleryModal = document.getElementById('modal-gallery')!;
    this.galleryTabs = document.getElementById('gallery-tabs')!;
    this.galleryItemsGrid = document.getElementById('gallery-items-grid')!;

    // Shop Modal
    this.shopModal = document.getElementById('modal-shop')!;
    this.goldSkinPriceText = document.getElementById('gold-skin-price')!;
    this.buyGoldSkinBtn = document.getElementById('btn-buy-gold-skin')!;
    this.rewardUpgradeBtn = document.getElementById('btn-reward-upgrade')!;
    this.rewardCoinsBtn = document.getElementById('btn-reward-coins')!;
  }

  private bindEvents(): void {
    // Sound Button
    this.soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentMuted = this.audio.isMuted();
      const newMuted = !currentMuted;
      this.audio.setPlayerMuted(newMuted);
      this.soundIcon.textContent = newMuted ? '🔇' : '🔊';
      this.storage.updateProgress({ soundEnabled: !newMuted });
    });

    // Gallery Button
    document.getElementById('btn-gallery')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.playUiClick();
      this.openGallery();
    });

    document.getElementById('btn-close-gallery')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.playUiClick();
      this.closeGallery();
    });

    // Shop Button
    document.getElementById('btn-shop')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.playUiClick();
      this.openShop();
    });

    document.getElementById('btn-close-shop')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.playUiClick();
      this.closeShop();
    });

    // Mega Boost Bonus Button
    this.megaBoostBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.audio.playUiClick();
      const success = await this.playgama.showRewardedVideo('mega_turbo_boost');
      if (success) {
        this.combo.activateMegaTurbo(30);
        this.showToast(t().notifications.bonusActive, 'gold');
      } else {
        this.showToast(t().notifications.adFailed, 'info');
      }
    });

    // Upgrade Cards Buttons
    const types: UpgradeType[] = ['WIDTH', 'SHARPNESS', 'VALUE', 'SPEED'];
    types.forEach((type) => {
      this.upgradeCards[type].btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.upgrades.canAfford(type)) {
          this.upgrades.buyUpgrade(type);
          this.audio.playUiClick();
          this.updateUpgradeCards();
        } else {
          this.audio.playUiClick();
        }
      });
    });

    // Victory Buttons
    this.victoryDoubleBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.audio.playUiClick();
      const success = await this.playgama.showRewardedVideo('x2_stage_reward');
      if (success) {
        if (this.onDoubleRewardRequest) this.onDoubleRewardRequest();
        this.victoryDoubleBtn.classList.add('hidden');
        this.showToast('🪙 Награда удвоена!', 'gold');
      } else {
        this.showToast(t().notifications.adFailed, 'info');
      }
    });

    this.victoryNextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.playUiClick();
      this.hideVictoryModal();
      if (this.onNextModelRequest) this.onNextModelRequest();
    });

    // Shop Buy Gold Skin
    this.buyGoldSkinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const progress = this.storage.getProgress();
      if (progress.hasGoldSkin) return;

      const cost = 10000;
      if (this.economy.spendCoins(cost)) {
        this.storage.updateProgress({ hasGoldSkin: true });
        this.audio.playVictoryFanfare();
        this.showToast('✨ Золотой Измельчитель активирован!', 'gold');
        this.updateShopState();
      } else {
        this.showToast(t().notifications.notEnoughCoins, 'info');
      }
    });

    // Shop Free Upgrade Ad
    this.rewardUpgradeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.audio.playUiClick();
      const success = await this.playgama.showRewardedVideo('free_instant_upgrade');
      if (success) {
        const upgraded = this.upgrades.grantFreeUpgrade();
        this.showToast(`🎁 Улучшение ${upgraded} повышено!`, 'gold');
        this.updateUpgradeCards();
      } else {
        this.showToast(t().notifications.adFailed, 'info');
      }
    });

    // Shop Coin Chest Ad
    this.rewardCoinsBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.audio.playUiClick();
      const success = await this.playgama.showRewardedVideo('huge_coin_chest');
      if (success) {
        this.economy.addCoins(2500);
        this.showToast('💰 Получено 2,500 монет!', 'gold');
      } else {
        this.showToast(t().notifications.adFailed, 'info');
      }
    });
  }

  private subscribeEventBus(): void {
    this.eventBus.on('coins:updated', ({ formatted }) => {
      this.hudCoinsText.textContent = formatted;
      this.updateUpgradeCards();
    });

    this.eventBus.on('coins:earned', ({ amount, screenX, screenY }) => {
      this.spawnFloatingNumber(amount, screenX, screenY);
    });

    this.eventBus.on('model:loaded', ({ model }) => {
      this.modelNameText.textContent = model.nameRu;
      this.modelProgressFill.style.width = '0%';
      this.modelPercentText.textContent = '0%';
      this.updateGalleryBadge();
    });

    this.eventBus.on('model:progress', ({ percent }) => {
      this.modelProgressFill.style.width = `${percent}%`;
      this.modelPercentText.textContent = `${percent}%`;
    });

    this.eventBus.on('model:completed', ({ model, totalVoxels, earnedCoins }) => {
      this.showVictoryModal(model, totalVoxels, earnedCoins);
    });

    this.eventBus.on('turbo:state', ({ isTurbo, multiplier, progress }) => {
      this.comboFill.style.width = `${Math.min(100, Math.floor(progress * 100))}%`;
      if (isTurbo) {
        this.turboBanner.classList.remove('hidden');
      } else {
        this.turboBanner.classList.add('hidden');
      }

      const megaRemaining = this.combo.getMegaTurboTimeRemaining();
      if (megaRemaining > 0) {
        this.megaBoostTimer.textContent = `${megaRemaining}с`;
      } else {
        this.megaBoostTimer.textContent = 'Реклама';
      }
    });

    this.eventBus.on('upgrade:purchased', () => {
      this.updateUpgradeCards();
    });

    this.eventBus.on('notification:show', ({ message, type }) => {
      this.showToast(message, type);
    });
  }

  public updateLoading(percent: number, text?: string): void {
    this.loadingProgressBar.style.width = `${percent}%`;
    if (text) this.loadingStatusText.textContent = text;
    this.playgama.sendLoadingProgress(percent);
  }

  public hideLoading(): void {
    this.loadingScreen.style.opacity = '0';
    setTimeout(() => {
      this.loadingScreen.classList.add('hidden');
      this.gameHud.classList.remove('hidden');
      this.updateUpgradeCards();
      this.updateGalleryBadge();
    }, 500);
  }

  public updateUpgradeCards(): void {
    const types: UpgradeType[] = ['WIDTH', 'SHARPNESS', 'VALUE', 'SPEED'];
    types.forEach((type) => {
      const data = this.upgrades.getLevelData(type);
      const isMax = data.level >= UPGRADE_DEFINITIONS[type].maxLevel;
      const card = this.upgradeCards[type];

      card.lvl.textContent = isMax ? 'МАКС' : `Ур. ${data.level}`;
      card.cost.textContent = isMax ? '—' : this.economy.formatNumber(data.cost);

      if (this.upgrades.canAfford(type)) {
        card.btn.classList.add('can-afford');
        card.btn.classList.remove('disabled');
      } else {
        card.btn.classList.remove('can-afford');
        card.btn.classList.add('disabled');
      }
    });
  }

  public updateGalleryBadge(): void {
    const completed = this.storage.getProgress().completedModelIds.length;
    const total = getAllModels().length;
    this.galleryBadge.textContent = `${completed}/${total}`;
  }

  private spawnFloatingNumber(amount: number, screenX?: number, screenY?: number): void {
    const el = document.createElement('div');
    el.className = 'floating-number';
    el.textContent = `+${amount}`;

    const x = screenX || (window.innerWidth / 2 + (Math.random() * 120 - 60));
    const y = screenY || (window.innerHeight * 0.58 + (Math.random() * 60 - 30));

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    this.floatingContainer.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 950);
  }

  public showToast(message: string, type: 'info' | 'success' | 'gold' = 'info'): void {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2500);
  }

  // ================= Victory Modal =================
  private showVictoryModal(model: VoxelModelData, totalVoxels: number, earnedCoins: number): void {
    this.victoryModelTitle.textContent = `${model.nameRu} Уничтожен!`;
    this.victoryVoxelsCount.textContent = totalVoxels.toLocaleString('ru-RU');
    this.victoryCoinsEarned.textContent = `+${this.economy.formatNumber(earnedCoins)} 🪙`;
    this.victoryDoubleBtn.classList.remove('hidden');

    this.victoryModal.classList.remove('hidden');

    // Launch celebratory confetti bursts!
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  }

  private hideVictoryModal(): void {
    this.victoryModal.classList.add('hidden');
  }

  // ================= Gallery Modal =================
  private openGallery(): void {
    this.renderGalleryTabs();
    this.renderGalleryItems();
    this.galleryModal.classList.remove('hidden');
  }

  private closeGallery(): void {
    this.galleryModal.classList.add('hidden');
  }

  private renderGalleryTabs(): void {
    this.galleryTabs.innerHTML = '';
    COLLECTIONS_DATA.forEach((col) => {
      const tab = document.createElement('button');
      tab.className = `collection-tab ${col.id === this.currentSelectedCategory ? 'active' : ''}`;
      tab.textContent = `${col.icon} ${col.nameRu}`;
      tab.addEventListener('click', () => {
        this.currentSelectedCategory = col.id;
        this.audio.playUiClick();
        this.renderGalleryTabs();
        this.renderGalleryItems();
      });
      this.galleryTabs.appendChild(tab);
    });
  }

  private renderGalleryItems(): void {
    this.galleryItemsGrid.innerHTML = '';
    const currentCollection = COLLECTIONS_DATA.find((c) => c.id === this.currentSelectedCategory);
    if (!currentCollection) return;

    const completed = new Set(this.storage.getProgress().completedModelIds);

    currentCollection.models.forEach((model) => {
      const item = document.createElement('div');
      const isCompleted = completed.has(model.id);

      item.className = `gallery-item ${isCompleted ? 'active-item' : ''}`;
      item.innerHTML = `
        <div class="gallery-item-icon">${model.icon}</div>
        <div class="gallery-item-name">${model.nameRu}</div>
        <div class="gallery-item-status">${isCompleted ? '⭐ 100%' : 'Разблокировано'}</div>
      `;

      item.addEventListener('click', () => {
        this.audio.playUiClick();
        this.closeGallery();
        if (this.onSelectModelRequest) {
          this.onSelectModelRequest(model);
        }
      });

      this.galleryItemsGrid.appendChild(item);
    });
  }

  // ================= Shop Modal =================
  private openShop(): void {
    this.updateShopState();
    this.shopModal.classList.remove('hidden');
  }

  private closeShop(): void {
    this.shopModal.classList.add('hidden');
  }

  private updateShopState(): void {
    const hasGold = this.storage.getProgress().hasGoldSkin;
    if (hasGold) {
      this.goldSkinPriceText.textContent = 'Получено ✨';
      this.buyGoldSkinBtn.style.background = '#4a5568';
      this.buyGoldSkinBtn.style.cursor = 'default';
    } else {
      this.goldSkinPriceText.textContent = 'Купить (10,000 🪙)';
    }
  }
}
