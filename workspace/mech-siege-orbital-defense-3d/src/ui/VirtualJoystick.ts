// src/ui/VirtualJoystick.ts
// Pointer Events touch controller with floating joystick, deadzone and multi-touch isolation

import { player } from '../entities/Player';
import { playgamaService } from '../platform/PlaygamaService';
import { storageService } from '../platform/StorageService';

export class VirtualJoystick {
  private static instance: VirtualJoystick;

  private container!: HTMLElement;
  private zone!: HTMLElement;
  private base!: HTMLElement;
  private knob!: HTMLElement;

  private btnAttack!: HTMLElement;
  private btnDash!: HTMLElement;
  private btnShield!: HTMLElement;

  private joystickPointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private maxRadius = 50;
  private deadZone = 0.08;

  private isEnabled = false;

  private constructor() {}

  public static getInstance(): VirtualJoystick {
    if (!VirtualJoystick.instance) {
      VirtualJoystick.instance = new VirtualJoystick();
    }
    return VirtualJoystick.instance;
  }

  public init(): void {
    this.container = document.getElementById('touch-controls')!;
    this.zone = document.getElementById('joystick-zone')!;
    this.base = document.getElementById('joystick-base')!;
    this.knob = document.getElementById('joystick-knob')!;

    this.btnAttack = document.getElementById('btn-touch-attack')!;
    this.btnDash = document.getElementById('btn-touch-dash')!;
    this.btnShield = document.getElementById('btn-touch-shield')!;

    this.setupPointerListeners();
    this.setupDesktopKeyboardListeners();
    this.checkVisibility();
  }

  public checkVisibility(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const touchParam = urlParams.get('touch');

    let shouldShow = false;
    if (touchParam === '1') {
      shouldShow = true;
    } else if (touchParam === '0') {
      shouldShow = false;
    } else {
      const mode = storageService.getData().settings.touchMode;
      if (mode === 'touch') shouldShow = true;
      else if (mode === 'mouse') shouldShow = false;
      else shouldShow = playgamaService.isMobileDevice() || 'ontouchstart' in window;
    }

    this.isEnabled = shouldShow;
    if (shouldShow) {
      this.container.classList.add('active');
    } else {
      this.container.classList.remove('active');
    }
  }

  private setupPointerListeners(): void {
    // Floating joystick on left half
    this.zone.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.joystickPointerId !== null) return;
      this.joystickPointerId = e.pointerId;
      this.zone.setPointerCapture(e.pointerId);

      this.startX = e.clientX;
      this.startY = e.clientY;

      this.base.style.left = `${this.startX}px`;
      this.base.style.top = `${this.startY}px`;
      this.base.style.display = 'block';

      this.knob.style.left = '50%';
      this.knob.style.top = '50%';
      player.setMoveInput(0, 0);
    });

    this.zone.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;

      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      const dist = Math.hypot(dx, dy);

      const angle = Math.atan2(dy, dx);
      const clampedDist = Math.min(dist, this.maxRadius);

      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      this.knob.style.left = `calc(50% + ${knobX}px)`;
      this.knob.style.top = `calc(50% + ${knobY}px)`;

      const normalizedDist = clampedDist / this.maxRadius;
      if (normalizedDist < this.deadZone) {
        player.setMoveInput(0, 0);
      } else {
        const factor = (normalizedDist - this.deadZone) / (1.0 - this.deadZone);
        const inputX = Math.cos(angle) * factor;
        const inputY = Math.sin(angle) * factor;
        player.setMoveInput(inputX, inputY);
      }
    });

    const resetJoystick = (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;
      this.joystickPointerId = null;
      this.base.style.display = 'none';
      player.setMoveInput(0, 0);
    };

    this.zone.addEventListener('pointerup', resetJoystick);
    this.zone.addEventListener('pointercancel', resetJoystick);

    // Action buttons pointer tracking
    const bindActionButton = (btn: HTMLElement, onDown: () => void, onUp?: () => void) => {
      let activePointerId: number | null = null;

      btn.addEventListener('pointerdown', (e: PointerEvent) => {
        if (activePointerId !== null) return;
        activePointerId = e.pointerId;
        btn.setPointerCapture(e.pointerId);
        onDown();
      });

      const release = (e: PointerEvent) => {
        if (e.pointerId !== activePointerId) return;
        activePointerId = null;
        if (onUp) onUp();
      };

      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
    };

    bindActionButton(
      this.btnAttack,
      () => player.setAttackInput(true),
      () => player.setAttackInput(false)
    );

    bindActionButton(this.btnDash, () => player.triggerDash());
    bindActionButton(this.btnShield, () => player.triggerShieldBarrier());

    // Window blur & visibility reset
    window.addEventListener('blur', () => this.resetAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.resetAll();
    });
  }

  private setupDesktopKeyboardListeners(): void {
    const keys: Record<string, boolean> = {};

    const updateKeyboardVector = () => {
      if (this.joystickPointerId !== null) return; // Touch takes precedence if active

      let x = 0;
      let y = 0;

      if (keys['KeyW'] || keys['ArrowUp']) y -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) y += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) x -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) x += 1;

      const len = Math.hypot(x, y);
      if (len > 0) {
        player.setMoveInput(x / len, y / len);
      } else {
        player.setMoveInput(0, 0);
      }
    };

    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      updateKeyboardVector();

      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        player.triggerDash();
      }
      if (e.code === 'KeyK' || e.code === 'KeyE') {
        player.triggerShieldBarrier();
      }
      if (e.code === 'KeyJ') {
        player.setAttackInput(true);
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
      updateKeyboardVector();

      if (e.code === 'KeyJ') {
        player.setAttackInput(false);
      }
    });

    // Mouse pointer attack on canvas
    const canvas = document.getElementById('three-canvas')!;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0) {
        player.setAttackInput(true);
      } else if (e.button === 2) {
        player.triggerShieldBarrier();
      }
    });

    canvas.addEventListener('pointerup', () => {
      player.setAttackInput(false);
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  public resetAll(): void {
    this.joystickPointerId = null;
    if (this.base) this.base.style.display = 'none';
    player.setMoveInput(0, 0);
    player.setAttackInput(false);
  }
}

export const virtualJoystick = VirtualJoystick.getInstance();
