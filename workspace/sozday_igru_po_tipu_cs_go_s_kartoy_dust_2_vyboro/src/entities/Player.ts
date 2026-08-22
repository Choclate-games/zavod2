import * as THREE from 'three';
import { BALANCE } from '../core/Balance';
import { physics } from '../physics/PhysicsWorld';
import { audio } from '../audio/AudioManager';
import { touchControls } from '../ui/TouchControls';
import { proceduralModels } from '../rendering/ProceduralModels';
import { sceneManager } from '../rendering/SceneManager';
import { particles } from '../rendering/ParticleSystem';
import { events } from '../core/EventBus';
import { storage } from '../platform/StorageService';

export interface WeaponState {
  id: 'ak47' | 'm4a4' | 'awp' | 'deagle';
  name: string;
  ammo: number;
  maxAmmo: number;
  reserveAmmo: number;
  damage: number;
  fireRate: number; // rounds per sec
  timeSinceLastShot: number;
  reloadTime: number;
  isReloading: boolean;
  reloadTimer: number;
}

export class Player {
  public position = new THREE.Vector3(18, 0, -18);
  public velocity = new THREE.Vector3(0, 0, 0);
  public yaw = 0;
  public pitch = 0;

  public team: 'CT' | 'T' = 'CT';
  public health = 100;
  public armor = 100;
  public hasDefuseKit = true;
  public isAlive = true;

  // Weapons
  public currentWeaponSlot: 'primary' | 'secondary' = 'primary';
  public primaryWeapon: WeaponState = {
    id: 'ak47',
    name: 'AK-47',
    ammo: 30,
    maxAmmo: 30,
    reserveAmmo: 90,
    damage: 36,
    fireRate: 10, // 600 RPM
    timeSinceLastShot: 1,
    reloadTime: 2.4,
    isReloading: false,
    reloadTimer: 0,
  };
  public secondaryWeapon: WeaponState = {
    id: 'deagle',
    name: 'Desert Eagle',
    ammo: 7,
    maxAmmo: 7,
    reserveAmmo: 35,
    damage: 53,
    fireRate: 4,
    timeSinceLastShot: 1,
    reloadTime: 2.1,
    isReloading: false,
    reloadTimer: 0,
  };

  // Recoil & Accuracy
  public sprayIndex = 0;
  public recoilOffset = new THREE.Vector2();
  public crosshairSpread = 0;
  public isDefusing = false;

  // Viewmodel
  private viewmodelMesh: THREE.Group | null = null;
  private viewmodelBobTimer = 0;

  // Input states
  private keys: Record<string, boolean> = {};
  private isPointerLocked = false;

  constructor() {
    this.initDesktopInputs();
    this.setupWeaponModel();

    events.on('SET_SENSITIVITY', (sens) => {
      this.mouseSens = sens;
    });

    events.on('EQUIP_SKIN', ({ weaponId, skinId }) => {
      if (this.getCurrentWeapon().id === weaponId) {
        this.setupWeaponModel(skinId);
      }
    });
  }

  private mouseSens = 1.0;

