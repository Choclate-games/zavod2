import * as THREE from 'three';
import { ProceduralModels } from './ProceduralModels';
import { ParticleSystem } from './ParticleSystem';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public particles: ParticleSystem;
  public arenaGroup: THREE.Group;
  public viewmodelGroup: THREE.Group;

  private trauma = 0;
  private menuAngle = 0;
  private baseFov = 75;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1016);
    this.scene.fog = new THREE.FogExp2(0x0a1016, 0.035);

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(this.baseFov, width / height, 0.1, 150);
    this.camera.position.set(0, 1.7, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupLights();

    this.arenaGroup = ProceduralModels.createArenaMesh();
    this.scene.add(this.arenaGroup);

    this.viewmodelGroup = ProceduralModels.createViewmodel();
    this.camera.add(this.viewmodelGroup);
    this.scene.add(this.camera);

    this.particles = new ParticleSystem(this.scene);

    window.addEventListener('resize', () => this.onResize());
  }

  private setupLights(): void {
    // 1. Рассеянный свет ледяного неба и земли
    const hemiLight = new THREE.HemisphereLight(0x5a7a99, 0x1e293b, 0.65);
    this.scene.add(hemiLight);

    // 2. Основной направленный холодный лунный свет с тенями
    const dirLight = new THREE.DirectionalLight(0x9bc4e2, 0.9);
    dirLight.position.set(-15, 25, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 60;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    this.scene.add(dirLight);

    // 3. Прожекторы амбразур
    for (const x of [-8, 8]) {
      const spot = new THREE.SpotLight(0xeef6ff, 1.2, 35, Math.PI / 4, 0.4);
      spot.position.set(x, 4.5, -5.5);
      spot.target.position.set(x, 0, -18);
      this.scene.add(spot);
      this.scene.add(spot.target);
    }
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public updateCameraMenu(dt: number): void {
    this.viewmodelGroup.visible = false;
    this.menuAngle += dt * 0.15;
    const radius = 6.0;
    this.camera.position.x = Math.sin(this.menuAngle) * radius;
    this.camera.position.y = 2.4;
    this.camera.position.z = 2.0 + Math.cos(this.menuAngle) * 2.0;
    this.camera.lookAt(0, 1.0, -8);
  }

  public updateCameraFps(
    playerPos: { x: number; y: number; z: number },
    yaw: number,
    pitch: number,
    isSprinting: boolean,
    bobOffset: number,
    dt: number
  ): void {
    this.viewmodelGroup.visible = true;

    // Травма / Тряска экрана
    let shakeX = 0;
    let shakeY = 0;
    let shakeZ = 0;
    if (this.trauma > 0.001) {
      const shakeMag = this.trauma * this.trauma * 0.08;
      shakeX = (Math.random() - 0.5) * shakeMag;
      shakeY = (Math.random() - 0.5) * shakeMag;
      shakeZ = (Math.random() - 0.5) * shakeMag;
      this.trauma = Math.max(0, this.trauma - dt * 1.5);
    }

    this.camera.position.set(
      playerPos.x + shakeX,
      playerPos.y + bobOffset + shakeY,
      playerPos.z + shakeZ
    );

    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.y = yaw;
    this.camera.rotation.x = pitch;

    // FOV эффект спринта
    const targetFov = isSprinting ? this.baseFov + 10 : this.baseFov;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
    this.camera.updateProjectionMatrix();

    // Покачивание вьюмодели
    this.viewmodelGroup.position.y = -0.05 + Math.sin(bobOffset * 10) * 0.015;
    this.viewmodelGroup.position.x = Math.cos(bobOffset * 5) * 0.01;
  }

  public onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public render(dt: number): void {
    this.particles.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
