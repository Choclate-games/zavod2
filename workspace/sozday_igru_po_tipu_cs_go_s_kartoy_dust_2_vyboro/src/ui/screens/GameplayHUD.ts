import { BaseScreen } from '../ScreenRouter';
import { hud } from '../Hud';
import { touchControls } from '../TouchControls';
import { ui } from '../UiRoot';

export class GameplayHUDScreen implements BaseScreen {
  public readonly element: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'screen';
    this.element.id = 'screen-gameplay-hud';
    ui.screenLayer.appendChild(this.element);
  }

  public show(): void {
    this.element.classList.add('active');
    hud.show();
    touchControls.show();
  }

  public hide(): void {
    this.element.classList.remove('active');
    hud.hide();
    touchControls.hide();
  }
}
