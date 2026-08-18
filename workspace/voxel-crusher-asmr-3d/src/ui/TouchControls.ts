import { EventBus } from '../core/EventBus';

export class TouchControls {
  private eventBus: EventBus;
  private activePointers = new Set<number>();
  private isEnabled = true;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupPointerListeners();
    this.setupKeyboardListeners();
    this.setupGestureSuppression();
  }

  private setupPointerListeners(): void {
    const container = document.getElementById('game-container') || document.body;

    container.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!this.isEnabled) return;
      this.activePointers.add(e.pointerId);

      this.eventBus.emit('tap:registered', {
        clientX: e.clientX,
        clientY: e.clientY
      });
    }, { passive: true });

    const handlePointerRelease = (e: PointerEvent) => {
      this.activePointers.delete(e.pointerId);
    };

    window.addEventListener('pointerup', handlePointerRelease, { passive: true });
    window.addEventListener('pointercancel', handlePointerRelease, { passive: true });
    window.addEventListener('lostpointercapture', handlePointerRelease as any, { passive: true });

    // Reset on window blur or tab visibility switch
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.reset();
    });
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.isEnabled) return;

      if (e.code === 'Space' || e.code === 'KeyJ') {
        e.preventDefault();
        this.eventBus.emit('tap:registered', {
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2
        });
      }
    });
  }

  private setupGestureSuppression(): void {
    // Prevent default context menu, drag and pull-to-refresh
    window.addEventListener('contextmenu', (e) => e.preventDefault(), { capture: true });
    window.addEventListener('dragstart', (e) => e.preventDefault(), { capture: true });
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  public reset(): void {
    this.activePointers.clear();
  }
}
