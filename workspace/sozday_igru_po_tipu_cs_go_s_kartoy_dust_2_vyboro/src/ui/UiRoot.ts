export class UiRoot {
  private static instance: UiRoot;
  public readonly container: HTMLElement;
  public readonly screenLayer: HTMLElement;
  public readonly hudLayer: HTMLElement;
  public readonly controlsLayer: HTMLElement;
  public readonly modalLayer: HTMLElement;

  private constructor() {
    const root = document.getElementById('ui-root');
    if (!root) {
      throw new Error('Missing #ui-root container');
    }
    this.container = root;

    this.hudLayer = document.createElement('div');
    this.hudLayer.className = 'hud-container';

    this.controlsLayer = document.createElement('div');
    this.controlsLayer.className = 'touch-controls-layer';

    this.screenLayer = document.createElement('div');
    this.screenLayer.className = 'screen-container';

    this.modalLayer = document.createElement('div');
    this.modalLayer.className = 'ui-layer';

    this.container.appendChild(this.hudLayer);
    this.container.appendChild(this.controlsLayer);
    this.container.appendChild(this.screenLayer);
    this.container.appendChild(this.modalLayer);

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.handleResize);
    }
    this.handleResize();
  }

  public static getInstance(): UiRoot {
    if (!UiRoot.instance) {
      UiRoot.instance = new UiRoot();
    }
    return UiRoot.instance;
  }

  public handleResize(): void {
    const width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    document.documentElement.style.setProperty('--vp-w', `${width}px`);
    document.documentElement.style.setProperty('--vp-h', `${height}px`);

    const baseScale = Math.min(width / 960, height / 540);
    const clampedScale = Math.max(0.75, Math.min(1.3, baseScale));
    document.documentElement.style.setProperty('--ui-scale', clampedScale.toFixed(2));
  }

  public setBannerHeight(heightPx: number): void {
    document.documentElement.style.setProperty('--banner-height', `${heightPx}px`);
    this.handleResize();
  }
}

export const ui = UiRoot.getInstance();
