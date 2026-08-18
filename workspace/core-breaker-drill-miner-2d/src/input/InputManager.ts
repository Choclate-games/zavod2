import { KeyboardInput } from './KeyboardInput.ts';
import { TouchControls } from './TouchControls.ts';
import { InputSnapshot, createZeroInput } from './InputSnapshot.ts';
import { eventBus } from '../core/EventBus.ts';

export class InputManager {
  private keyboard = new KeyboardInput();
  private touch = new TouchControls();
  private current = createZeroInput();
  private previous = createZeroInput();

  init(): void {
    this.keyboard.init();
    this.touch.init();
  }

  update(): void {
    this.previous = { ...this.current };
    const kb = this.keyboard.sample();
    const tc = this.touch.sample();
    this.current = mergeInputs(kb, tc);

    if (wasPressed(this.previous.pause, this.current.pause)) {
      eventBus.emit('input:pause');
    }
  }

  getSnapshot(): InputSnapshot {
    return this.current;
  }

  setGameplayActive(active: boolean): void {
    this.touch.setActive(active);
  }

  releaseAll(): void {
    this.keyboard.releaseAll();
    this.touch.releaseAll();
    this.current = createZeroInput();
  }
}

function mergeInputs(a: InputSnapshot, b: InputSnapshot): InputSnapshot {
  return {
    moveX: clampAxis(a.moveX + b.moveX),
    moveY: clampAxis(a.moveY + b.moveY),
    primary: a.primary || b.primary,
    secondary: a.secondary || b.secondary,
    dash: a.dash || b.dash,
    pause: a.pause || b.pause
  };
}

function clampAxis(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function wasPressed(prev: boolean, curr: boolean): boolean {
  return !prev && curr;
}
