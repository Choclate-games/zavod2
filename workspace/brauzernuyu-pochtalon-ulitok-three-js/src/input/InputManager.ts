import { TouchControls } from './TouchControls';

export interface InputSnapshot {
  panX: number;
  panY: number;
  hydratePressed: boolean;
  guardPressed: boolean;
}

export class InputManager {
  public readonly touchControls: TouchControls;
  private keyboardX = 0;
  private keyboardY = 0;
  private hydrateKeyPressed = false;
  private guardKeyPressed = false;
  private readonly snapshot: InputSnapshot = { panX: 0, panY: 0, hydratePressed: false, guardPressed: false };

  public constructor() {
    this.touchControls = new TouchControls();
    this.bindKeyboard();
  }

  public read(): InputSnapshot {
    this.snapshot.panX = this.keyboardX || this.touchControls.axisX;
    this.snapshot.panY = this.keyboardY || this.touchControls.axisY;
    this.snapshot.hydratePressed = this.hydrateKeyPressed || this.touchControls.consumeAction('hydrate');
    this.snapshot.guardPressed = this.guardKeyPressed || this.touchControls.consumeAction('guard');
    this.hydrateKeyPressed = false;
    this.guardKeyPressed = false;
    return this.snapshot;
  }

  public reset(): void {
    this.keyboardX = 0;
    this.keyboardY = 0;
    this.hydrateKeyPressed = false;
    this.guardKeyPressed = false;
    this.touchControls.releaseAll();
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.keyboardX = -1;
      if (event.code === 'ArrowRight' || event.code === 'KeyD') this.keyboardX = 1;
      if (event.code === 'ArrowUp' || event.code === 'KeyW') this.keyboardY = -1;
      if (event.code === 'ArrowDown' || event.code === 'KeyS') this.keyboardY = 1;
      if (!event.repeat && event.code === 'KeyH') this.hydrateKeyPressed = true;
      if (!event.repeat && event.code === 'KeyG') this.guardKeyPressed = true;
    });
    window.addEventListener('keyup', (event) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.keyboardX = this.keyboardX < 0 ? 0 : this.keyboardX;
      if (event.code === 'ArrowRight' || event.code === 'KeyD') this.keyboardX = this.keyboardX > 0 ? 0 : this.keyboardX;
      if (event.code === 'ArrowUp' || event.code === 'KeyW') this.keyboardY = this.keyboardY < 0 ? 0 : this.keyboardY;
      if (event.code === 'ArrowDown' || event.code === 'KeyS') this.keyboardY = this.keyboardY > 0 ? 0 : this.keyboardY;
    });
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
  }
}
