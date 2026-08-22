import { BaseScreen } from '../ScreenRouter';
import { Button } from '../components/Button';
import { ICONS } from '../icons';
import { events } from '../../core/EventBus';
import { storage } from '../../platform/StorageService';
import { platform } from '../../platform/PlaygamaService';
import { ui } from '../UiRoot';

export interface WeaponSkinDef {
  id: string;
  weaponId: string;
  name: string;
  rarity: 'Common' | 'Restricted' | 'Classified' | 'Covert';
  rarityColor: string;
  primaryColor: string;
  secondaryColor: string;
}

export const SKINS_CATALOG: WeaponSkinDef[] = [
  { id: 'ak47_default', weaponId: 'ak47', name: 'AK-47 Classic', rarity: 'Common', rarityColor: 'var(--color-text-muted)', primaryColor: 'var(--color-surface)', secondaryColor: 'var(--color-bg-dark)' },
  { id: 'ak47_desert_rebel', weaponId: 'ak47', name: 'AK-47 Desert Rebel', rarity: 'Classified', rarityColor: 'var(--color-sand-base)', primaryColor: 'var(--color-sand-base)', secondaryColor: 'var(--color-t)' },
  { id: 'ak47_neon_rider', weaponId: 'ak47', name: 'AK-47 Neon Rider', rarity: 'Covert', rarityColor: 'var(--color-c4-danger)', primaryColor: 'var(--color-c4-danger)', secondaryColor: 'var(--color-ct)' },
  { id: 'm4a4_default', weaponId: 'm4a4', name: 'M4A4 Default', rarity: 'Common', rarityColor: 'var(--color-text-muted)', primaryColor: 'var(--color-ct)', secondaryColor: 'var(--color-surface)' },
  { id: 'm4a4_howl', weaponId: 'm4a4', name: 'M4A4 Howl (WebGL)', rarity: 'Covert', rarityColor: 'var(--color-c4-danger)', primaryColor: 'var(--color-c4-danger)', secondaryColor: 'var(--color-primary-action)' },
  { id: 'awp_default', weaponId: 'awp', name: 'AWP Standard', rarity: 'Common', rarityColor: 'var(--color-text-muted)', primaryColor: 'var(--color-surface)', secondaryColor: 'var(--color-ct)' },
  { id: 'awp_dragon_lore', weaponId: 'awp', name: 'AWP Dragon Lore', rarity: 'Covert', rarityColor: 'var(--color-c4-danger)', primaryColor: 'var(--color-primary-action)', secondaryColor: 'var(--color-c4-danger)' },
  { id: 'deagle_default', weaponId: 'deagle', name: 'Desert Eagle Chrome', rarity: 'Common', rarityColor: 'var(--color-text-muted)', primaryColor: 'var(--color-text-muted)', secondaryColor: 'var(--color-surface)' },
  { id: 'deagle_blaze', weaponId: 'deagle', name: 'Desert Eagle Blaze', rarity: 'Classified', rarityColor: 'var(--color-t)', primaryColor: 'var(--color-surface)', secondaryColor: 'var(--color-primary-action)' },
];

export class ArsenalScreen implements BaseScreen {
  public readonly element: HTMLElement;
  private currentWeaponId = 'ak47';
  private selectedSkinId = 'ak47_default';

  private skinTitleText!: HTMLElement;
  private rarityBadgeText!: HTMLElement;
  private equipBtn!: Button;
  private caseUnlockBtn: Button | null = null;
  private skinCardsContainer!: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'screen';
    this.element.id = 'screen-arsenal';

