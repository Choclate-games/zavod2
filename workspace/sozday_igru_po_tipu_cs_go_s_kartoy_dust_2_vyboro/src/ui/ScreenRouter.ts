import { events } from '../core/EventBus';

export interface BaseScreen {
  readonly element: HTMLElement;
  show(): void;
  hide(): void;
}

export type ScreenId = 'MainMenu' | 'GameplayHUD' | 'RoundEndModal' | 'MatchResultScreen' | 'ArsenalScreen' | 'PauseModal';

export class ScreenRouter {
  private static instance: ScreenRouter;
  private screens: Map<ScreenId, BaseScreen> = new Map();
  private currentScreenId: ScreenId | null = null;

  private constructor() {
    events.on('NAVIGATE_SCREEN', (id) => this.navigateTo(id));
  }

  public static getInstance(): ScreenRouter {
    if (!ScreenRouter.instance) {
      ScreenRouter.instance = new ScreenRouter();
    }
    return ScreenRouter.instance;
  }

  public register(id: ScreenId, screen: BaseScreen): void {
    this.screens.set(id, screen);
  }

  public navigateTo(id: ScreenId): void {
    if (this.currentScreenId === id) return;

    if (this.currentScreenId) {
      const prev = this.screens.get(this.currentScreenId);
      if (prev) {
        prev.hide();
      }
    }

    this.currentScreenId = id;
    const next = this.screens.get(id);
    if (next) {
      next.show();
    }
  }

  public getCurrentScreen(): ScreenId | null {
    return this.currentScreenId;
  }
}

export const router = ScreenRouter.getInstance();
