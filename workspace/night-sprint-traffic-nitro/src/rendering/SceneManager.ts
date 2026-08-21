import * as THREE from 'three';
import { CONFIG } from '../core/Config';

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private readonly cameraTarget = new THREE.Vector3();
  private readonly cameraPosCurrent = new THREE.Vector3(0, 3.0, -6.0);
  private currentFov = 60.0;
  private currentRoll = 0;
  private traumaCamera = 0;

  private moonlight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  constructor(canvasEl: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0c16, 0.0055);

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.nitro.fovBase,
      window.innerWidth / window.innerHeight,
      0.1,
      1200.0
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: true,
      powerPreference: 'high-performance',
    });

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.10;

    this.moonlight = new THREE.DirectionalLight(0x2b3f66, 1.5);
    this.moonlight.position.set(-50, 100, -50);
    this.moonlight.castShadow = true;
    this.moonlight.shadow.mapSize.width = 1024;
    this.moonlight.shadow.mapSize.height = 1024;
    this.moonlight.shadow.camera.near = 10;
    this.moonlight.shadow.camera.far = 300;
    this.moonlight.shadow.camera.left = -30;
    this.moonlight.shadow.camera.right = 30;
    this.moonlight.shadow.camera.top = 30;
    this.moonlight.shadow.camera.bottom = -30;
    this.scene.add(this.moonlight);

    this.hemiLight = new THREE.HemisphereLight(0x00f0ff, 0x0d101f, 0.85);
    this.scene.add(this.hemiLight);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  updateChaseCamera(
    dt: number,
    playerPos: THREE.Vector3,
    playerForward: THREE.Vector3,
    speedKmh: number,
    isNitro: boolean,
    isOverdrive: boolean,
    isDrifting: boolean,
    slipAngleDeg: number
  ): void {
    // Dynamic FOV
    let targetFov = CONFIG.nitro.fovBase;
    if (isOverdrive) {
      targetFov = CONFIG.nitro.fovStage2;
    } else if (isNitro) {
      targetFov = CONFIG.nitro.fovStage1;
    }
    this.currentFov = THREE.MathUtils.lerp(this.currentFov, targetFov, 5.0 * dt);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    const distanceBack = 5.8 + (speedKmh / 300) * 1.4;
    const heightUp = 2.20 + (speedKmh / 200) * 0.2;

    const idealCamPos = playerPos.clone()
      .sub(playerForward.clone().multiplyScalar(distanceBack))
      .add(new THREE.Vector3(0, heightUp, 0));

    this.cameraPosCurrent.lerp(idealCamPos, 12.0 * dt);

    const lookAheadDist = 8.0 + (speedKmh / 250) * 12.0;
    const idealTarget = playerPos.clone()
      .add(playerForward.clone().multiplyScalar(lookAheadDist))
      .add(new THREE.Vector3(0, 1.2, 0));

    this.cameraTarget.lerp(idealTarget, 14.0 * dt);

    let shakeX = 0;
    let shakeY = 0;
    if (this.traumaCamera > 0) {
      this.traumaCamera = Math.max(0, this.traumaCamera - 4.0 * dt);
      const shakeAmp = this.traumaCamera * this.traumaCamera * 0.28;
      shakeX = (Math.random() - 0.5) * shakeAmp;
      shakeY = (Math.random() - 0.5) * shakeAmp;
    }

    this.camera.position.set(
      this.cameraPosCurrent.x + shakeX,
      this.cameraPosCurrent.y + shakeY,
      this.cameraPosCurrent.z
    );

    this.camera.lookAt(this.cameraTarget);

    let targetRoll = 0;
    if (isDrifting) {
      targetRoll = THREE.MathUtils.clamp(slipAngleDeg * 0.15, -4.5, 4.5) * (Math.PI / 180);
    }
    this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, targetRoll, 8.0 * dt);
    this.camera.rotation.z += this.currentRoll;

    this.moonlight.position.set(playerPos.x - 30, playerPos.y + 80, playerPos.z - 30);
    this.moonlight.target.position.copy(playerPos);
  }

  addTrauma(amount: number): void {
    this.traumaCamera = Math.min(1.0, this.traumaCamera + amount);
  }

  setGarageCamera(carPos: THREE.Vector3, angle: number): void {
    const dist = 5.5;
    const height = 1.8;
    this.camera.position.set(
      carPos.x + Math.sin(angle) * dist,
      carPos.y + height,
      carPos.z + Math.cos(angle) * dist
    );
    this.camera.lookAt(carPos.x, carPos.y + 0.75, carPos.z);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
