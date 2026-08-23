import * as THREE from 'three';
import { InertiaDecelerationControllerSystem } from '../systems/InertiaDecelerationControllerSystem';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { ProceduralModels } from '../rendering/ProceduralModels';
import { AudioManager } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';

export class Player {
  public position: THREE.Vector3 = new THREE.Vector3(0, 1.65, 6);
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public yaw: number = 0;
  public pitch: number = 0;
  public health: number = 100;
  public isAlive: boolean = true;

  // Weapon TTX & Ammo
  public selectedWeapon: string = 'deagle';
  public ammoCurrent: number = 7;
  public ammoReserve: number = 35;
  public maxAmmo: number = 7;
  public fireCooldownTimer: number = 0;
  public isReloading: boolean = false;
  public reloadTimer: number = 0;

  // Input states
  public moveInput = { moveX: 0, moveZ: 0, isWalking: false };
  public isPointerLocked: boolean = false;
  public sensitivity: number = 1.0;

  // Viewmodel & Recoil
  public viewmodel: THREE.Group;
  public recoilOffset: THREE.Vector3 = new THREE.Vector3();
  public recoilRot: THREE.Euler = new THREE.Euler();
  private stepTimer: number = 0;
  private inertiaSystem: InertiaDecelerationControllerSystem;

  constructor() {
    this.inertiaSystem = new InertiaDecelerationControllerSystem();
    this.viewmodel = ProceduralModels.createDeagleViewmodel();

    this.setupInputs();
  }

  private setupInputs(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      if (!this.isAlive) return;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.moveInput.moveZ = -1;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.moveInput.moveZ = 1;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.moveInput.moveX = -1;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.moveInput.moveX = 1;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.moveInput.isWalking = true;
      if (e.code === 'KeyR') this.reload();
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') if (this.moveInput.moveZ === -1) this.moveInput.moveZ = 0;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') if (this.moveInput.moveZ === 1) this.moveInput.moveZ = 0;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') if (this.moveInput.moveX === -1) this.moveInput.moveX = 0;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') if (this.moveInput.moveX === 1) this.moveInput.moveX = 0;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.moveInput.isWalking = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked || !this.isAlive) return;
      const factor = 0.0022 * this.sensitivity;
      this.yaw -= e.movementX * factor;
      this.pitch -= e.movementY * factor;
      this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement !== null;
    });
  }

  public requestLock(targetElement: HTMLElement): void {
    try {
      if (!this.isPointerLocked) {
        targetElement.requestPointerLock?.();
      }
    } catch {}
  }

  public setTouchLookDelta(dx: number, dy: number): void {
    const factor = 0.0035 * this.sensitivity;
    this.yaw -= dx * factor;
    this.pitch -= dy * factor;
    this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));
  }

  public setWeapon(weaponId: string): void {
    this.selectedWeapon = weaponId;
    if (weaponId === 'ak47') {
      this.maxAmmo = 30;
      this.ammoCurrent = 30;
      this.ammoReserve = 90;
    } else if (weaponId === 'awp') {
      this.maxAmmo = 5;
      this.ammoCurrent = 5;
      this.ammoReserve = 15;
    } else {
      this.maxAmmo = 7;
      this.ammoCurrent = 7;
      this.ammoReserve = 35;
    }
    EventBus.get().emit('WEAPON_CHANGED', {
      id: weaponId,
      name: weaponId.toUpperCase(),
      ammo: this.ammoCurrent,
      maxAmmo: this.maxAmmo
    });
  }

  public canShoot(): boolean {
    return this.isAlive && this.fireCooldownTimer <= 0 && this.ammoCurrent > 0 && !this.isReloading;
  }

  public onShoot(): void {
    if (!this.canShoot()) return;

    this.ammoCurrent--;
    this.fireCooldownTimer = this.selectedWeapon === 'awp' ? 1.4 : this.selectedWeapon === 'ak47' ? 0.12 : 0.42;

    // Viewmodel Recoil Kick
    this.recoilOffset.z = 0.08;
    this.recoilRot.x = 0.18;
    this.pitch += 0.025; // Subtle camera jump

    AudioManager.get().playGunshot(this.selectedWeapon);

    EventBus.get().emit('PLAYER_SHOT', {
      weapon: this.selectedWeapon,
      ammo: this.ammoCurrent,
      maxAmmo: this.maxAmmo
    });

    if (this.ammoCurrent <= 0) {
      this.reload();
    }
  }

  public reload(): void {
    if (this.isReloading || this.ammoCurrent >= this.maxAmmo || this.ammoReserve <= 0) return;
    this.isReloading = true;
    this.reloadTimer = 1.8;
  }

  public reset(spawnPos: THREE.Vector3, spawnYaw: number): void {
    this.position.copy(spawnPos);
    this.yaw = spawnYaw;
    this.pitch = 0;
    this.velocity.set(0, 0, 0);
    this.health = 100;
    this.isAlive = true;
    this.isReloading = false;
    this.fireCooldownTimer = 0;
    this.ammoCurrent = this.maxAmmo;
  }

  public update(dt: number): void {
    if (this.fireCooldownTimer > 0) {
      this.fireCooldownTimer -= dt;
    }

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const needed = this.maxAmmo - this.ammoCurrent;
        const take = Math.min(needed, this.ammoReserve);
        this.ammoCurrent += take;
        this.ammoReserve -= take;
        EventBus.get().emit('PLAYER_SHOT', {
          weapon: this.selectedWeapon,
          ammo: this.ammoCurrent,
          maxAmmo: this.maxAmmo
        });
      }
    }

    // Kinematic movement & counter-strafe simulation
    const moveRes = this.inertiaSystem.update(this.velocity, this.moveInput, this.yaw, dt);
    this.velocity.copy(moveRes.newVelocity);

    const targetPos = this.position.clone().addScaledVector(this.velocity, dt);
    const resolvedPos = PhysicsWorld.get().resolveMovement(this.position, targetPos);
    this.position.copy(resolvedPos);

    // Footstep audio synthesizer
    if (moveRes.speed > 0.6) {
      this.stepTimer += dt * (moveRes.speed / 5.0);
      if (this.stepTimer >= 0.35) {
        this.stepTimer = 0;
        AudioManager.get().playStep();
      }
    } else {
      this.stepTimer = 0.2;
    }

    // Viewmodel Recoil Recovery Spring
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), Math.min(1.0, 14.0 * dt));
    this.recoilRot.x = THREE.MathUtils.lerp(this.recoilRot.x, 0, Math.min(1.0, 16.0 * dt));

    // Viewmodel bobbing
    const bobX = Math.sin(Date.now() * 0.008) * (moveRes.speed * 0.004);
    const bobY = Math.abs(Math.cos(Date.now() * 0.012)) * (moveRes.speed * 0.004);

    this.viewmodel.position.set(0.20 + bobX + this.recoilOffset.x, -0.22 - bobY + this.recoilOffset.y, -0.45 + this.recoilOffset.z);
    this.viewmodel.rotation.set(this.recoilRot.x, this.recoilRot.y, this.recoilRot.z);

    EventBus.get().emit('PLAYER_MOVED', {
      speed: moveRes.speed,
      isStopped: moveRes.isAccurate,
      x: this.position.x,
      z: this.position.z
    });
  }
}