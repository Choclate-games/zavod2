/**
 * GameplayHudScreen: Screen wrapper for in-game HUD.
 */

import { Hud } from '../Hud';

export class GameplayHudScreen {
  private element: HTMLElement;
  private hud: Hud;

  constructor(onGrip: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'screen-container';
    this.element.style.padding = '0';

    this.hud = new Hud(onGrip);
    this.element.appendChild(this.hud.getElement());
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public getHud(): Hud {
    return this.hud;
  }

  public show(): void {
    this.element.classList.remove('hidden');
  }

  public hide(): void {
    this.element.classList.add('hidden');
  }
}
