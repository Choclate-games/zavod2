import * as THREE from 'three';
import { GameConfig } from '../config/GameConfig';
import { Environment } from './Environment';
import { ParticleSystem } from './ParticleSystem';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public particles: ParticleSystem;
  public environment: Environment;

  private canvas: HTMLCanvasElement;
  private dirLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private slimePointLight!: THREE.PointLight;

  // Screen shake
  private trauma: number = 0;
  private traumaDecay: number = 2.5;

  // Target tracking
  private cameraTarget: THREE.Vector3 = new THREE.Vector3();
  private currentCameraPos: THREE.Vector3 = new THREE.Vector3();
  private zoomLevel: number = 1.0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0f1a);
    this.scene.fog = new THREE.FogExp2(0x0a0f1a, 0.012);

    // Camera setup
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(GameConfig.CAMERA.FOV, aspect, 0.1, 500);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupLighting();
    this.environment = new Environment(this.scene);
    this.particles = new ParticleSystem(this.scene);

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private setupLighting(): void {
    // Sky Ambient Light
    this.ambientLight = new THREE.AmbientLight(0x88aaff, 0.7);
    this.scene.add(this.ambientLight);

    // Warm Sun Directional Light with shadows
    this.dirLight = new THREE.DirectionalLight(0xfff1dc, 1.3);
    this.dirLight.position.set(30, 60, 40);
    this.dirLight.castShadow = true;

    // Shadow Frustum
    const d = 45;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 160;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.bias = -0.0005;

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // Glowing Neon Bio-Slime Point Light
    this.slimePointLight = new THREE.PointLight(0x00ff66, 1.8, 14, 1.5);
    this.slimePointLight.position.set(0, 1.5, 0);
    this.scene.add(this.slimePointLight);
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public updateCamera(targetPos: THREE.Vector3, playerScale: number, dt: number): void {
    // Dynamic Zoom based on player scale/mass
    const targetZoom = THREE.MathUtils.clamp(
      1.0 + (playerScale - 1.0) * 0.45,
      GameConfig.CAMERA.MIN_ZOOM,
      GameConfig.CAMERA.MAX_ZOOM
    );
    this.zoomLevel = THREE.MathUtils.lerp(this.zoomLevel, targetZoom, dt * 2.0);

    // Calculate desired camera position
    const pitchRad = THREE.MathUtils.degToRad(GameConfig.CAMERA.PITCH_DEG);
    const dist = GameConfig.CAMERA.BASE_DISTANCE * this.zoomLevel;
    const height = GameConfig.CAMERA.BASE_HEIGHT * this.zoomLevel;

    const desiredX = targetPos.x;
    const desiredY = targetPos.y + height;
    const desiredZ = targetPos.z + dist;

    // Lerp camera target and position
    this.cameraTarget.lerp(targetPos, dt * GameConfig.CAMERA.LERP_SPEED);
    this.currentCameraPos.x = THREE.MathUtils.lerp(this.currentCameraPos.x, desiredX, dt * GameConfig.CAMERA.LERP_SPEED);
    this.currentCameraPos.y = THREE.MathUtils.lerp(this.currentCameraPos.y, desiredY, dt * GameConfig.CAMERA.LERP_SPEED);
    this.currentCameraPos.z = THREE.MathUtils.lerp(this.currentCameraPos.z, desiredZ, dt * GameConfig.CAMERA.LERP_SPEED);

    // Apply Screen Shake (Trauma^2)
    let shakeX = 0;
    let shakeY = 0;
    let shakeZ = 0;

    if (this.trauma > 0) {
      const shakeMag = this.trauma * this.trauma * 1.2;
      shakeX = (Math.random() * 2 - 1) * shakeMag;
      shakeY = (Math.random() * 2 - 1) * shakeMag * 0.5;
      shakeZ = (Math.random() * 2 - 1) * shakeMag;

      this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
    }

    this.camera.position.set(
      this.currentCameraPos.x + shakeX,
      this.currentCameraPos.y + shakeY,
      this.currentCameraPos.z + shakeZ
    );
    this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z);

    // Update Directional light target to follow player for crisp shadow map
    this.dirLight.position.set(targetPos.x + 30, 60, targetPos.z + 40);
    this.dirLight.target.position.copy(targetPos);

    // Update Slime Point Light
    this.slimePointLight.position.set(targetPos.x, targetPos.y + 0.8 * playerScale, targetPos.z);
    this.slimePointLight.distance = 12 * playerScale;
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(pixelRatio);
  }
}
