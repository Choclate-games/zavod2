import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { Playgama } from '../platform/PlaygamaService';

export class TouchControls {
  private container: HTMLElement;
  private joystickZone: HTMLElement;
  private joystickBase: HTMLElement;
  private joystickThumb: HTMLElement;
  private btnDash: HTMLElement;
  private btnBulletTime: HTMLElement;
  private btnOverdrive: HTMLElement;

  // Joystick state
  private joystickPointerId: number | null = null;
  private joystickCenter: THREE.Vector2 = new THREE.Vector2();
  public moveVector: THREE.Vector2 = new THREE.Vector2();
  private readonly JOYSTICK_RADIUS = 60;
  private readonly DEAD_ZONE = 0.08;

  // Slicing swipe state
  private swipePointerId: number | null = null;
  private swipeStart: THREE.Vector2 = new THREE.Vector2();
  private swipeCurrent: THREE.Vector2 = new THREE.Vector2();
  private isSwiping: boolean = false;

  // Flags
  public isForcedBulletTime: boolean = false;

  constructor() {
    this.container = document.getElementById('touch-layer')!;
    this.joystickZone = document.getElementById('joystick-zone')!;
    this.joystickBase = document.getElementById('joystick-base')!;
    this.joystickThumb = document.getElementById('joystick-thumb')!;
    this.btnDash = document.getElementById('btn-touch-dash')!;
    this.btnBulletTime = document.getElementById('btn-touch-bt')!;
    this.btnOverdrive = document.getElementById('btn-touch-overdrive')!;

    this.setupListeners();
    this.checkPlatformSupport();
  }

  private checkPlatformSupport(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const touchParam = urlParams.get('touch');

    if (touchParam === '1') {
      this.container.classList.remove('hidden');
    } else if (touchParam === '0') {
      this.container.classList.add('hidden');
    } else if (Playgama.isMobile()) {
      this.container.classList.remove('hidden');
    }
  }

  private setupListeners(): void {
    // Joystick zone pointer events
    this.joystickZone.addEventListener('pointerdown', (e) => this.onJoystickDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    // Dash button
    this.btnDash.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      try { this.btnDash.setPointerCapture(e.pointerId); } catch {}
      EventBus.emit('input:dash');
    });

    // Bullet Time button
    this.btnBulletTime.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.isForcedBulletTime = true;
      this.btnBulletTime.classList.add('active');
    });
    this.btnBulletTime.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      this.isForcedBulletTime = false;
      this.btnBulletTime.classList.remove('active');
    });
    this.btnBulletTime.addEventListener('pointercancel', () => {
      this.isForcedBulletTime = false;
      this.btnBulletTime.classList.remove('active');
    });

    // Overdrive button
    this.btnOverdrive.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      EventBus.emit('input:overdrive');
    });

    // Screen Swipe Slicing (right screen / entire canvas)
    window.addEventListener('pointerdown', (e) => this.onScreenPointerDown(e));

    // Reset on blur / visibilitychange
    window.addEventListener('blur', () => this.reset());
    EventBus.on('platform:pause', () => this.reset());
  }

  private onJoystickDown(e: PointerEvent): void {
    if (this.joystickPointerId !== null) return;
    if (e.clientX > window.innerWidth * 0.5) return;

    this.joystickPointerId = e.pointerId;
    try { this.joystickZone.setPointerCapture(e.pointerId); } catch {}

    this.joystickCenter.set(e.clientX, e.clientY);
    this.joystickBase.style.left = `${e.clientX}px`;
    this.joystickBase.style.top = `${e.clientY}px`;
    this.joystickBase.style.display = 'block';

    this.joystickThumb.style.transform = 'translate(-50%, -50%)';
    this.moveVector.set(0, 0);
  }

  private onScreenPointerDown(e: PointerEvent): void {
    if (e.pointerId === this.joystickPointerId) return;
    const target = e.target as HTMLElement;
    if (target.closest('.ui-interactive-btn') || target.closest('#modal-container')) return;

    if (this.swipePointerId === null) {
      this.swipePointerId = e.pointerId;
      this.swipeStart.set(e.clientX, e.clientY);
      this.swipeCurrent.set(e.clientX, e.clientY);
      this.isSwiping = true;
      EventBus.emit('input:slice_start', this.swipeStart);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (e.pointerId === this.joystickPointerId) {
      const current = new THREE.Vector2(e.clientX, e.clientY);
      const delta = current.sub(this.joystickCenter);
      const dist = delta.length();

      if (dist > this.JOYSTICK_RADIUS) {
        delta.multiplyScalar(this.JOYSTICK_RADIUS / dist);
      }

      this.joystickThumb.style.transform = `translate(calc(-50% + ${delta.x}px), calc(-50% + ${delta.y}px))`;

      const normalizedDist = dist / this.JOYSTICK_RADIUS;
      if (normalizedDist < this.DEAD_ZONE) {
        this.moveVector.set(0, 0);
      } else {
        const remapped = (normalizedDist - this.DEAD_ZONE) / (1 - this.DEAD_ZONE);
        const dir = delta.normalize().multiplyScalar(Math.min(1.0, remapped));
        this.moveVector.set(dir.x, dir.y);
      }
    }

    if (e.pointerId === this.swipePointerId) {
      this.swipeCurrent.set(e.clientX, e.clientY);
      EventBus.emit('input:slice_move', this.swipeCurrent);

      if (this.swipeStart.distanceTo(this.swipeCurrent) > 120) {
        EventBus.emit('input:slice_execute', {
          start: this.swipeStart.clone(),
          end: this.swipeCurrent.clone()
        });
        this.swipeStart.copy(this.swipeCurrent);
      }
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.pointerId === this.joystickPointerId) {
      this.joystickPointerId = null;
      this.joystickBase.style.display = 'none';
      this.moveVector.set(0, 0);
    }

    if (e.pointerId === this.swipePointerId) {
      if (this.isSwiping && this.swipeStart.distanceTo(this.swipeCurrent) > 30) {
        EventBus.emit('input:slice_execute', {
          start: this.swipeStart.clone(),
          end: this.swipeCurrent.clone()
        });
      }
      this.swipePointerId = null;
      this.isSwiping = false;
      EventBus.emit('input:slice_end');
    }
  }

  public setVisible(visible: boolean): void {
    if (visible) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
      this.reset();
    }
  }

  public reset(): void {
    this.joystickPointerId = null;
    this.swipePointerId = null;
    this.isSwiping = false;
    this.isForcedBulletTime = false;
    this.moveVector.set(0, 0);
    this.joystickBase.style.display = 'none';
    this.btnBulletTime.classList.remove('active');
  }

  public isTouching(): boolean {
    return this.isSwiping || this.isForcedBulletTime;
  }
}
