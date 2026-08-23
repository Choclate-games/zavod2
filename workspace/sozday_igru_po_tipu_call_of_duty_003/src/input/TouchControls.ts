export class TouchControls {
  public container: HTMLDivElement;
  public isFocusPressed = false;
  public onFireCallback?: () => void;
  public onZoomCallback?: (level: 4 | 8 | 16) => void;
  public onAimDeltaCallback?: (dx: number, dy: number) => void;
  public onPauseCallback?: () => void;

  private isDragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(parent: HTMLElement | null = null) {
    this.container = document.createElement('div');
    this.container.id = 'touch-controls-layer';
    this.container.className = 'ui-layer';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.justifyContent = 'space-between';
    this.container.style.zIndex = 'var(--z-touch)';

    const host = parent || document.getElementById('ui-root') || document.body;
    host.appendChild(this.container);

    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; width: 100%; pointer-events: none;">
        <div style="display: flex; gap: 8px; pointer-events: auto;">
          <button id="touch-zoom-4" class="btn" style="min-width: 64px; min-height: 64px; padding: 6px;">4X</button>
          <button id="touch-zoom-8" class="btn" style="min-width: 64px; min-height: 64px; padding: 6px;">8X</button>
          <button id="touch-zoom-16" class="btn" style="min-width: 64px; min-height: 64px; padding: 6px;">16X</button>
        </div>
        <button id="touch-btn-pause" class="btn" style="min-width: 64px; min-height: 64px; pointer-events: auto;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
        </button>
      </div>

      <div id="touch-aim-zone" style="flex: 1; width: 100%; pointer-events: auto; touch-action: none;"></div>

      <div style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%; pointer-events: none;">
        <button id="touch-btn-focus" class="btn btn-primary" style="min-width: 120px; min-height: 72px; pointer-events: auto; touch-action: none;">
          ФОКУС
        </button>
        <button id="touch-btn-fire" class="btn btn-danger" style="min-width: 120px; min-height: 72px; pointer-events: auto; touch-action: none;">
          ВЫСТРЕЛ
        </button>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const aimZone = this.container.querySelector('#touch-aim-zone') as HTMLElement;
    if (aimZone) {
      aimZone.addEventListener('pointerdown', (e: PointerEvent) => {
        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        try { aimZone.setPointerCapture(e.pointerId); } catch {}
      });

      aimZone.addEventListener('pointermove', (e: PointerEvent) => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        if (this.onAimDeltaCallback) {
          this.onAimDeltaCallback(dx, dy);
        }
      });

      const stopDrag = (e: PointerEvent) => {
        this.isDragging = false;
        try { aimZone.releasePointerCapture(e.pointerId); } catch {}
      };
      aimZone.addEventListener('pointerup', stopDrag);
      aimZone.addEventListener('pointercancel', stopDrag);
    }

    const focusBtn = this.container.querySelector('#touch-btn-focus') as HTMLElement;
    if (focusBtn) {
      focusBtn.addEventListener('pointerdown', (e: PointerEvent) => {
        this.isFocusPressed = true;
        try { focusBtn.setPointerCapture(e.pointerId); } catch {}
      });
      const releaseFocus = (e: PointerEvent) => {
        this.isFocusPressed = false;
        try { focusBtn.releasePointerCapture(e.pointerId); } catch {}
      };
      focusBtn.addEventListener('pointerup', releaseFocus);
      focusBtn.addEventListener('pointercancel', releaseFocus);
    }

    const fireBtn = this.container.querySelector('#touch-btn-fire') as HTMLElement;
    if (fireBtn) {
      fireBtn.addEventListener('pointerdown', () => {
        if (this.onFireCallback) this.onFireCallback();
      });
    }

    const z4 = this.container.querySelector('#touch-zoom-4');
    const z8 = this.container.querySelector('#touch-zoom-8');
    const z16 = this.container.querySelector('#touch-zoom-16');
    z4?.addEventListener('click', () => this.onZoomCallback?.(4));
    z8?.addEventListener('click', () => this.onZoomCallback?.(8));
    z16?.addEventListener('click', () => this.onZoomCallback?.(16));

    const pauseBtn = this.container.querySelector('#touch-btn-pause');
    pauseBtn?.addEventListener('click', () => this.onPauseCallback?.());
  }

  public show(): void {
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
    this.isFocusPressed = false;
    this.isDragging = false;
  }
}
