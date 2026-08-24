import type { InputSnapshot } from '../core/types';
import { TouchControls } from './TouchControls';

export class InputManager {
  private readonly keys = new Set<string>();
  private readonly touch = new TouchControls();
  private enabled = true;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', this.releaseAll);
  }

  get touchLayer(): HTMLElement { return this.touch.element; }

  snapshot(): InputSnapshot {
    if (!this.enabled) return { throttle: 0, brake: 0, steer: 0, handbrake: false, pause: false };
    const up = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    return {
      throttle: Math.max(up ? 1 : 0, this.touch.throttle),
      brake: Math.max(down ? 1 : 0, this.touch.brake),
      steer: Math.max(right ? 1 : 0, this.touch.steer) - Math.max(left ? 1 : 0, this.touch.steerLeft),
      handbrake: this.keys.has('Space') || this.touch.handbrake,
      pause: this.keys.has('Escape') || this.keys.has('KeyP'),
      recover: this.keys.has('KeyR') || this.touch.recover,
    };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.releaseAll();
  }

  releaseAll = (): void => {
    this.keys.clear();
    this.touch.releaseAll();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };
}
