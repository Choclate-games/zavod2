/**
 * EmergencyGripButton: Virtual touch button for emergency hand grip.
 */

import { renderIcon } from '../icons';

export class EmergencyGripButton {
  private element: HTMLButtonElement;
  private progressEl: HTMLElement;
  private onClickCallback: () => void;

  constructor(onClick: () => void) {
    this.onClickCallback = onClick;
    this.element = document.createElement('button');
    this.element.type = 'button';
    this.element.className = 'grip-btn';

    this.progressEl = document.createElement('div');
    this.progressEl.className = 'grip-btn-progress';
    this.element.appendChild(this.progressEl);

    const icon = document.createElement('span');
    icon.innerHTML = renderIcon('handGrip');
    this.element.appendChild(icon);

    const label = document.createElement('span');
    label.style.fontSize = 'var(--font-xs)';
    label.style.fontWeight = '800';
    label.style.letterSpacing = '0.04em';
    label.textContent = 'ХВАТ';
    this.element.appendChild(label);

    this.element.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onClickCallback();
    });
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public update(cooldown01: number, isReady: boolean): void {
    this.progressEl.style.height = `${(1 - cooldown01) * 100}%`;
    if (isReady) {
      this.element.classList.remove('cooldown');
    } else {
      this.element.classList.add('cooldown');
    }
  }
}
