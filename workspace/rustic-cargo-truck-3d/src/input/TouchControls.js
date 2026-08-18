const MAX_RADIUS = 58;
const DEAD_ZONE = 0.08;
export class TouchControls {
    element = document.createElement('div');
    throttleButton = document.createElement('button');
    brakeButton = document.createElement('button');
    handbrakeButton = document.createElement('button');
    throttle = 0;
    brake = 0;
    steer = 0;
    steerLeft = 0;
    handbrake = false;
    joystickPointer = -1;
    originX = 0;
    originY = 0;
    joystick;
    buttonPointers = new Map();
    constructor() {
        this.element.className = 'touch-layer';
        const leftZone = document.createElement('div');
        leftZone.className = 'touch-left-zone';
        this.joystick = document.createElement('div');
        this.joystick.className = 'joystick hidden';
        leftZone.append(this.joystick);
        this.element.append(leftZone);
        const right = document.createElement('div');
        right.className = 'touch-right';
        this.throttleButton.className = 'touch-btn main';
        this.throttleButton.textContent = 'ГАЗ';
        this.brakeButton.className = 'touch-btn';
        this.brakeButton.textContent = 'ТОРМОЗ';
        this.handbrakeButton.className = 'touch-btn';
        this.handbrakeButton.textContent = 'РУЧНИК';
        const pedals = document.createElement('div');
        pedals.className = 'touch-pedals';
        pedals.append(this.brakeButton, this.handbrakeButton);
        right.append(pedals, this.throttleButton);
        this.element.append(right);
        this.buttonPointers.set(this.throttleButton, new Set());
        this.buttonPointers.set(this.brakeButton, new Set());
        this.buttonPointers.set(this.handbrakeButton, new Set());
        leftZone.addEventListener('pointerdown', this.onJoystickDown);
        leftZone.addEventListener('pointermove', this.onJoystickMove);
        leftZone.addEventListener('pointerup', this.onJoystickUp);
        leftZone.addEventListener('pointercancel', this.onJoystickUp);
        for (const button of this.buttonPointers.keys()) {
            button.addEventListener('pointerdown', this.onButtonDown);
            button.addEventListener('pointerup', this.onButtonUp);
            button.addEventListener('pointercancel', this.onButtonUp);
            button.addEventListener('lostpointercapture', this.onButtonUp);
        }
        this.element.addEventListener('contextmenu', this.preventBrowserGesture);
        this.element.addEventListener('dragstart', this.preventBrowserGesture);
        this.element.addEventListener('touchmove', this.preventBrowserGesture, { passive: false });
    }
    setVisible(visible) {
        this.element.classList.toggle('visible', visible);
        if (!visible)
            this.releaseAll();
    }
    releaseAll = () => {
        this.joystickPointer = -1;
        this.joystick.classList.add('hidden');
        this.throttle = 0;
        this.brake = 0;
        this.steer = 0;
        this.steerLeft = 0;
        this.handbrake = false;
        for (const [button, pointers] of this.buttonPointers) {
            pointers.clear();
            button.classList.remove('active');
        }
    };
    onJoystickDown = (event) => {
        if (this.joystickPointer !== -1 || event.clientX > window.innerWidth / 2)
            return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        this.joystickPointer = event.pointerId;
        this.originX = event.clientX;
        this.originY = event.clientY;
        this.joystick.style.left = `${event.clientX}px`;
        this.joystick.style.top = `${event.clientY}px`;
        this.joystick.classList.remove('hidden');
        this.updateJoystick(event);
    };
    onJoystickMove = (event) => {
        if (event.pointerId === this.joystickPointer) {
            event.preventDefault();
            this.updateJoystick(event);
        }
    };
    onJoystickUp = (event) => {
        if (event.pointerId !== this.joystickPointer)
            return;
        this.joystickPointer = -1;
        this.steer = 0;
        this.steerLeft = 0;
        this.joystick.classList.add('hidden');
    };
    updateJoystick = (event) => {
        const dx = event.clientX - this.originX;
        const dy = event.clientY - this.originY;
        const normalizedX = Math.max(-1, Math.min(1, dx / MAX_RADIUS));
        const normalizedY = Math.max(-1, Math.min(1, dy / MAX_RADIUS));
        const x = Math.abs(normalizedX) < DEAD_ZONE ? 0 : Math.sign(normalizedX) * (Math.abs(normalizedX) - DEAD_ZONE) / (1 - DEAD_ZONE);
        this.steer = Math.max(0, x);
        this.steerLeft = Math.max(0, -x);
        this.joystick.style.transform = `translate(${normalizedX * 35}px, ${normalizedY * 35}px)`;
    };
    onButtonDown = (event) => {
        event.preventDefault();
        const button = event.currentTarget;
        button.setPointerCapture(event.pointerId);
        const pointers = this.buttonPointers.get(button);
        pointers?.add(event.pointerId);
        button.classList.add('active');
        this.updateButtons();
    };
    onButtonUp = (event) => {
        const button = event.currentTarget;
        this.buttonPointers.get(button)?.delete(event.pointerId);
        if ((this.buttonPointers.get(button)?.size ?? 0) === 0)
            button.classList.remove('active');
        this.updateButtons();
    };
    updateButtons = () => {
        this.throttle = (this.buttonPointers.get(this.throttleButton)?.size ?? 0) > 0 ? 1 : 0;
        this.brake = (this.buttonPointers.get(this.brakeButton)?.size ?? 0) > 0 ? 1 : 0;
        this.handbrake = (this.buttonPointers.get(this.handbrakeButton)?.size ?? 0) > 0;
    };
    preventBrowserGesture = (event) => {
        event.preventDefault();
    };
}
