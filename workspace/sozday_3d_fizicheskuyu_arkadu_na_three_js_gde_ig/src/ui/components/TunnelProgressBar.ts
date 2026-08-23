/**
 * TunnelProgressBar: Displays distance and remaining time to the target station.
 */

import { renderIcon } from '../icons';

export class TunnelProgressBar {
  private element: HTMLElement;
  private distanceEl: HTMLElement;
  private timeEl: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'gauge-box';

    const icon = document.createElement('span');
    icon.innerHTML = renderIcon('metroTrain');
    this.element.appendChild(icon);

    const info = document.createElement('div');
    info.style.display = 'flex';
    info.style.flexDirection = 'column';

    this.distanceEl = document.createElement('span');
    this.distanceEl.className = 'gauge-value tabular-nums';
    this.distanceEl.textContent = '850 м';
    info.appendChild(this.distanceEl);

    this.timeEl = document.createElement('span');
    this.timeEl.className = 'gauge-label tabular-nums';
    this.timeEl.textContent = '50 с';
    info.appendChild(this.timeEl);

    this.element.appendChild(info);
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public update(distanceMeters: number, timeLeftSec: number): void {
    this.distanceEl.textContent = `${distanceMeters} м`;
    this.timeEl.textContent = `${timeLeftSec} с`;
  }
}
