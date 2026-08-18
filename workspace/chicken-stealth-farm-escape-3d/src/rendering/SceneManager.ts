// src/rendering/SceneManager.ts
import * as THREE from 'three';
import { AdaptiveQualityGovernor } from './AdaptiveQuality';
import { particleSystem } from './ParticleSystem';

export class SceneManager {
  private static instance: SceneManager;

  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public governor: AdaptiveQualityGovernor;

  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  private cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private cameraOffset: THREE.Vector3 = new THREE.Vector3(12, 14, 12); // Isometric 45deg yaw, 50deg pitch
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;

  private constructor() {
    const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7bc644); // Farm Grass Green
    this.scene.fog = new THREE.FogExp2(0x7bc644, 0.018);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(this.cameraTarget);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting setup
    this.hemiLight = new THREE.HemisphereLight(0xfff8e7, 0x5a8a2d, 0.7);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfffaed, 1.25);
    this.dirLight.position.set(16, 24, 12);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 60;

    const d = 18;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.001;

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // Adaptive Quality governor
    this.governor = new AdaptiveQualityGovernor(this.renderer);
    this.governor.setDirectionalLight(this.dirLight);

    // Particle system init
    particleSystem.init(this.scene);

    // Create ground plane
    this.createGround();

    // Window resize handler
    window.addEventListener('resize', () => this.onWindowResize());
    this.updateViewportCSS();
  }

  public static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  private createGround(): void {
    const groundGeom = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x6bb836,
      roughness: 0.95
    });

    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    ground.name = 'Ground';
    this.scene.add(ground);

    // Subtle farm ground grid / tile lines for toon aesthetics
    const grid = new THREE.GridHelper(80, 40, 0x5ea32d, 0x62ab30);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  public setCameraTarget(x: number, y: number, z: number, immediate: boolean = false): void {
    if (immediate) {
      this.cameraTarget.set(x, y, z);
      this.camera.position.set(x + this.cameraOffset.x, y + this.cameraOffset.y, z + this.cameraOffset.z);
      this.camera.lookAt(this.cameraTarget);
      this.dirLight.position.set(x + 16, y + 24, z + 12);
      this.dirLight.target.position.set(x, y, z);
    } else {
      this.cameraTarget.lerp(new THREE.Vector3(x, y, z), 0.1);
    }
  }

  public triggerScreenShake(intensity: number = 0.25, duration: number = 0.3): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  public render(dt: number): void {
    this.governor.beforeRender();

    // Smooth camera follow
    let shakeX = 0;
    let shakeZ = 0;
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      const progress = Math.max(0, this.shakeDuration);
      shakeX = (Math.random() - 0.5) * this.shakeIntensity * (progress / 0.3);
      shakeZ = (Math.random() - 0.5) * this.shakeIntensity * (progress / 0.3);
    }

    const desiredCamPos = new THREE.Vector3(
      this.cameraTarget.x + this.cameraOffset.x + shakeX,
      this.cameraTarget.y + this.cameraOffset.y,
      this.cameraTarget.z + this.cameraOffset.z + shakeZ
    );

    this.camera.position.lerp(desiredCamPos, 0.12);
    this.camera.lookAt(this.cameraTarget);

    // Follow sunlight target to center around camera target for optimal shadow resolution
    this.dirLight.position.set(this.cameraTarget.x + 16, this.cameraTarget.y + 24, this.cameraTarget.z + 12);
    this.dirLight.target.position.set(this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z);

    // Update particle system
    particleSystem.update(dt);

    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(): void {
    this.updateViewportCSS();
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private updateViewportCSS(): void {
    const vh = window.innerHeight;
    document.documentElement.style.setProperty('--vp-h', `${vh}px`);
  }
}

export const sceneManager = SceneManager.getInstance();
