/**
 * SpeedGauge: Displays current train speed in km/h.
 */

import { renderIcon } from '../icons';

export class SpeedGauge {
  private element: HTMLElement;
  private valueEl: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'gauge-box';

    const icon = document.createElement('span');
    icon.innerHTML = renderIcon('speedometer');
    this.element.appendChild(icon);

    const info = document.createElement('div');
    info.style.display = 'flex';
    info.style.flexDirection = 'column';

    this.valueEl = document.createElement('span');
    this.valueEl.className = 'gauge-value tabular-nums';
    this.valueEl.textContent = '0';
    info.appendChild(this.valueEl);

    const label = document.createElement('span');
    label.className = 'gauge-label';
    label.textContent = 'км/ч';
    info.appendChild(label);

    this.element.appendChild(info);
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public update(speedKmH: number): void {
    this.valueEl.textContent = `${speedKmH}`;
  }
}
