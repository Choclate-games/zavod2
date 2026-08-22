import * as THREE from 'three';
import { dust2Map } from './Dust2Map';
import { particles } from './ParticleSystem';

export type CameraMode = 'MENU_PAN' | 'FPS_PLAYER';

export class SceneManager {
  private static instance: SceneManager;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;

  // Viewmodel Overlay
  public readonly viewmodelScene: THREE.Scene;
  public readonly viewmodelCamera: THREE.PerspectiveCamera;
  public viewmodelContainer: THREE.Group;

  private cameraMode: CameraMode = 'MENU_PAN';
  private menuPanAngle = 0;

  // Camera Shake & Trauma
  private trauma = 0;
  private shakeOffset = new THREE.Vector3();
  private shakeEuler = new THREE.Euler();

  private constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Canvas #game-canvas not found');
    }

    // Main World Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xD8C0A0); // Warm Dust 2 desert sky
    this.scene.fog = new THREE.FogExp2(0xD8C0A0, 0.008);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 200);

    // Viewmodel Scene (rendered on top without near clipping)
    this.viewmodelScene = new THREE.Scene();
    this.viewmodelCamera = new THREE.PerspectiveCamera(65, aspect, 0.01, 10);
    this.viewmodelContainer = new THREE.Group();
    this.viewmodelScene.add(this.viewmodelContainer);

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;

    this.initLighting();
    dust2Map.build(this.scene);
    particles.init(this.scene);

    window.addEventListener('resize', () => this.handleResize());
  }

  public static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  private initLighting(): void {
    // 1. Warm Sunset Sun Light (Directional)
    const sunLight = new THREE.DirectionalLight(0xFFF2D6, 1.4);
    sunLight.position.set(40, 50, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -35;
    sunLight.shadow.camera.right = 35;
    sunLight.shadow.camera.top = 35;
    sunLight.shadow.camera.bottom = -35;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    // 2. Desert Ambient Hemisphere
    const hemiLight = new THREE.HemisphereLight(0xD8ECF8, 0xBCA07D, 0.65);
    this.scene.add(hemiLight);

    // 3. Viewmodel Lighting
    const vmDirLight = new THREE.DirectionalLight(0xFFFFFF, 1.2);
    vmDirLight.position.set(2, 4, 3);
    this.viewmodelScene.add(vmDirLight);
    const vmAmbient = new THREE.AmbientLight(0xCCCCCC, 0.8);
    this.viewmodelScene.add(vmAmbient);
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.viewmodelCamera.aspect = aspect;
    this.viewmodelCamera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  public update(dt: number, playerPos?: THREE.Vector3, playerYaw = 0, playerPitch = 0): void {
    particles.update(dt);

    // Decay trauma
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 2.0);
      const shakePower = this.trauma * this.trauma;
      this.shakeOffset.set(
        (Math.random() - 0.5) * 0.15 * shakePower,
        (Math.random() - 0.5) * 0.15 * shakePower,
        (Math.random() - 0.5) * 0.15 * shakePower
      );
      this.shakeEuler.set(
        (Math.random() - 0.5) * 0.08 * shakePower,
        (Math.random() - 0.5) * 0.08 * shakePower,
        (Math.random() - 0.5) * 0.05 * shakePower
      );
    } else {
      this.shakeOffset.set(0, 0, 0);
      this.shakeEuler.set(0, 0, 0);
    }

    if (this.cameraMode === 'MENU_PAN') {
      // Cinematic orbital pan over Site A
      this.menuPanAngle += dt * 0.12;
      const radius = 18;
      const targetA = new THREE.Vector3(18, 1.5, -12);
      this.camera.position.set(
        targetA.x + Math.cos(this.menuPanAngle) * radius,
        7.5,
        targetA.z + Math.sin(this.menuPanAngle) * radius
      );
      this.camera.lookAt(targetA);
      this.viewmodelContainer.visible = false;
    } else if (this.cameraMode === 'FPS_PLAYER' && playerPos) {
      // First-person player camera
      this.camera.position.set(
        playerPos.x + this.shakeOffset.x,
        playerPos.y + 1.62 + this.shakeOffset.y,
        playerPos.z + this.shakeOffset.z
      );

      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = playerYaw + this.shakeEuler.y;
      this.camera.rotation.x = playerPitch + this.shakeEuler.x;
      this.camera.rotation.z = this.shakeEuler.z;

      this.viewmodelContainer.visible = true;
    }
  }

  public render(): void {
    this.renderer.clear();
    // Render 3D World
    this.renderer.render(this.scene, this.camera);

    // Render 3D Viewmodel on top
    if (this.cameraMode === 'FPS_PLAYER' && this.viewmodelContainer.visible) {
      this.renderer.clearDepth();
      this.renderer.render(this.viewmodelScene, this.viewmodelCamera);
    }
  }
}

export const sceneManager = SceneManager.getInstance();
