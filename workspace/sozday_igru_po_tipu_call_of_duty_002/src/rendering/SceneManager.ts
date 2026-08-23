import * as THREE from 'three';
import { GAME_BALANCE } from '../config/balance';
import { particleSystem } from './ParticleSystem';

export class SceneManager {
  private static instance: SceneManager;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;

  private targetFov: number = GAME_BALANCE.fov_default;
  private currentFov: number = GAME_BALANCE.fov_default;
  private isMenuCamera: boolean = true;
  private menuAngle: number = 0;

  private constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e14);
    this.scene.fog = new THREE.FogExp2(0x0a0e14, 0.025);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(GAME_BALANCE.fov_default, aspect, 0.1, 150);
    this.camera.position.set(0, 5, 15);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: window.devicePixelRatio < 2,
      powerPreference: 'high-performance'
    });

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupLighting();
    particleSystem.init(this.scene);
    this.setupResize();
  }

  public static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  private setupLighting(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x2d3748, 0.45);
    this.scene.add(ambient);

    // Directional moonlight
    const dirLight = new THREE.DirectionalLight(0x94a3b8, 0.85);
    dirLight.position.set(25, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    this.scene.add(dirLight);

    // Blue fill light
    const fillLight = new THREE.DirectionalLight(0x1e293b, 0.35);
    fillLight.position.set(-20, 20, -20);
    this.scene.add(fillLight);
  }

  private setupResize(): void {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
  }

  public setTargetFov(fov: number): void {
    this.targetFov = fov;
  }

  public setMenuCamera(active: boolean): void {
    this.isMenuCamera = active;
  }

  public update(dt: number): void {
    // Smoothly interpolate FOV
    if (Math.abs(this.currentFov - this.targetFov) > 0.05) {
      this.currentFov += (this.targetFov - this.currentFov) * Math.min(1.0, dt * 10.0);
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // Menu live scene background camera orbit
    if (this.isMenuCamera) {
      this.menuAngle += dt * 0.15;
      const radius = 22;
      this.camera.position.x = Math.sin(this.menuAngle) * radius;
      this.camera.position.z = Math.cos(this.menuAngle) * radius;
      this.camera.position.y = 8.5 + Math.sin(this.menuAngle * 2) * 1.5;
      this.camera.lookAt(0, 2, 0);
    }

    particleSystem.update(dt);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}

export const sceneManager = SceneManager.getInstance();