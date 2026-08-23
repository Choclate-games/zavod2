/**
 * UiRoot: Top-level UI manager mounted into DOM.
 */

import { ScreenName, ScreenRouter } from './ScreenRouter';
import { TouchControls } from './TouchControls';

export class UiRoot {
  private container: HTMLElement;
  private router: ScreenRouter;
  private touchControls: TouchControls;

  constructor(
    rootElement: HTMLElement,
    callbacks: {
      onStart: () => void;
      onNextLevel: () => void;
      onRestart: () => void;
      onRevive: () => void;
      onGrip: () => void;
    }
  ) {
    this.container = rootElement;
    this.container.className = 'ui-layer';

    // Create Screen Router
    this.router = new ScreenRouter(this.container, callbacks);

    // Create and mount TouchControls directly into the root element
    this.touchControls = new TouchControls(this.container, callbacks.onGrip);
  }

  public getRouter(): ScreenRouter {
    return this.router;
  }

  public getTouchControls(): TouchControls {
    return this.touchControls;
  }

  public showScreen(name: ScreenName): void {
    this.router.show(name);
  }
}
