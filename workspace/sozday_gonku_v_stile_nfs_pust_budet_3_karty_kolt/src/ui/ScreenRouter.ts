export interface BaseScreen {
  readonly root: HTMLElement;
  show(): void;
  hide(): void;
}

export type ScreenName = 'MENU' | 'TRACK_SELECT' | 'RACING' | 'PAUSED' | 'RESULTS';

export class ScreenRouter {
  private screens = new Map<ScreenName, BaseScreen>();
  private currentScreen: ScreenName | null = null;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  register(name: ScreenName, screen: BaseScreen): void {
    this.screens.set(name, screen);
    screen.root.style.display = 'none';
    this.container.appendChild(screen.root);
  }

  go(name: ScreenName): void {
    if (this.currentScreen === name) return;

    if (this.currentScreen) {
      const prev = this.screens.get(this.currentScreen);
      if (prev) {
        prev.hide();
        prev.root.style.display = 'none';
      }
    }

    const next = this.screens.get(name);
    if (next) {
      this.currentScreen = name;
      next.root.style.display = 'flex';
      next.show();
    }
  }

  getCurrentScreen(): ScreenName | null {
    return this.currentScreen;
  }
}
