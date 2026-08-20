import * as THREE from 'three';
import { ArenaEnvironment } from './ArenaEnvironment';
import { particleSystem } from './ParticleSystem';
import { WeaponTrail } from './WeaponTrail';
import { globalEventBus } from '../core/EventBus';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public environment: ArenaEnvironment;
  public weaponTrail: WeaponTrail;

  private sunLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private groundPlane: THREE.Plane;
  private raycaster: THREE.Raycaster;
  private mouseVec: THREE.Vector2;

  private targetCamPos: THREE.Vector3 = new THREE.Vector3();
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private readonly CAM_OFFSET = new THREE.Vector3(0, 19.0, 16.5);

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x12100e);
    this.scene.fog = new THREE.FogExp2(0x12100e, 0.018);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 150);
    this.camera.position.copy(this.CAM_OFFSET);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    container.appendChild(this.renderer.domElement);

    // Lighting: Roman high noon sun
    this.ambientLight = new THREE.AmbientLight(0xfff1e0, 0.7);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    this.sunLight.position.set(18, 32, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 80;
    const d = 24;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Warm bounce light from Colosseum sand
    const hemiLight = new THREE.HemisphereLight(0xffe4b5, 0x5a4128, 0.6);
    this.scene.add(hemiLight);

    // Build Environment
    this.environment = new ArenaEnvironment();
    this.scene.add(this.environment.group);

    // Particle & Weapon trail systems
    this.scene.add(particleSystem.group);

    this.weaponTrail = new WeaponTrail();
    this.scene.add(this.weaponTrail.mesh);

    // Raycaster & Ground Plane
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.raycaster = new THREE.Raycaster();
    this.mouseVec = new THREE.Vector2();

    this.setupListeners();
    this.setupResize();
  }

  private setupListeners(): void {
    globalEventBus.on('camera:shake', (data) => {
      this.shakeIntensity = data.intensity;
      this.shakeDuration = data.duration;
    });

    globalEventBus.on('enemy:hit', (data) => {
      if (data.isCrit) {
        particleSystem.emitSparks(data.position.x, data.position.y, data.position.z, 22);
      }
      particleSystem.emitBlood(data.position.x, data.position.y, data.position.z, 18);
    });

    globalEventBus.on('enemy:killed', (data) => {
      particleSystem.emitCoins(data.position.x, data.position.y, data.position.z, 16);
      particleSystem.emitSparks(data.position.x, data.position.y, data.position.z, 28);
    });
  }

  public getGroundIntersection(clientX: number, clientY: number): THREE.Vector3 | null {
    this.mouseVec.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouseVec.y = -(clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVec, this.camera);
    const target = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, target);
  }

  public update(dt: number, targetPos: THREE.Vector3): void {
    this.environment.update(dt);
    particleSystem.update(dt);

    // Smooth camera follow
    this.targetCamPos.copy(targetPos).add(this.CAM_OFFSET);

    // Handle screen shake
    let shakeOffset = new THREE.Vector3();
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      const mag = this.shakeIntensity * (this.shakeDuration / 0.3);
      shakeOffset.set((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    this.camera.position.lerp(this.targetCamPos.clone().add(shakeOffset), Math.min(1.0, 8.0 * dt));
    this.camera.lookAt(targetPos.x, targetPos.y + 0.8, targetPos.z);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private setupResize(): void {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    });
  }
}
