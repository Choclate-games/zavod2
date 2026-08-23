import { EntityManager } from '../entities/EntityManager';
import { RaycastBvhBallisticsEngineSystem } from '../systems/RaycastBvhBallisticsEngineSystem';
import { EventBus } from '../core/EventBus';

export class TouchControls {
  private container: HTMLElement;
  private strafeZone: HTMLElement;
  private lookZone: HTMLElement;
  private fireBtn: HTMLElement;
  private walkBtn: HTMLElement;

  private isWalking = false;
  private strafePointerId: number | null = null;
  private lookPointerId: number | null = null;
  private strafeStartX = 0;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'touch-layer';

    // Left half: Strafe zone
    this.strafeZone = document.createElement('div');
    this.strafeZone.className = 'touch-strafe-zone';
    this.container.appendChild(this.strafeZone);

    // Right half: Look & Aim zone
    this.lookZone = document.createElement('div');
    this.lookZone.className = 'touch-look-zone';
    this.container.appendChild(this.lookZone);

    // Fire button
    this.fireBtn = document.createElement('button');
    this.fireBtn.className = 'touch-btn-fire';
    this.fireBtn.textContent = 'FIRE';
    this.container.appendChild(this.fireBtn);

    // Walk toggle button
    this.walkBtn = document.createElement('button');
    this.walkBtn.className = 'touch-btn-walk';
    this.walkBtn.textContent = 'WALK';
    this.container.appendChild(this.walkBtn);

    this.setupEvents();
  }

  public mount(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }

  public show(): void {
    this.container.classList.add('active');
  }

  public hide(): void {
    this.container.classList.remove('active');
    this.resetInput();
  }

  private resetInput(): void {
    this.strafePointerId = null;
    this.lookPointerId = null;
    const player = EntityManager.get().player;
    player.moveInput.moveX = 0;
    player.moveInput.moveZ = 0;
  }

  private setupEvents(): void {
    // Strafe zone pointer handling
    this.strafeZone.addEventListener('pointerdown', (e) => {
      if (this.strafePointerId === null) {
        this.strafePointerId = e.pointerId;
        this.strafeZone.setPointerCapture(e.pointerId);
        this.strafeStartX = e.clientX;
      }
    });

    this.strafeZone.addEventListener('pointermove', (e) => {
      if (this.strafePointerId === e.pointerId) {
        const dx = e.clientX - this.strafeStartX;
        const player = EntityManager.get().player;
        if (Math.abs(dx) > 10) {
          player.moveInput.moveX = Math.sign(dx);
        } else {
          player.moveInput.moveX = 0;
        }
      }
    });

    const endStrafe = (e: PointerEvent) => {
      if (this.strafePointerId === e.pointerId) {
        this.strafePointerId = null;
        EntityManager.get().player.moveInput.moveX = 0;
      }
    };
    this.strafeZone.addEventListener('pointerup', endStrafe);
    this.strafeZone.addEventListener('pointercancel', endStrafe);

    // Look zone pointer handling
    let lastLookX = 0;
    let lastLookY = 0;

    this.lookZone.addEventListener('pointerdown', (e) => {
      if (this.lookPointerId === null) {
        this.lookPointerId = e.pointerId;
        this.lookZone.setPointerCapture(e.pointerId);
        lastLookX = e.clientX;
        lastLookY = e.clientY;
      }
    });

    this.lookZone.addEventListener('pointermove', (e) => {
      if (this.lookPointerId === e.pointerId) {
        const dx = e.clientX - lastLookX;
        const dy = e.clientY - lastLookY;
        lastLookX = e.clientX;
        lastLookY = e.clientY;
        EntityManager.get().player.setTouchLookDelta(dx, dy);
      }
    });

    const endLook = (e: PointerEvent) => {
      if (this.lookPointerId === e.pointerId) {
        this.lookPointerId = null;
      }
    };
    this.lookZone.addEventListener('pointerup', endLook);
    this.lookZone.addEventListener('pointercancel', endLook);

    // Fire button
    this.fireBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const player = EntityManager.get().player;
      if (player.canShoot()) {
        const origin = player.position.clone().setY(1.65);
        const forward = new THREE.Vector3(
          -Math.sin(player.yaw) * Math.cos(player.pitch),
          Math.sin(player.pitch),
          -Math.cos(player.yaw) * Math.cos(player.pitch)
        );
        player.onShoot();
        RaycastBvhBallisticsEngineSystem.fireRaycast(origin, forward, player.velocity.length() > 0.35 ? 12.0 : 0.05, true);
      }
    });

    // Walk toggle
    this.walkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isWalking = !this.isWalking;
      EntityManager.get().player.moveInput.isWalking = this.isWalking;
      if (this.isWalking) {
        this.walkBtn.classList.add('active');
      } else {
        this.walkBtn.classList.remove('active');
      }
    });
  }
}