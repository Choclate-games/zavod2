import * as THREE from "three";
import type { InputSnapshot, ShieldLevel, WeaponId } from "../core/Types";
import { ProceduralMeshFactory } from "./ProceduralMeshFactory";

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public playerGroup: THREE.Group;
  public cameraPitchNode: THREE.Group;
  public viewmodelGroup: THREE.Group;

  // Rotation angles
  private yaw = 0;
  private pitch = 0;

  // Tactical Lean
  private currentLeanX = 0;
  private targetLeanX = 0;
  private currentLeanRoll = 0;
  private targetLeanRoll = 0;
  private leanSpeed = 12.0;

  // Recoil Spring
  private recoilPitch = 0;
  private recoilYaw = 0;
  private recoilRecoverySpeed = 14.0;

  // Head Bobbing
  private bobTimer = 0;
  private bobAmount = 0.035;

  // Dynamic FOV
  private baseFov = 75;
  private targetFov = 75;
  private currentFov = 75;

  // Shield & Weapon Viewmodels
  private shieldMesh: THREE.Group | null = null;
  private weaponMesh: THREE.Group | null = null;
  private muzzleNode: THREE.Object3D | null = null;

  // Eye heights
  public readonly standEyeHeight = 1.68;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 100);
    this.camera.rotation.order = "YXZ";

    this.playerGroup = new THREE.Group();
    this.playerGroup.name = "PlayerChassis";

    this.cameraPitchNode = new THREE.Group();
    this.cameraPitchNode.name = "CameraPitchNode";
    this.cameraPitchNode.position.y = this.standEyeHeight;
    this.playerGroup.add(this.cameraPitchNode);

    this.cameraPitchNode.add(this.camera);

    // Viewmodel container attached directly to camera
    this.viewmodelGroup = new THREE.Group();
    this.viewmodelGroup.name = "ViewmodelRig";
    this.camera.add(this.viewmodelGroup);
  }

  setWeapon(weaponId: WeaponId): void {
    if (this.weaponMesh) {
      this.viewmodelGroup.remove(this.weaponMesh);
    }
    this.weaponMesh = ProceduralMeshFactory.createWeaponMesh(weaponId);
    // Weapon rests at bottom-right of viewport pointing forward (+Z in viewmodel space)
    this.weaponMesh.position.set(0.24, -0.22, -0.45);
    this.weaponMesh.rotation.y = Math.PI; // Face forward down -Z camera view
    this.viewmodelGroup.add(this.weaponMesh);

    this.muzzleNode = this.weaponMesh.getObjectByName("MuzzleNode") || null;
  }

  setShield(level: ShieldLevel): void {
    if (this.shieldMesh) {
      this.viewmodelGroup.remove(this.shieldMesh);
    }
    this.shieldMesh = ProceduralMeshFactory.createBallisticShield(level);
    // Shield rests at bottom-left covering center-left of screen
    this.shieldMesh.position.set(-0.16, -0.15, -0.52);
    this.shieldMesh.rotation.y = Math.PI; // Face forward down -Z
    this.viewmodelGroup.add(this.shieldMesh);
  }

  applyRecoil(pitchAmount: number, yawAmount: number): void {
    this.recoilPitch += pitchAmount;
    this.recoilYaw += (Math.random() - 0.5) * yawAmount * 2;
  }

  triggerBreachShake(): void {
    this.targetFov = 62;
    this.applyRecoil(0.12, 0.08);
  }

  update(realDt: number, input: InputSnapshot, isMoving: boolean, isShieldHold: boolean): void {
    // 1. Mouse / Touch Aim look
    const mouseSens = 0.0022;
    this.yaw -= input.aimDeltaX * mouseSens;
    this.pitch -= input.aimDeltaY * mouseSens;

    // Pitch clamping (-85 to +85 deg)
    const maxPitch = (85 * Math.PI) / 180;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // 2. Tactical Lean Handling (Q: -0.45m + roll, E: +0.45m - roll)
    if (input.leanLeft) {
      this.targetLeanX = -0.45;
      this.targetLeanRoll = 0.24; // ~14 deg
    } else if (input.leanRight) {
      this.targetLeanX = 0.45;
      this.targetLeanRoll = -0.24; // ~-14 deg
    } else {
      this.targetLeanX = 0;
      this.targetLeanRoll = 0;
    }

    const leanFactor = Math.min(1.0, this.leanSpeed * realDt);
    this.currentLeanX += (this.targetLeanX - this.currentLeanX) * leanFactor;
    this.currentLeanRoll += (this.targetLeanRoll - this.currentLeanRoll) * leanFactor;

    // 3. Recoil Spring Recovery
    const recoilFactor = Math.min(1.0, this.recoilRecoverySpeed * realDt);
    this.recoilPitch -= this.recoilPitch * recoilFactor;
    this.recoilYaw -= this.recoilYaw * recoilFactor;

    // 4. Weapon Bobbing
    let bobX = 0;
    let bobY = 0;
    if (isMoving) {
      this.bobTimer += realDt * 9.0;
      bobX = Math.sin(this.bobTimer * 0.5) * this.bobAmount * 0.6;
      bobY = Math.abs(Math.sin(this.bobTimer)) * this.bobAmount;
    } else {
      this.bobTimer = 0;
    }

    // 5. Apply Transforms
    this.playerGroup.rotation.y = this.yaw + this.recoilYaw;
    this.cameraPitchNode.rotation.x = this.pitch + this.recoilPitch;
    this.camera.position.set(this.currentLeanX + bobX, bobY, 0);
    this.camera.rotation.z = this.currentLeanRoll;

    // 6. Dynamic FOV recovery
    this.targetFov += (this.baseFov - this.targetFov) * Math.min(1.0, 5.0 * realDt);
    this.currentFov += (this.targetFov - this.currentFov) * Math.min(1.0, 8.0 * realDt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // 7. Shield Stance Dynamics
    if (this.shieldMesh) {
      let targetShieldX = -0.16;
      let targetShieldY = -0.15;
      let targetShieldZ = -0.52;

      if (isShieldHold) {
        // Full Guard: Center shield in front of face
        targetShieldX = 0.0;
        targetShieldY = -0.05;
        targetShieldZ = -0.42;
      } else if (input.leanRight) {
        // Lean Right: shift shield to left to expose gun barrel
        targetShieldX = -0.32;
        targetShieldY = -0.2;
      } else if (input.leanLeft) {
        // Lean Left: shift shield right
        targetShieldX = 0.12;
      }

      this.shieldMesh.position.x += (targetShieldX - this.shieldMesh.position.x) * leanFactor;
      this.shieldMesh.position.y += (targetShieldY - this.shieldMesh.position.y) * leanFactor;
      this.shieldMesh.position.z += (targetShieldZ - this.shieldMesh.position.z) * leanFactor;
    }

    // 8. Weapon Position Dynamics
    if (this.weaponMesh) {
      let targetGunX = 0.24;
      let targetGunY = -0.22;
      let targetGunZ = -0.45;

      if (input.leanRight) {
        targetGunX = 0.35; // Extend gun out for clear line of fire
      } else if (input.leanLeft) {
        targetGunX = -0.15;
      }

      this.weaponMesh.position.x += (targetGunX - this.weaponMesh.position.x) * leanFactor;
      this.weaponMesh.position.y += (targetGunY - this.weaponMesh.position.y) * leanFactor;
      this.weaponMesh.position.z += (targetGunZ - this.weaponMesh.position.z) * leanFactor;
    }
  }

  getMuzzleWorldPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3();
    if (this.muzzleNode) {
      this.muzzleNode.getWorldPosition(pos);
    } else {
      this.camera.getWorldPosition(pos);
    }
    return pos;
  }

  getForwardDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir;
  }

  getAimRay(): { origin: THREE.Vector3; direction: THREE.Vector3 } {
    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const direction = this.getForwardDirection();
    return { origin, direction };
  }

  isLeaning(): boolean {
    return Math.abs(this.currentLeanX) > 0.15;
  }

  setPosition(x: number, y: number, z: number, rotY = 0): void {
    this.playerGroup.position.set(x, y, z);
    this.yaw = rotY;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.currentLeanX = 0;
    this.currentLeanRoll = 0;
  }
}