  private initDesktopInputs(): void {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (e.code === 'KeyR') {
        this.reload();
      }
      if (e.code === 'KeyQ') {
        this.switchWeapon();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    const canvas = document.getElementById('game-canvas');
    canvas?.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked && this.isAlive) {
        const factor = 0.0022 * this.mouseSens;
        this.yaw -= e.movementX * factor;
        this.pitch -= e.movementY * factor;
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.isPointerLocked && this.isAlive) {
        this.shoot();
      }
    });
  }

  public setTeam(team: 'CT' | 'T'): void {
    this.team = team;
    this.hasDefuseKit = team === 'CT';
    if (team === 'CT') {
      this.primaryWeapon.id = 'm4a4';
      this.primaryWeapon.name = 'M4A4';
      this.primaryWeapon.damage = 33;
    } else {
      this.primaryWeapon.id = 'ak47';
      this.primaryWeapon.name = 'AK-47';
      this.primaryWeapon.damage = 36;
    }
    this.setupWeaponModel();
  }

  public reset(spawnPos: THREE.Vector3, yaw = 0): void {
    this.position.copy(spawnPos);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.health = 100;
    this.armor = 100;
    this.isAlive = true;
    this.isDefusing = false;
    this.sprayIndex = 0;
    this.recoilOffset.set(0, 0);

    this.primaryWeapon.ammo = this.primaryWeapon.maxAmmo;
    this.primaryWeapon.reserveAmmo = 90;
    this.primaryWeapon.isReloading = false;

    this.secondaryWeapon.ammo = this.secondaryWeapon.maxAmmo;
    this.secondaryWeapon.reserveAmmo = 35;
    this.secondaryWeapon.isReloading = false;

    this.setupWeaponModel();
  }

  public getCurrentWeapon(): WeaponState {
    return this.currentWeaponSlot === 'primary' ? this.primaryWeapon : this.secondaryWeapon;
  }

  public setupWeaponModel(skinId?: string): void {
    const w = this.getCurrentWeapon();
    const save = storage.getData();
    const activeSkin = skinId || save.equippedSkins[w.id];

    if (this.viewmodelMesh) {
      sceneManager.viewmodelContainer.remove(this.viewmodelMesh);
    }

    this.viewmodelMesh = proceduralModels.createWeaponModel(w.id, activeSkin);
    this.viewmodelMesh.position.set(0.22, -0.25, -0.45);
    this.viewmodelMesh.scale.setScalar(0.7);
    sceneManager.viewmodelContainer.add(this.viewmodelMesh);
  }

  public switchWeapon(): void {
    this.currentWeaponSlot = this.currentWeaponSlot === 'primary' ? 'secondary' : 'primary';
    audio.playUiClick();
    this.setupWeaponModel();
  }

  public reload(): void {
    const w = this.getCurrentWeapon();
    if (w.ammo === w.maxAmmo || w.reserveAmmo <= 0 || w.isReloading) return;

    w.isReloading = true;
    w.reloadTimer = w.reloadTime;
    audio.playReload();
  }

  public update(dt: number, onShootRaycast: (origin: THREE.Vector3, dir: THREE.Vector3, damage: number, weaponId: string) => void): void {
    if (!this.isAlive) return;

    const touch = touchControls.consumeInput();
    const w = this.getCurrentWeapon();
    w.timeSinceLastShot += dt;

    // Handle Reloading
    if (w.isReloading) {
      w.reloadTimer -= dt;
      if (w.reloadTimer <= 0) {
        w.isReloading = false;
        const needed = w.maxAmmo - w.ammo;
        const add = Math.min(needed, w.reserveAmmo);
        w.ammo += add;
        w.reserveAmmo -= add;
      }
    }

    // Touch aim look
    if (touch.lookDeltaX !== 0 || touch.lookDeltaY !== 0) {
      const touchSens = 0.004 * this.mouseSens;
      this.yaw -= touch.lookDeltaX * touchSens;
      this.pitch -= touch.lookDeltaY * touchSens;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    }

    if (touch.isSwitchingWeapon) {
      this.switchWeapon();
    }
    if (touch.isReloading) {
      this.reload();
    }

    // ────────────────────────────────────────── MOVEMENT & REAL COUNTER-STRAFING
    let moveX = touch.moveX;
    let moveZ = touch.moveY;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveZ -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveZ += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;

    const inputLen = Math.hypot(moveX, moveZ);
    const hasMoveInput = inputLen > 0.05;

    // Counter-strafe brake
    if (!hasMoveInput || touch.wasSwipeStopped) {
      // Rapid deceleration (< 34 u/s within 0.08s)
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, 24.0, dt);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, 24.0, dt);
    } else {
      const normX = moveX / Math.max(1, inputLen);
      const normZ = moveZ / Math.max(1, inputLen);

      const sinYaw = Math.sin(this.yaw);
      const cosYaw = Math.cos(this.yaw);

      // Transform input to world space
      const worldDirX = normX * cosYaw + normZ * sinYaw;
      const worldDirZ = -normX * sinYaw + normZ * cosYaw;

      const maxSpeed = w.id === 'awp' ? 5.2 : 6.4;
      const accel = 35.0;

      this.velocity.x += worldDirX * accel * dt;
      this.velocity.z += worldDirZ * accel * dt;

      // Clamp speed
      const curSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (curSpeed > maxSpeed) {
        this.velocity.x = (this.velocity.x / curSpeed) * maxSpeed;
        this.velocity.z = (this.velocity.z / curSpeed) * maxSpeed;
      }
    }

    // Apply movement with collision resolution
    const nextPos = new THREE.Vector3(
      this.position.x + this.velocity.x * dt,
      this.position.y,
      this.position.z + this.velocity.z * dt
    );
    this.position.copy(physics.resolveMovement(this.position, nextPos));

    // Dynamic Crosshair Inaccuracy
    const currentSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (currentSpeed < 1.0) {
      this.crosshairSpread = THREE.MathUtils.lerp(this.crosshairSpread, 4, dt * 12);
    } else {
      this.crosshairSpread = THREE.MathUtils.lerp(this.crosshairSpread, currentSpeed * 12, dt * 10);
    }

    // Weapon Bobbing
    if (currentSpeed > 0.5) {
      this.viewmodelBobTimer += dt * currentSpeed * 2.5;
      if (this.viewmodelMesh) {
        this.viewmodelMesh.position.y = -0.25 + Math.sin(this.viewmodelBobTimer) * 0.015;
        this.viewmodelMesh.position.x = 0.22 + Math.cos(this.viewmodelBobTimer * 0.5) * 0.012;
      }
    }

    // Touch Shooting Continuous
    if (touch.isFiring && this.isAlive) {
      this.shoot(onShootRaycast);
    }

    // Defusing Input
    this.isDefusing = (this.keys['KeyE'] || touch.isDefusing) && this.team === 'CT';
  }

  public shoot(onShootRaycast?: (origin: THREE.Vector3, dir: THREE.Vector3, damage: number, weaponId: string) => void): void {
    const w = this.getCurrentWeapon();
    if (w.isReloading || w.ammo <= 0 || w.timeSinceLastShot < 1 / w.fireRate) return;

    w.ammo--;
    w.timeSinceLastShot = 0;
    this.sprayIndex++;

    audio.playGunshot(w.id);
    sceneManager.addTrauma(w.id === 'awp' ? 0.45 : 0.18);

    // Muzzle Flash
    if (this.viewmodelMesh) {
      particles.spawnMuzzleFlash(new THREE.Vector3(this.position.x, this.position.y + 1.5, this.position.z));
      const rightDir = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      particles.spawnCasing(this.position, rightDir);
    }

    // Calculate Inaccuracy Spread
    const isStationary = Math.hypot(this.velocity.x, this.velocity.z) < 1.0;
    const baseSpread = isStationary ? 0.004 : 0.045;

    // Recoil spray curve
    const sprayOffsetY = Math.min(10, this.sprayIndex) * 0.005;
    const sprayOffsetX = Math.sin(this.sprayIndex * 1.2) * 0.004;

    const spreadX = (Math.random() - 0.5) * baseSpread + sprayOffsetX;
    const spreadY = (Math.random() - 0.5) * baseSpread + sprayOffsetY;

    // Shoot Raycast
    const shootOrigin = new THREE.Vector3(this.position.x, this.position.y + 1.62, this.position.z);
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch) + spreadX,
      Math.sin(this.pitch) + spreadY,
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();

    if (onShootRaycast) {
      onShootRaycast(shootOrigin, forward, w.damage, w.id);
    }
  }

  public takeDamage(dmg: number): boolean {
    if (!this.isAlive) return false;

    // Armor absorption
    if (this.armor > 0) {
      const absorbed = dmg * 0.5;
      this.armor = Math.max(0, this.armor - absorbed);
      this.health -= dmg * 0.5;
    } else {
      this.health -= dmg;
    }

    audio.playHit();
    sceneManager.addTrauma(0.25);

    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      return true; // Died
    }
    return false;
  }
}

export const player = new Player();
