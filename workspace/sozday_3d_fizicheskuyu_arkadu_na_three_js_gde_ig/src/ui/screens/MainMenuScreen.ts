/**
 * MainMenuScreen: Main menu screen with contract selection and play button.
 * Adheres strictly to 3-zone layout and >=96px primary action button.
 */

import { AudioManager } from '../../audio/AudioManager';
import { StorageService } from '../../platform/StorageService';
import { createButton } from '../components/Button';
import { renderIcon } from '../icons';

export class MainMenuScreen {
  private element: HTMLElement;
  private coinsValueEl: HTMLElement;
  private onStartCallback: () => void;

  constructor(onStart: () => void) {
    this.onStartCallback = onStart;
    this.element = document.createElement('div');
    this.element.className = 'screen-container';

    // Zone 1: Header / Title
    const header = document.createElement('div');
    header.className = 'screen-header-zone';

    const title = document.createElement('h1');
    title.className = 'metro-title';
    title.textContent = 'МЕТРО-БАЛАНСИР';
    header.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'metro-subtitle';
    subtitle.textContent = 'ЧАС ПИК В ПОДЗЕМКЕ';
    header.appendChild(subtitle);

    const badge = document.createElement('div');
    badge.className = 'metro-badge';
    badge.innerHTML = `${renderIcon('coins')} <span class="tabular-nums" id="menu-coins">0</span> ЧАЕВЫХ`;
    this.coinsValueEl = badge.querySelector('#menu-coins') as HTMLElement;
    header.appendChild(badge);

    this.element.appendChild(header);

    // Zone 2: Content / Station Contract Card
    const content = document.createElement('div');
    content.className = 'screen-content-zone';

    const panel = document.createElement('div');
    panel.className = 'metro-panel';

    const cardTitle = document.createElement('h3');
    cardTitle.style.fontSize = 'var(--font-md)';
    cardTitle.style.fontWeight = '700';
    cardTitle.style.color = 'var(--color-primary-action)';
    cardTitle.style.marginBottom = 'var(--space-2)';
    cardTitle.textContent = 'КОНТРАКТ: ПЕРЕГОН №1';
    panel.appendChild(cardTitle);

    const desc = document.createElement('p');
    desc.style.fontSize = 'var(--font-sm)';
    desc.style.color = 'var(--color-text-muted)';
    desc.style.lineHeight = '1.4';
    desc.textContent = 'Доставьте хрупкий груз через скоростные виражи туннеля до следующей станции, не уронив телевизор и аквариум.';
    panel.appendChild(desc);

    content.appendChild(panel);
    this.element.appendChild(content);

    // Zone 3: Action Buttons
    const actionZone = document.createElement('div');
    actionZone.className = 'screen-action-zone';

    const playBtn = createButton({
      text: 'В РЕЙС',
      variant: 'primary',
      iconHtml: renderIcon('play'),
      onClick: () => {
        AudioManager.get().playSound('click');
        this.onStartCallback();
      }
    });
    actionZone.appendChild(playBtn);

    const row = document.createElement('div');
    row.className = 'metro-btn-row';

    const soundBtn = createButton({
      text: 'ЗВУК',
      variant: 'secondary',
      iconHtml: renderIcon('soundOn'),
      onClick: () => {
        const active = AudioManager.get().toggleMute();
        soundBtn.querySelector('.btn-icon')!.innerHTML = renderIcon(active ? 'soundOn' : 'soundOff');
      }
    });
    row.appendChild(soundBtn);

    actionZone.appendChild(row);
    this.element.appendChild(actionZone);
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public refresh(): void {
    const data = StorageService.get().getData();
    if (this.coinsValueEl) {
      this.coinsValueEl.textContent = `${data.coins}`;
    }
  }

  public show(): void {
    this.refresh();
    this.element.classList.remove('hidden');
  }

  public hide(): void {
    this.element.classList.add('hidden');
  }
}
