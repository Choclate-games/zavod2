import { ScreenRouter } from './ScreenRouter';

export class UiRoot {
  private static instance: UiRoot;
  public rootElement: HTMLElement;
  public router: ScreenRouter;

  public static get(): UiRoot {
    if (!UiRoot.instance) {
      UiRoot.instance = new UiRoot();
    }
    return UiRoot.instance;
  }

  constructor() {
    const el = document.getElementById('ui-root');
    if (!el) {
      this.rootElement = document.createElement('div');
      this.rootElement.id = 'ui-root';
      document.body.appendChild(this.rootElement);
    } else {
      this.rootElement = el;
    }

    this.router = new ScreenRouter(
      () => this.onStartMatchCallback?.(),
      () => this.onRematchCallback?.()
    );
    this.router.mount(this.rootElement);

    this.measureViewport();
    window.addEventListener('resize', () => this.measureViewport());
  }

  public onStartMatchCallback: (() => void) | null = null;
  public onRematchCallback: (() => void) | null = null;

  public measureViewport(): void {
    if (window.visualViewport) {
      const scale = Math.min(1.0, window.visualViewport.width / 960);
      document.documentElement.style.setProperty('--ui-scale', scale.toFixed(2));
    }
  }
}