const MAX_RADIUS = 68;
const DEAD_ZONE = 0.06;

export class TouchControls {
  readonly element = document.createElement('div');
  private readonly joystick = document.createElement('div');
  private readonly joystickKnob = document.createElement('div');
  private readonly joystickGuide = document.createElement('div');

  throttle = 0;
  brake = 0;
  steer = 0;
  steerLeft = 0;
  handbrake = false;
  recover = false;

  private joystickPointer = -1;
  private originX = 0;
  private originY = 0;

  constructor() {
    this.element.className = 'touch-layer';

    // Floating Joystick Base
    this.joystick.className = 'joystick hidden';

    // Directional Guide Indicators (subtle arrows inside the base)
    this.joystickGuide.className = 'joystick-guide';
    this.joystickGuide.innerHTML = `
      <span class="guide-arrow guide-up">▲</span>
      <span class="guide-arrow guide-down">▼</span>
      <span class="guide-arrow guide-left">◀</span>
      <span class="guide-arrow guide-right">▶</span>
    `;

    this.joystickKnob.className = 'joystick-knob';
    this.joystick.append(this.joystickGuide, this.joystickKnob);
    this.element.append(this.joystick);

    // Pointer Events for single-finger or multi-touch joystick
    this.element.addEventListener('pointerdown', this.onPointerDown);
    this.element.addEventListener('pointermove', this.onPointerMove);
    this.element.addEventListener('pointerup', this.onPointerUp);
    this.element.addEventListener('pointercancel', this.onPointerUp);
    this.element.addEventListener('lostpointercapture', this.onPointerUp);

    // Prevent browser touch gestures
    this.element.addEventListener('contextmenu', this.preventBrowserGesture, true);
    this.element.addEventListener('dragstart', this.preventBrowserGesture, true);
    this.element.addEventListener('selectstart', this.preventBrowserGesture, true);
    this.element.addEventListener('touchmove', this.preventBrowserGesture, { passive: false });
  }

  setVisible(visible: boolean): void {
    this.element.classList.toggle('visible', visible);
    if (!visible) this.releaseAll();
  }

  releaseAll = (): void => {
    this.joystickPointer = -1;
    this.joystick.classList.add('hidden');
    this.joystickKnob.style.transform = 'translate(0px, 0px)';
    this.throttle = 0;
    this.brake = 0;
    this.steer = 0;
    this.steerLeft = 0;
    this.handbrake = false;
    this.recover = false;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    // If touched on HUD controls (pause, audio), let those pass through
    if ((event.target as HTMLElement).closest('.hud-control-btn') || (event.target as HTMLElement).closest('button')) {
      return;
    }

    if (this.joystickPointer !== -1) return;

    event.preventDefault();
    this.element.setPointerCapture(event.pointerId);
    this.joystickPointer = event.pointerId;

    this.originX = event.clientX;
    this.originY = event.clientY;

    this.joystick.style.left = `${event.clientX}px`;
    this.joystick.style.top = `${event.clientY}px`;
    this.joystick.classList.remove('hidden');

    this.updateJoystick(event);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId === this.joystickPointer) {
      event.preventDefault();
      this.updateJoystick(event);
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.joystickPointer) return;
    this.releaseAll();
  };

  private readonly updateJoystick = (event: PointerEvent): void => {
    const dx = event.clientX - this.originX;
    const dy = event.clientY - this.originY;

    const rawDist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(MAX_RADIUS, rawDist);
    const angle = Math.atan2(dy, dx);

    const normX = rawDist > 0 ? (Math.cos(angle) * clampedDist) / MAX_RADIUS : 0;
    const normY = rawDist > 0 ? (Math.sin(angle) * clampedDist) / MAX_RADIUS : 0;

    // Apply dead zone and smooth curve
    const x = Math.abs(normX) < DEAD_ZONE ? 0 : Math.sign(normX) * ((Math.abs(normX) - DEAD_ZONE) / (1 - DEAD_ZONE));
    const y = Math.abs(normY) < DEAD_ZONE ? 0 : Math.sign(normY) * ((Math.abs(normY) - DEAD_ZONE) / (1 - DEAD_ZONE));

    // Steering: Right (X > 0), Left (X < 0)
    this.steer = Math.max(0, x);
    this.steerLeft = Math.max(0, -x);

    // Throttle & Brake: Drag UP (Y < 0) is Forward Gas, Drag DOWN (Y > 0) is Brake / Reverse
    this.throttle = Math.max(0, -y);
    this.brake = Math.max(0, y);

    // Visual knob offset
    const knobX = Math.cos(angle) * clampedDist * 0.58;
    const knobY = Math.sin(angle) * clampedDist * 0.58;
    this.joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
  };

  private readonly preventBrowserGesture = (event: Event): void => {
    event.preventDefault();
  };
}
