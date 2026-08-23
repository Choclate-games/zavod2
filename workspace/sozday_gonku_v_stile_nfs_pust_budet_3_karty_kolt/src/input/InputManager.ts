import { TouchControls, VehicleInputState } from './TouchControls';
import { events } from '../core/EventBus';

export class InputManager {
  private touchControls: TouchControls;
  private keysDown = new Set<string>();

  constructor(touchLayer: HTMLElement) {
    this.touchControls = new TouchControls(touchLayer);

    window.addEventListener('keydown', (e) => {
      this.keysDown.add(e.code);
      if (e.code === 'Escape' || e.code === 'KeyP') {
        events.emit('GAME_STATE_CHANGED', 'PAUSED');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keysDown.clear();
      this.touchControls.reset();
    });
  }

  showTouch(): void {
    this.touchControls.show();
  }

  hideTouch(): void {
    this.touchControls.hide();
  }

  getInput(): VehicleInputState {
    const touch = this.touchControls.getState();

    let kbSteer = 0;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) kbSteer -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) kbSteer += 1;

    const kbThrottle = (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) ? 1 : 0;
    const kbBrake = (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) ? 1 : 0;
    const kbHandbrake = this.keysDown.has('Space');
    const kbNitro = this.keysDown.has('ShiftLeft') || this.keysDown.has('ShiftRight') || this.keysDown.has('KeyE');

    const steer = Math.max(-1, Math.min(1, kbSteer + touch.steer));
    const throttle = Math.max(kbThrottle, touch.throttle);
    const brake = Math.max(kbBrake, touch.brake);
    const handbrake = kbHandbrake || touch.handbrake;
    const nitro = kbNitro || touch.nitro;

    return {
      steer,
      throttle,
      brake,
      handbrake,
      nitro,
    };
  }
}
