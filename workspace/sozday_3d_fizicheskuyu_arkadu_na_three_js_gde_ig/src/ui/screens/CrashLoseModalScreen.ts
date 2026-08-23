/**
 * CrashLoseModalScreen: Defeat / Crash modal screen.
 * 3-zone layout with failure reason, Rewarded revive button, and restart button.
 */

import { AudioManager } from '../../audio/AudioManager';
import { PlaygamaService } from '../../platform/PlaygamaService';
import { createButton } from '../components/Button';
import { renderIcon } from '../icons';

export class CrashLoseModalScreen {
  private element: HTMLElement;
  private reasonEl: HTMLElement;
  private onRestartCallback: () => void;
  private onReviveCallback: () => void;

  constructor(onRestart: () => void, onRevive: () => void) {
    this.onRestartCallback = onRestart;
    this.onReviveCallback = onRevive;
    this.element = document.createElement('div');
    this.element.className = 'screen-container';

    // Zone 1: Header
    const header = document.createElement('div');
    header.className = 'screen-header-zone';

    const title = document.createElement('h1');
    title.className = 'metro-title';
    title.style.color = 'var(--color-danger-warning)';
    title.textContent = 'ГРУЗ РАЗБИТ!';
    header.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'metro-subtitle';
    subtitle.textContent = 'СХОД С БАЛАНСА В ПЕРЕГОНЕ';
    header.appendChild(subtitle);

    this.element.appendChild(header);

    // Zone 2: Content
    const content = document.createElement('div');
    content.className = 'screen-content-zone';

    const panel = document.createElement('div');
    panel.className = 'metro-panel';

    const label = document.createElement('p');
    label.style.fontSize = 'var(--font-sm)';
    label.style.color = 'var(--color-text-muted)';
    label.textContent = 'Причина аварии:';
    panel.appendChild(label);

    this.reasonEl = document.createElement('p');
    this.reasonEl.style.fontSize = 'var(--font-md)';
    this.reasonEl.style.fontWeight = '700';
    this.reasonEl.style.color = 'var(--color-text-main)';
    this.reasonEl.style.marginTop = 'var(--space-2)';
    this.reasonEl.textContent = 'Падение хрупкого предмета';
    panel.appendChild(this.reasonEl);

    content.appendChild(panel);
    this.element.appendChild(content);

    // Zone 3: Action Buttons
    const actionZone = document.createElement('div');
    actionZone.className = 'screen-action-zone';

    const reviveBtn = createButton({
      text: 'СТРАХОВКА ГРУЗА',
      variant: 'primary',
      iconHtml: renderIcon('sparkles'),
      onClick: async () => {
        const rewarded = await PlaygamaService.get().showRewarded('revive_catch');
        if (rewarded) {
          this.onReviveCallback();
        }
      }
    });
    actionZone.appendChild(reviveBtn);

    const restartBtn = createButton({
      text: 'ЗАНОВО',
      variant: 'secondary',
      iconHtml: renderIcon('restart'),
      onClick: () => {
        AudioManager.get().playSound('click');
        this.onRestartCallback();
      }
    });
    actionZone.appendChild(restartBtn);

    this.element.appendChild(actionZone);
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setReason(reason: string): void {
    this.reasonEl.textContent = reason;
  }

  public show(): void {
    this.element.classList.remove('hidden');
  }

  public hide(): void {
    this.element.classList.add('hidden');
  }
}
