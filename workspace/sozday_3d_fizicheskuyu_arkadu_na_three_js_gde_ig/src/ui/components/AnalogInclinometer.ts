/**
 * AnalogInclinometer: Visualizes the compound stack tilt angle.
 */

import { renderIcon } from '../icons';

export class AnalogInclinometer {
  private element: HTMLElement;
  private pointerEl: HTMLElement;
  private textEl: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'inclinometer-widget';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = 'var(--space-2)';

    const icon = document.createElement('span');
    icon.innerHTML = renderIcon('inclinometer');
    header.appendChild(icon);

    this.textEl = document.createElement('span');
    this.textEl.className = 'gauge-value tabular-nums';
    this.textEl.textContent = '0.0°';
    header.appendChild(this.textEl);

    this.element.appendChild(header);

    const barBg = document.createElement('div');
    barBg.className = 'inclinometer-bar-bg';

    this.pointerEl = document.createElement('div');
    this.pointerEl.className = 'inclinometer-pointer';
    this.pointerEl.style.left = '50%';
    barBg.appendChild(this.pointerEl);

    this.element.appendChild(barBg);
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public update(angleDeg: number, isCritical: boolean): void {
    this.textEl.textContent = `${angleDeg.toFixed(1)}°`;

    // Map -38..+38 to 0%..100%
    const norm = Math.max(0, Math.min(100, (angleDeg / 38) * 50 + 50));
    this.pointerEl.style.left = `${norm}%`;

    if (isCritical) {
      this.pointerEl.classList.add('danger');
    } else {
      this.pointerEl.classList.remove('danger');
    }
  }
}
