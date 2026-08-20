import { EventBus } from '../core/EventBus';
import { StorageService } from '../platform/StorageService';
import { PlaygamaService } from '../platform/PlaygamaService';
import { AudioManager } from '../audio/AudioManager';
import { TouchControls } from './TouchControls';
import { PerkCard, WeaponType } from '../types';

export class UIManager {
  private static instance: UIManager;
  public touch: TouchControls;
  private bus: EventBus;
  private storage: StorageService;
  private playgama: PlaygamaService;
  private audio: AudioManager;

  // DOM containers
  private hudContainer!: HTMLElement;
  private menuContainer!: HTMLElement;
  private workshopContainer!: HTMLElement;
  private upgradeModalContainer!: HTMLElement;
  private pauseModalContainer!: HTMLElement;
  private gameOverContainer!: HTMLElement;
  private victoryContainer!: HTMLElement;

  // HUD elements
  private hpBarFill!: HTMLElement;
  private hpText!: HTMLElement;
  private shieldBarFill!: HTMLElement;
  private sectorText!: HTMLElement;
  private enemiesText!: HTMLElement;
  private scoreText!: HTMLElement;
  private scrapText!: HTMLElement;
  private weaponNameText!: HTMLElement;
  private ammoText!: HTMLElement;
  private trickshotBadge!: HTMLElement;
  private comboBadge!: HTMLElement;
  private comboFill!: HTMLElement;
  private kickCooldownBar!: HTMLElement;

  // Floating text overlay
  private floatingOverlay!: HTMLElement;

  private constructor() {
    this.bus = EventBus.getInstance();
    this.storage = StorageService.getInstance();
    this.playgama = PlaygamaService.getInstance();
    this.audio = AudioManager.getInstance();
    this.touch = new TouchControls();

    this.initDOM();
    this.bindEvents();
  }

