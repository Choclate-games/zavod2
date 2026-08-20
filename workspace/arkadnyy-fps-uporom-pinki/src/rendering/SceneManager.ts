import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { ParticleSystem } from './ParticleSystem';
import { ProceduralModels } from './ProceduralModels';
import { WeaponType } from '../types';

export class SceneManager {
  private static instance: SceneManager;
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;

  // Viewmodel components (Camera child rig)
  public viewmodelRig = new THREE.Group();
  public bootMesh!: THREE.Group;
  public weaponMeshGroup = new THREE.Group();
  public currentWeaponMesh: THREE.Group | null = null;
  public muzzleLight!: THREE.PointLight;

  // Camera dynamics
  private baseFov = 85;
  private currentFov = 85;
  private targetFov = 85;
  private fovKickTimer = 0;
  private fovKickDuration = 0.14;

  // Screen shake / Camera trauma
  private trauma = 0;
  private traumaDecay = 2.5;

  // Quality settings
  private isMobile = false;

  private constructor() {
    this.isMobile =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth < 900;
  }

  public static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  public init(container: HTMLElement): void {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1e24);
    this.scene.fog = new THREE.FogExp2(0x1a1e24, 0.025);

    // 2. Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.1, 150);
    this.camera.position.set(0, 1.7, 0);
    this.scene.add(this.camera);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: !this.isMobile,
      stencil: false,
      depth: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const maxPixelRatio = this.isMobile ? 1.5 : Math.min(window.devicePixelRatio, 2.0);
    this.renderer.setPixelRatio(maxPixelRatio);
    this.renderer.shadowMap.enabled = !this.isMobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    container.appendChild(this.renderer.domElement);

    // 4. Lighting
    this.setupLighting();

    // 5. Setup Viewmodel Rig (Boot and Weapons attached to camera)
    this.setupViewmodels();

    // 6. Init Particles
    ParticleSystem.getInstance().init(this.scene);

    // 7. Event listeners
    this.setupEvents();
    window.addEventListener('resize', this.onWindowResize);
  }

  private setupLighting(): void {
    // Warm Ambient Light
    const ambient = new THREE.AmbientLight(0xffeedd, 0.7);
    this.scene.add(ambient);

    // Key Directional Light (Sun/Ceiling Flood)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(15, 25, 15);
    dirLight.castShadow = !this.isMobile;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 60;
    const d = 25;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    // Dynamic Muzzle Flash Point Light
    this.muzzleLight = new THREE.PointLight(0xffaa33, 0, 8);
    this.muzzleLight.position.set(0.3, -0.2, -0.6);
    this.camera.add(this.muzzleLight);
  }

  private setupViewmodels(): void {
    this.camera.add(this.viewmodelRig);

    // Kicker Boot Rig
    this.bootMesh = ProceduralModels.createPlayerBootMesh();
    this.bootMesh.position.set(0.15, -0.7, -0.3);
    this.bootMesh.rotation.set(0.4, 0, 0);
    this.bootMesh.visible = false; // Shown during kick animation
    this.viewmodelRig.add(this.bootMesh);

    // Weapon Rig
    this.viewmodelRig.add(this.weaponMeshGroup);
    this.setWeaponViewmodel('PISTOL');
  }

  public setWeaponViewmodel(type: WeaponType): void {
    // Clear old
    while (this.weaponMeshGroup.children.length > 0) {
      this.weaponMeshGroup.remove(this.weaponMeshGroup.children[0]);
    }

    if (type === 'KICK') {
      this.currentWeaponMesh = null;
      return;
    }

    const mesh = ProceduralModels.createWeaponViewmodel(type);
    if (type === 'SHOTGUN') {
      mesh.position.set(0.28, -0.32, -0.55);
      mesh.rotation.set(0, 0, 0);
    } else if (type === 'SMG') {
      mesh.position.set(0.25, -0.28, -0.5);
      mesh.rotation.set(0, 0, 0);
    } else {
      // PISTOL
      mesh.position.set(0.24, -0.25, -0.45);
      mesh.rotation.set(0, 0, 0);
    }

    this.currentWeaponMesh = mesh;
    this.weaponMeshGroup.add(mesh);
  }

  private setupEvents(): void {
    const bus = EventBus.getInstance();

    bus.on('camera:shake', ({ intensity }) => {
      this.addTrauma(intensity);
    });

    bus.on('camera:fovKick', ({ targetFov, durationSec }) => {
      this.triggerFovKick(targetFov, durationSec);
    });
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public triggerFovKick(targetFov: number, durationSec: number): void {
    this.targetFov = targetFov;
    this.fovKickDuration = durationSec;
    this.fovKickTimer = durationSec;
  }

  public triggerMuzzleFlash(): void {
    this.muzzleLight.intensity = 4.0;
    setTimeout(() => {
      this.muzzleLight.intensity = 0;
    }, 50);
  }

  public update(dt: number): void {
    // 1. Update FOV Dynamics
    if (this.fovKickTimer > 0) {
      this.fovKickTimer -= dt;
      const progress = 1.0 - this.fovKickTimer / this.fovKickDuration;
      if (progress < 0.5) {
        // Kick down
        this.currentFov = THREE.MathUtils.lerp(this.baseFov, this.targetFov, progress * 2);
      } else {
        // Recover
        this.currentFov = THREE.MathUtils.lerp(this.targetFov, this.baseFov, (progress - 0.5) * 2);
      }
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    } else {
      if (this.camera.fov !== this.baseFov) {
        this.camera.fov = this.baseFov;
        this.camera.updateProjectionMatrix();
      }
    }

    // 2. Camera Trauma Shake
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
      const shake = this.trauma * this.trauma; // Non-linear response

      const yawOffset = (Math.random() - 0.5) * 0.08 * shake;
      const pitchOffset = (Math.random() - 0.5) * 0.08 * shake;
      const rollOffset = (Math.random() - 0.5) * 0.06 * shake;

      this.camera.rotation.z = rollOffset;
      this.camera.position.x += (Math.random() - 0.5) * 0.05 * shake;
      this.camera.position.y += (Math.random() - 0.5) * 0.05 * shake;
    } else {
      this.camera.rotation.z = 0;
    }

    // 3. Update Particles
    ParticleSystem.getInstance().update(dt);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize = (): void => {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
