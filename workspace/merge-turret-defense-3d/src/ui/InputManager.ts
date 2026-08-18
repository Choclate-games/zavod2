export interface InputSnapshot {
  panX: number;
  panY: number;
  primary: boolean;
  secondary: boolean;
  dash: boolean;
  pausePressed: boolean;
}

export class InputManager {
  private readonly keys = new Set<string>();
  private primaryPointer = false;
  private pauseLatch = false;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (event) => {
      this.keys.add(event.code);
      if (event.code === 'Escape' || event.code === 'KeyP') this.pauseLatch = true;
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    target.addEventListener('pointerdown', (event) => {
      if (event.button === 0) this.primaryPointer = true;
    });
    window.addEventListener('pointerup', () => {
      this.primaryPointer = false;
    });
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
  }

  snapshot(): InputSnapshot {
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const up = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const pausePressed = this.pauseLatch;
    this.pauseLatch = false;
    return {
      panX: (right ? 1 : 0) - (left ? 1 : 0),
      panY: (down ? 1 : 0) - (up ? 1 : 0),
      primary: this.primaryPointer || this.keys.has('KeyJ'),
      secondary: this.keys.has('KeyK'),
      dash: this.keys.has('Space') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      pausePressed
    };
  }

  reset(): void {
    this.keys.clear();
    this.primaryPointer = false;
    this.pauseLatch = false;
  }
}
