import { InputSnapshot, createZeroInput } from './InputSnapshot.ts';

const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  primary: ['Mouse0', 'KeyJ'],
  secondary: ['Mouse2', 'KeyK'],
  dash: ['Space', 'ShiftLeft', 'ShiftRight'],
  pause: ['KeyP', 'Escape']
};

export class KeyboardInput {
  private pressed = new Set<string>();
  private pauseEdge = false;
  private dashEdge = false;

  init(): void {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    window.addEventListener('blur', () => this.pressed.clear());
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.pressed.add(e.code);
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.pressed.delete(e.code);
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 0) this.pressed.add('Mouse0');
    if (e.button === 2) this.pressed.add('Mouse2');
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) this.pressed.delete('Mouse0');
    if (e.button === 2) this.pressed.delete('Mouse2');
  }

  sample(): InputSnapshot {
    const snap = createZeroInput();
    if (this.isDown(KEYS.up)) snap.moveY -= 1;
    if (this.isDown(KEYS.down)) snap.moveY += 1;
    if (this.isDown(KEYS.left)) snap.moveX -= 1;
    if (this.isDown(KEYS.right)) snap.moveX += 1;
    snap.primary = this.isDown(KEYS.primary);
    snap.secondary = this.isDown(KEYS.secondary);
    snap.dash = this.isDown(KEYS.dash);
    snap.pause = this.isDown(KEYS.pause);
    return snap;
  }

  consumeEdges(): { pause: boolean; dash: boolean } {
    const pause = this.pauseEdge;
    const dash = this.dashEdge;
    this.pauseEdge = false;
    this.dashEdge = false;
    return { pause, dash };
  }

  private isDown(codes: string[]): boolean {
    return codes.some((c) => this.pressed.has(c));
  }

  releaseAll(): void {
    this.pressed.clear();
  }
}
