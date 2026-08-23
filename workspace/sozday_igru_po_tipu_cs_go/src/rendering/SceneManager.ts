import * as THREE from 'three';
import { ProceduralModels } from './ProceduralModels';
import { ParticleSystem } from './ParticleSystem';

export class SceneManager {
  private static instance: SceneManager;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public viewmodelGroup: THREE.Group;
  public rooftopEnv: THREE.Group;

  public static get(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2C3E50);
    this.scene.fog = new THREE.FogExp2(0x2C3E50, 0.015);

    // 90 FOV perspective camera at y_head_level 1.65m
    this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.05, 500);
    this.camera.position.set(0, 1.65, 6);

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas || undefined,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Viewmodel container attached to camera
    this.viewmodelGroup = new THREE.Group();
    this.camera.add(this.viewmodelGroup);
    this.scene.add(this.camera);

    // Setup Lighting (Warm Amber Sunset 3200K + Cool Sky Fill 6500K)
    this.setupLighting();

    // Setup Environment
    this.rooftopEnv = ProceduralModels.createRooftopEnvironment();
    this.scene.add(this.rooftopEnv);

    // Setup Particle System
    ParticleSystem.get().setScene(this.scene);

    window.addEventListener('resize', () => this.onResize());
  }

  private setupLighting(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x3A4150, 0.6);
    this.scene.add(ambient);

    // Key Light: Warm Amber Sunset 3200K (#FFA044)
    const keyLight = new THREE.DirectionalLight(0xFFA044, 1.8);
    keyLight.position.set(-15, 12, -25);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 60;
    keyLight.shadow.camera.left = -15;
    keyLight.shadow.camera.right = 15;
    keyLight.shadow.camera.top = 15;
    keyLight.shadow.camera.bottom = -15;
    this.scene.add(keyLight);

    // Fill Light: Cool Sky Fill 6500K (#6C8EA4)
    const fillLight = new THREE.HemisphereLight(0x6C8EA4, 0x1A1D24, 0.8);
    this.scene.add(fillLight);
  }

  public onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}