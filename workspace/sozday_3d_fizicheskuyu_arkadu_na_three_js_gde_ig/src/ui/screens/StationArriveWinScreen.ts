/**
 * StationArriveWinScreen: Victory screen upon reaching station destination.
 * 3-zone layout: Station header, preserved stack stats, next level and 2x tips buttons.
 */

import { AudioManager } from '../../audio/AudioManager';
import { PlaygamaService } from '../../platform/PlaygamaService';
import { StorageService } from '../../platform/StorageService';
import { createButton } from '../components/Button';
import { renderIcon } from '../icons';

export class StationArriveWinScreen {
  private element: HTMLElement;
  private statsPreservedEl: HTMLElement;
  private statsTipsEl: HTMLElement;
  private onNextCallback: () => void;
  private currentTips: number = 0;

  constructor(onNext: () => void) {
    this.onNextCallback = onNext;
    this.element = document.createElement('div');
    this.element.className = 'screen-container';

    // Zone 1: Header
    const header = document.createElement('div');
    header.className = 'screen-header-zone';

    const title = document.createElement('h1');
    title.className = 'metro-title';
    title.textContent = 'СТАНЦИЯ ДОСТИГНУТА!';
    header.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'metro-subtitle';
    subtitle.textContent = 'ГРУЗ УСПЕШНО ДОСТАВЛЕН';
    header.appendChild(subtitle);

    this.element.appendChild(header);

    // Zone 2: Content Stats Panel
    const content = document.createElement('div');
    content.className = 'screen-content-zone';

    const panel = document.createElement('div');
    panel.className = 'metro-panel';

    const row1 = document.createElement('div');
    row1.style.display = 'flex';
    row1.style.justifyContent = 'space-between';
    row1.style.marginBottom = 'var(--space-3)';

    const label1 = document.createElement('span');
    label1.textContent = 'Сохранность стопки:';
    label1.style.color = 'var(--color-text-muted)';
    row1.appendChild(label1);

    this.statsPreservedEl = document.createElement('span');
    this.statsPreservedEl.className = 'tabular-nums';
    this.statsPreservedEl.style.fontWeight = '700';
    this.statsPreservedEl.style.color = 'var(--color-success-win)';
    this.statsPreservedEl.textContent = '100%';
    row1.appendChild(this.statsPreservedEl);
    panel.appendChild(row1);

    const row2 = document.createElement('div');
    row2.style.display = 'flex';
    row2.style.justifyContent = 'space-between';

    const label2 = document.createElement('span');
    label2.textContent = 'Чаевые от заказчика:';
    label2.style.color = 'var(--color-text-muted)';
    row2.appendChild(label2);

    this.statsTipsEl = document.createElement('span');
    this.statsTipsEl.className = 'tabular-nums';
    this.statsTipsEl.style.fontWeight = '700';
    this.statsTipsEl.style.color = 'var(--color-primary-action)';
    this.statsTipsEl.textContent = '+150';
    row2.appendChild(this.statsTipsEl);
    panel.appendChild(row2);

    content.appendChild(panel);
    this.element.appendChild(content);

    // Zone 3: Action Buttons
    const actionZone = document.createElement('div');
    actionZone.className = 'screen-action-zone';

    const nextBtn = createButton({
      text: 'СЛЕДУЮЩИЙ ПЕРЕГОН',
      variant: 'primary',
      iconHtml: renderIcon('play'),
      onClick: () => {
        AudioManager.get().playSound('click');
        this.onNextCallback();
      }
    });
    actionZone.appendChild(nextBtn);

    const doubleBtn = createButton({
      text: 'УДВОИТЬ ЧАЕВЫЕ (2X)',
      variant: 'success',
      iconHtml: renderIcon('sparkles'),
      onClick: async () => {
        const rewarded = await PlaygamaService.get().showRewarded('double_tips');
        if (rewarded && this.currentTips > 0) {
          StorageService.get().addCoins(this.currentTips);
          this.statsTipsEl.textContent = `+${this.currentTips * 2}`;
          doubleBtn.style.display = 'none';
        }
      }
    });
    actionZone.appendChild(doubleBtn);

    this.element.appendChild(actionZone);
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setResults(preservedPercent: number, tipsEarned: number): void {
    this.currentTips = tipsEarned;
    this.statsPreservedEl.textContent = `${preservedPercent}%`;
    this.statsTipsEl.textContent = `+${tipsEarned}`;
  }

  public show(): void {
    this.element.classList.remove('hidden');
  }

  public hide(): void {
    this.element.classList.add('hidden');
  }
}
