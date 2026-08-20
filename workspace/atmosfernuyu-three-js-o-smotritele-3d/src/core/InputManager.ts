/**
 * Input routing (Core Engine Layer). Aggregates keyboard and touch into a single
 * `InputState` the simulation reads each fixed step. Keyboard and touch live in
 * parallel and never mute each other.
 */

export interface InputState {
  /** World-space desired move direction, each component in [-1, 1]. */
  moveX: number;
  moveZ: number;
  ascend: boolean;
  descend: boolean;
  boost: boolean;
  pulse: boolean;
  heavy: boolean;
  /** Edge-triggered pause request (consumed by Game). */
  pauseEdge: boolean;
}

const NEUTRAL: InputState = {
  moveX: 0,
  moveZ: 0,
  ascend: false,
  descend: false,
  boost: false,
  pulse: false,
  heavy: false,
  pauseEdge: false,
};

export class InputManager {
  readonly state: InputState = { ...NEUTRAL };

  // Keyboard contributions
  private kb = { x: 0, z: 0, ascend: false, descend: false, boost: false };
  // Touch contributions (written by VirtualJoystick / buttons)
  private touch = { x: 0, z: 0, ascend: false, descend: false, pulse: false, heavy: false };

  private enabled = false;

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.releaseAll();
  }

  /** Called by touch controls to feed analog movement. */
  setTouchMove(x: number, z: number): void {
    this.touch.x = x;
    this.touch.z = z;
  }
  setTouchAction(action: keyof Omit<InputState, 'moveX' | 'moveZ' | 'pauseEdge'>, value: boolean): void {
    // map into touch struct
    if (action in this.touch) {
      (this.touch as unknown as Record<string, boolean>)[action] = value;
    }
  }

  /** Hard reset of every axis & button — used on blur / visibility / hide. */
  releaseAll = (): void => {
    this.kb = { x: 0, z: 0, ascend: false, descend: false, boost: false };
    this.touch = { x: 0, z: 0, ascend: false, descend: false, pulse: false, heavy: false };
    this.state.pauseEdge = false;
  };

  /** Recompute the merged state from both sources. */
  poll(): InputState {
    const s = this.state;
    s.moveX = clamp(this.kb.x + this.touch.x);
    s.moveZ = clamp(this.kb.z + this.touch.z);
    s.ascend = this.kb.ascend || this.touch.ascend;
    s.descend = this.kb.descend || this.touch.descend;
    s.boost = this.kb.boost;
    s.pulse = this.touch.pulse; // pulse is edge/held from touch OR keyboard below
    s.heavy = this.touch.heavy;
    return s;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.kb.z = -1; break;
      case 'KeyS': case 'ArrowDown': this.kb.z = 1; break;
      case 'KeyA': case 'ArrowLeft': this.kb.x = -1; break;
      case 'KeyD': case 'ArrowRight': this.kb.x = 1; break;
      case 'Space': this.kb.ascend = true; break;
      case 'ShiftLeft': case 'ShiftRight': case 'ControlLeft': case 'ControlRight': this.kb.descend = true; break;
      case 'KeyJ': this.touch.pulse = true; break;
      case 'KeyK': this.touch.heavy = true; break;
      case 'KeyP': case 'Escape': this.state.pauseEdge = true; break;
      default: return;
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': if (this.kb.z < 0) this.kb.z = 0; break;
      case 'KeyS': case 'ArrowDown': if (this.kb.z > 0) this.kb.z = 0; break;
      case 'KeyA': case 'ArrowLeft': if (this.kb.x < 0) this.kb.x = 0; break;
      case 'KeyD': case 'ArrowRight': if (this.kb.x > 0) this.kb.x = 0; break;
      case 'Space': this.kb.ascend = false; break;
      case 'ShiftLeft': case 'ShiftRight': case 'ControlLeft': case 'ControlRight': this.kb.descend = false; break;
      case 'KeyJ': this.touch.pulse = false; break;
      case 'KeyK': this.touch.heavy = false; break;
      default: break;
    }
  };
}

function clamp(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}
