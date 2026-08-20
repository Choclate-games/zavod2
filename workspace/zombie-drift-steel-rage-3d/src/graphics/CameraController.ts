import * as THREE from 'three';

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3();
  private currentPos = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();
  private currentLook = new THREE.Vector3();

  // Screen shake / trauma
  private trauma = 0;
  private shakeOffset = new THREE.Vector3();

  // Camera Settings
  public height = 25;
  public distance = 18;
  public baseFov = 50;

  constructor() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.5, 300);
    this.camera.position.set(0, this.height, this.distance);
    this.currentPos.copy(this.camera.position);
    this.currentLook.set(0, 0, 0);
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerVelocity: THREE.Vector3,
    isNitro: boolean,
    speed: number
  ): void {
    // Lead camera ahead of vehicle velocity
    const leadFactor = 0.35;
    const leadX = playerVelocity.x * leadFactor;
    const leadZ = playerVelocity.z * leadFactor;

    this.target.set(
      playerPos.x + leadX * 0.4,
      this.height + (isNitro ? 2.0 : 0),
      playerPos.z + this.distance + leadZ * 0.4
    );

    this.lookTarget.set(playerPos.x + leadX * 0.8, 0, playerPos.z + leadZ * 0.8);

    // Smooth position and look target interpolation
    const followLerp = 1 - Math.exp(-dt * 6.5);
    this.currentPos.lerp(this.target, followLerp);
    this.currentLook.lerp(this.lookTarget, followLerp);

    // Screen Shake Trauma Decay
    if (this.trauma > 0.01) {
      const shakePower = this.trauma * this.trauma;
      const time = performance.now() * 0.05;
      this.shakeOffset.set(
        Math.sin(time * 1.5) * shakePower * 1.4,
        Math.cos(time * 2.1) * shakePower * 0.8,
        Math.sin(time * 1.8) * shakePower * 1.4
      );
      this.trauma = Math.max(0, this.trauma - dt * 2.2);
    } else {
      this.shakeOffset.set(0, 0, 0);
    }

    this.camera.position.copy(this.currentPos).add(this.shakeOffset);
    this.camera.lookAt(this.currentLook);

    // Speed-based dynamic FOV
    const targetFov = this.baseFov + (speed / 35) * 8 + (isNitro ? 7 : 0);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 4);
    this.camera.updateProjectionMatrix();
  }
}