  public static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }

  private initDOM(): void {
    // 1. HUD Layer
    this.hudContainer = document.getElementById('gameplay-hud')!;
    this.hpBarFill = document.getElementById('hud-hp-fill')!;
    this.hpText = document.getElementById('hud-hp-text')!;
    this.shieldBarFill = document.getElementById('hud-shield-fill')!;
    this.sectorText = document.getElementById('hud-sector-text')!;
    this.enemiesText = document.getElementById('hud-enemies-text')!;
    this.scoreText = document.getElementById('hud-score-text')!;
    this.scrapText = document.getElementById('hud-scrap-text')!;
    this.weaponNameText = document.getElementById('hud-weapon-name')!;
    this.ammoText = document.getElementById('hud-ammo-text')!;
    this.trickshotBadge = document.getElementById('hud-trickshot-badge')!;
    this.comboBadge = document.getElementById('hud-combo-badge')!;
    this.comboFill = document.getElementById('hud-combo-fill')!;
    this.kickCooldownBar = document.getElementById('hud-kick-bar')!;

    // 2. Modals & Screens
    this.menuContainer = document.getElementById('screen-main-menu')!;
    this.workshopContainer = document.getElementById('modal-workshop')!;
    this.upgradeModalContainer = document.getElementById('modal-upgrade-draft')!;
    this.pauseModalContainer = document.getElementById('modal-pause')!;
    this.gameOverContainer = document.getElementById('modal-game-over')!;
    this.victoryContainer = document.getElementById('modal-victory')!;
    this.floatingOverlay = document.getElementById('floating-text-layer')!;
  }

  private bindEvents(): void {
    // HUD pause button
    document.getElementById('btn-hud-pause')?.addEventListener('click', () => {
      this.bus.emit('game:stateChanged', { from: 'PLAYING', to: 'PAUSED' });
    });

    // Sound toggle buttons
    document.querySelectorAll('.btn-sound-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const isMuted = this.audio.toggleMute();
        this.updateSoundButtonLabels(isMuted);
      });
    });

    // Floating text events
    this.bus.on('ui:floatingText', (data) => {
      this.showFloatingText(data.text, data.color, data.scale);
    });

    // Combo updates
    this.bus.on('combo:updated', ({ streak, multiplier, timeLeftRatio }) => {
      if (streak > 1) {
        this.comboBadge.style.display = 'block';
        this.comboBadge.innerText = `COMBO x${multiplier.toFixed(1)}!`;
        this.comboFill.style.width = `${timeLeftRatio * 100}%`;
      } else {
        this.comboBadge.style.display = 'none';
      }
    });
  }

  public updateSoundButtonLabels(isMuted: boolean): void {
    document.querySelectorAll('.btn-sound-toggle').forEach((btn) => {
      btn.innerHTML = isMuted ? '🔇 ЗВУК: ВЫКЛ' : '🔊 ЗВУК: ВКЛ';
    });
  }

  public showMainMenu(highScore: number, scrap: number): void {
    this.hideAllScreens();
    this.menuContainer.style.display = 'flex';
    document.getElementById('menu-highscore')!.innerText = `РЕКОРД: ${highScore}`;
    document.getElementById('menu-scrap')!.innerText = `⚙️ ШЕСТЕРНИ: ${scrap}`;
    this.touch.setVisible(false);
  }

  public showWorkshop(onClose: () => void): void {
    this.workshopContainer.style.display = 'flex';
    this.renderWorkshopUpgrades();

    document.getElementById('btn-close-workshop')!.onclick = () => {
      this.workshopContainer.style.display = 'none';
      onClose();
    };
  }

  private renderWorkshopUpgrades(): void {
    const save = this.storage.getSave();
    const list = document.getElementById('workshop-upgrades-list')!;
    list.innerHTML = '';

    const upgrades = [
      { key: 'bootsTier', name: 'Тяжелые армейские берцы', desc: '+Урон пинка и скорость отката', costBase: 40 },
      { key: 'magnetTier', name: 'Магнитные перчатки', desc: '+Радиус перехвата оружия в воздухе', costBase: 35 },
      { key: 'adrenalineTier', name: 'Адреналиновый инжектор', desc: '+Слоумо при низком здоровье', costBase: 50 },
      { key: 'armorTier', name: 'Штурмовой кевлар', desc: '+Постоянная броня и очки щита', costBase: 45 },
      { key: 'slideTier', name: 'Гидравлические слайдеры', desc: '+Скорость и дистанция подката', costBase: 30 },
    ];

    document.getElementById('workshop-scrap-count')!.innerText = `⚙️ ШЕСТЕРНИ: ${save.scrapCurrency}`;

    upgrades.forEach((u) => {
      const tier = (save.unlockedUpgrades as any)[u.key] || 0;
      const cost = Math.floor(u.costBase * Math.pow(1.5, tier));
      const isMax = tier >= 5;

      const item = document.createElement('div');
      item.className = 'workshop-item';
      item.innerHTML = `
        <div class="workshop-item-info">
          <div class="workshop-item-title">${u.name} <span class="badge-tier">УР. ${tier}/5</span></div>
          <div class="workshop-item-desc">${u.desc}</div>
        </div>
        <button class="btn-workshop-buy ${save.scrapCurrency < cost || isMax ? 'disabled' : ''}" ${isMax ? 'disabled' : ''}>
          ${isMax ? 'МАКС' : `КУПИТЬ ⚙️ ${cost}`}
        </button>
      `;

      const buyBtn = item.querySelector('.btn-workshop-buy') as HTMLButtonElement;
      if (!isMax) {
        buyBtn.onclick = () => {
          if (save.scrapCurrency >= cost) {
            this.storage.updateSave((s) => {
              s.scrapCurrency -= cost;
              (s.unlockedUpgrades as any)[u.key] = tier + 1;
            });
            this.audio.playUpgradeFanfare();
            this.renderWorkshopUpgrades();
          }
        };
      }

      list.appendChild(item);
    });
  }

  public showHud(): void {
    this.hideAllScreens();
    this.hudContainer.style.display = 'block';
    this.touch.setVisible(true);
  }

  public updateHud(
    hp: number,
    maxHp: number,
    shield: number,
    maxShield: number,
    score: number,
    scrap: number,
    stage: number,
    room: number,
    totalRooms: number,
    enemiesLeft: number,
    weapon: WeaponType,
    ammo: number,
    isTrickshot: boolean,
    kickCooldownRatio: number
  ): void {
    this.hpBarFill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    this.hpText.innerText = `${Math.ceil(hp)} / ${maxHp}`;
    this.shieldBarFill.style.width = `${Math.max(0, (shield / maxShield) * 100)}%`;

    this.sectorText.innerText = `СЕКТОР ${stage} — КОМНАТА ${room + 1}/${totalRooms}`;
    this.enemiesText.innerText = `ВРАГИ: ${enemiesLeft}`;
    this.scoreText.innerText = `ОЧКИ: ${score}`;
    this.scrapText.innerText = `⚙️ ${scrap}`;

    this.weaponNameText.innerText = weapon;
    this.ammoText.innerText = `${ammo}`;
    this.trickshotBadge.style.display = isTrickshot ? 'block' : 'none';

    this.kickCooldownBar.style.width = `${Math.min(100, (1 - kickCooldownRatio) * 100)}%`;
  }

  public showUpgradeDraft(cards: PerkCard[], onSelect: (card: PerkCard) => void, onReroll: () => void): void {
    this.upgradeModalContainer.style.display = 'flex';
    this.touch.setVisible(false);

    const cardsContainer = document.getElementById('draft-cards-container')!;
    cardsContainer.innerHTML = '';

    cards.forEach((card) => {
      const cardEl = document.createElement('div');
      cardEl.className = `upgrade-card rarity-${card.rarity.toLowerCase()}`;
      cardEl.innerHTML = `
        <div class="card-rarity-badge">${card.rarity}</div>
        <div class="card-icon">${card.icon}</div>
        <div class="card-title">${card.title}</div>
        <div class="card-tag">[${card.tag}]</div>
        <div class="card-desc">${card.description}</div>
      `;

      cardEl.onclick = () => {
        this.upgradeModalContainer.style.display = 'none';
        this.audio.playUpgradeFanfare();
        onSelect(card);
      };

      cardsContainer.appendChild(cardEl);
    });

    const btnReroll = document.getElementById('btn-reroll-cards')!;
    const isRewardedSupported = this.playgama.isRewardedAdSupported();
    btnReroll.style.display = isRewardedSupported ? 'inline-block' : 'none';
    btnReroll.onclick = async () => {
      const success = await this.playgama.showRewarded('free_card_reroll');
      if (success) {
        onReroll();
      }
    };
  }

  public showPause(onResume: () => void, onRestart: () => void, onMenu: () => void): void {
    this.pauseModalContainer.style.display = 'flex';
    this.touch.setVisible(false);

    document.getElementById('btn-pause-resume')!.onclick = () => {
      this.pauseModalContainer.style.display = 'none';
      onResume();
    };
    document.getElementById('btn-pause-restart')!.onclick = () => {
      this.pauseModalContainer.style.display = 'none';
      onRestart();
    };
    document.getElementById('btn-pause-menu')!.onclick = () => {
      this.pauseModalContainer.style.display = 'none';
      onMenu();
    };
  }

  public showGameOver(
    stats: { score: number; scrap: number; kills: number; wallSplats: number; sector: number },
    onRevive: () => void,
    onDoubleScrap: () => void,
    onRestart: () => void,
    onMenu: () => void
  ): void {
    this.hideAllScreens();
    this.gameOverContainer.style.display = 'flex';
    this.touch.setVisible(false);

    document.getElementById('go-score')!.innerText = `Очки: ${stats.score}`;
    document.getElementById('go-scrap')!.innerText = `⚙️ Шестеренки: ${stats.scrap}`;
    document.getElementById('go-kills')!.innerText = `Уничтожено врагов: ${stats.kills}`;
    document.getElementById('go-splats')!.innerText = `Сплэт-ударов о стены: ${stats.wallSplats}`;
    document.getElementById('go-sector')!.innerText = `Достигнут сектор: ${stats.sector}`;

    const btnRevive = document.getElementById('btn-go-revive')!;
    const btnDouble = document.getElementById('btn-go-double')!;
    const isRewarded = this.playgama.isRewardedAdSupported();

    btnRevive.style.display = isRewarded ? 'inline-block' : 'none';
    btnDouble.style.display = isRewarded ? 'inline-block' : 'none';

    btnRevive.onclick = async () => {
      const rewarded = await this.playgama.showRewarded('revive_run');
      if (rewarded) {
        this.gameOverContainer.style.display = 'none';
        onRevive();
      }
    };

    btnDouble.onclick = async () => {
      const rewarded = await this.playgama.showRewarded('double_gold_run');
      if (rewarded) {
        btnDouble.style.display = 'none';
        onDoubleScrap();
      }
    };

    document.getElementById('btn-go-restart')!.onclick = () => {
      this.playgama.showInterstitial();
      onRestart();
    };

    document.getElementById('btn-go-menu')!.onclick = () => {
      this.playgama.showInterstitial();
      onMenu();
    };
  }

  public showVictory(
    stats: { score: number; scrap: number },
    onRestart: () => void,
    onMenu: () => void
  ): void {
    this.hideAllScreens();
    this.victoryContainer.style.display = 'flex';
    this.touch.setVisible(false);

    document.getElementById('vic-score')!.innerText = `Итоговые очки: ${stats.score}`;
    document.getElementById('vic-scrap')!.innerText = `Добыто шестерней: ${stats.scrap}`;

    document.getElementById('btn-vic-restart')!.onclick = () => {
      this.playgama.showInterstitial();
      onRestart();
    };
    document.getElementById('btn-vic-menu')!.onclick = () => {
      this.playgama.showInterstitial();
      onMenu();
    };
  }

  public hideAllScreens(): void {
    this.hudContainer.style.display = 'none';
    this.menuContainer.style.display = 'none';
    this.workshopContainer.style.display = 'none';
    this.upgradeModalContainer.style.display = 'none';
    this.pauseModalContainer.style.display = 'none';
    this.gameOverContainer.style.display = 'none';
    this.victoryContainer.style.display = 'none';
    this.touch.setVisible(false);
  }

  private showFloatingText(text: string, color: string, scale: number): void {
    const el = document.createElement('div');
    el.className = 'floating-damage-text';
    el.innerText = text;
    el.style.color = color;
    el.style.transform = `scale(${scale})`;
    el.style.left = `${window.innerWidth * 0.5 + (Math.random() - 0.5) * 120}px`;
    el.style.top = `${window.innerHeight * 0.45 + (Math.random() - 0.5) * 60}px`;

    this.floatingOverlay.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, 1100);
  }
}
