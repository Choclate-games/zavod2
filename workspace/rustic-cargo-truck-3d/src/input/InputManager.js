import { TouchControls } from './TouchControls';
export class InputManager {
    keys = new Set();
    touch = new TouchControls();
    enabled = true;
    constructor() {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.releaseAll);
        document.addEventListener('visibilitychange', this.releaseAll);
    }
    get touchLayer() { return this.touch.element; }
    snapshot() {
        if (!this.enabled)
            return { throttle: 0, brake: 0, steer: 0, handbrake: false, pause: false };
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
        };
    }
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled)
            this.releaseAll();
    }
    releaseAll = () => {
        this.keys.clear();
        this.touch.releaseAll();
    };
    onKeyDown = (event) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code))
            event.preventDefault();
        this.keys.add(event.code);
    };
    onKeyUp = (event) => {
        this.keys.delete(event.code);
    };
}