    this.buildMarkup();
    ui.screenLayer.appendChild(this.element);
  }

  private buildMarkup(): void {
    // Zone 1: Identity
    const zoneIdentity = document.createElement('div');
    zoneIdentity.className = 'zone-identity';

    const title = document.createElement('h1');
    title.className = 'game-title';
    title.textContent = 'АРСЕНАЛ И СКИНЫ';

    const skinInfoCard = document.createElement('div');
    skinInfoCard.className = 'card-panel';
    skinInfoCard.style.cssText = 'display:inline-flex;align-items:center;gap:16px;margin-top:8px;padding:8px 16px;width:fit-content;';

    this.skinTitleText = document.createElement('span');
    this.skinTitleText.style.cssText = 'font-weight:700;font-size:1.2rem;text-transform:uppercase;';
    this.skinTitleText.textContent = 'AK-47 DESERT REBEL';

    this.rarityBadgeText = document.createElement('span');
    this.rarityBadgeText.style.cssText = 'font-weight:700;font-size:0.9rem;padding:2px 8px;border-radius:4px;border:1px solid var(--color-border);';
    this.rarityBadgeText.textContent = 'CLASSIFIED';
    this.rarityBadgeText.style.color = 'var(--color-primary-action)';

    skinInfoCard.appendChild(this.skinTitleText);
    skinInfoCard.appendChild(this.rarityBadgeText);

    zoneIdentity.appendChild(title);
    zoneIdentity.appendChild(skinInfoCard);
    this.element.appendChild(zoneIdentity);

    // Zone 2: Primary Action
    const zonePrimary = document.createElement('div');
    zonePrimary.className = 'zone-primary';

    this.equipBtn = new Button({
      label: 'ЭКИПИРОВАТЬ',
      variant: 'primary',
      onClick: () => this.equipCurrentSkin(),
    });
    zonePrimary.appendChild(this.equipBtn.element);

    if (platform.isRewardedSupported()) {
      this.caseUnlockBtn = new Button({
        label: 'ОТКРЫТЬ ОРУЖЕЙНЫЙ КЕЙС (REWARDED)',
        variant: 'default',
        icon: ICONS.CASE,
        onClick: () => {
          void platform.showRewarded('case_unlock', () => {
            this.unlockRandomSkin();
          });
        },
      });
      zonePrimary.appendChild(this.caseUnlockBtn.element);
    }

    this.element.appendChild(zonePrimary);

    // Zone 3: Secondary Row
    const zoneSecondary = document.createElement('div');
    zoneSecondary.className = 'zone-secondary';

    // Weapon category buttons
    const weaponTabs = document.createElement('div');
    weaponTabs.style.cssText = 'display:flex;gap:8px;';

    const weapons: Array<{ id: string; name: string }> = [
      { id: 'ak47', name: 'AK-47' },
      { id: 'm4a4', name: 'M4A4' },
      { id: 'awp', name: 'AWP' },
      { id: 'deagle', name: 'DEAGLE' },
    ];

    weapons.forEach((w) => {
      const btn = new Button({
        label: w.name,
        onClick: () => {
          this.currentWeaponId = w.id;
          this.refreshSkinCards();
        },
      });
      weaponTabs.appendChild(btn.element);
    });
    zoneSecondary.appendChild(weaponTabs);

    // Skin cards list
    this.skinCardsContainer = document.createElement('div');
    this.skinCardsContainer.style.cssText = 'display:flex;gap:12px;overflow-x:auto;max-width:480px;padding:4px;';
    zoneSecondary.appendChild(this.skinCardsContainer);

    // Back button
    const backBtn = new Button({
      label: 'НАЗАД В МЕНЮ',
      icon: ICONS.BACK,
      onClick: () => {
        events.emit('NAVIGATE_SCREEN', 'MainMenu');
        events.emit('GAME_STATE_CHANGED', 'MENU');
      },
    });
    zoneSecondary.appendChild(backBtn.element);

    this.element.appendChild(zoneSecondary);
  }

  private refreshSkinCards(): void {
    this.skinCardsContainer.innerHTML = '';
    const data = storage.getData();
    const filtered = SKINS_CATALOG.filter((s) => s.weaponId === this.currentWeaponId);

    filtered.forEach((skin) => {
      const card = document.createElement('button');
      card.className = 'btn';
      const isUnlocked = data.unlockedSkins.includes(skin.id);
      const isEquipped = data.equippedSkins[skin.weaponId] === skin.id;

      card.style.cssText = `min-height:54px;padding:0 12px;font-size:0.85rem;border-color:${skin.rarityColor};opacity:${isUnlocked ? 1 : 0.45};`;
      const statusText = isEquipped ? ' [В БОЮ]' : isUnlocked ? '' : ' [ЗАКРЫТО]';
      card.textContent = `${skin.name}${statusText}`;

      card.addEventListener('click', () => {
        this.selectSkin(skin);
      });

      this.skinCardsContainer.appendChild(card);
    });

    const first = filtered[0];
    if (first) {
      this.selectSkin(first);
    }
  }

  private selectSkin(skin: WeaponSkinDef): void {
    this.selectedSkinId = skin.id;
    this.skinTitleText.textContent = skin.name;
    this.rarityBadgeText.textContent = skin.rarity.toUpperCase();
    this.rarityBadgeText.style.color = skin.rarityColor;

    const data = storage.getData();
    const isUnlocked = data.unlockedSkins.includes(skin.id);
    const isEquipped = data.equippedSkins[skin.weaponId] === skin.id;

    if (isEquipped) {
      this.equipBtn.setLabel('ЭКИПИРОВАНО');
      this.equipBtn.setDisabled(true);
    } else if (isUnlocked) {
      this.equipBtn.setLabel('ЭКИПИРОВАТЬ');
      this.equipBtn.setDisabled(false);
    } else {
      this.equipBtn.setLabel('ЗАБЛОКИРОВАНО');
      this.equipBtn.setDisabled(true);
    }

    events.emit('EQUIP_SKIN', { weaponId: skin.weaponId, skinId: skin.id });
  }

  private equipCurrentSkin(): void {
    const data = storage.getData();
    data.equippedSkins[this.currentWeaponId] = this.selectedSkinId;
    storage.updateData({ equippedSkins: data.equippedSkins });
    this.refreshSkinCards();
  }

  private unlockRandomSkin(): void {
    const data = storage.getData();
    const locked = SKINS_CATALOG.filter((s) => !data.unlockedSkins.includes(s.id));
    if (locked.length > 0) {
      const awarded = locked[Math.floor(Math.random() * locked.length)];
      data.unlockedSkins.push(awarded.id);
      data.casesOpened++;
      storage.updateData({ unlockedSkins: data.unlockedSkins, casesOpened: data.casesOpened });
      this.refreshSkinCards();
      this.selectSkin(awarded);
    }
  }

  public show(): void {
    this.element.classList.add('active');
    this.refreshSkinCards();
  }

  public hide(): void {
    this.element.classList.remove('active');
  }
}
