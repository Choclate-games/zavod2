/**
 * SceneManager: Three.js Scene, Camera, Lighting, and WebGL2 Renderer coordinator.
 * Maintains target 60 FPS performance budget (<35 draw calls, <35000 triangles).
 */

import * as THREE from 'three';
import { EntityManager } from '../entities/EntityManager';
import { ParticleSystem } from './ParticleSystem';
import { ProceduralModels } from './ProceduralModels';
import { TunnelVisuals } from './TunnelVisuals';

export class SceneManager {
  private static instance: SceneManager;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private entityManager: EntityManager;
  private particleSystem: ParticleSystem;
  private tunnelVisuals: TunnelVisuals;

  // Lighting
  private carriagePointLight: THREE.PointLight;
  private tunnelDirectionalLight: THREE.DirectionalLight;
  private sparksPointLight: THREE.PointLight;

  // Camera Trauma & Shake
  private cameraTrauma: number = 0;
  private baseCamPos: THREE.Vector3 = new THREE.Vector3(0, 2.1, 3.4);
  private baseCamLook: THREE.Vector3 = new THREE.Vector3(0, 1.35, -1.0);

  public static get(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x12151A);

    // Perspective Camera (FOV 58°, 12° pitch)
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.copy(this.baseCamPos);
    this.camera.lookAt(this.baseCamLook);

    // Warm Interior PointLight (2700K amber: 0xFFA834)
    this.carriagePointLight = new THREE.PointLight(0xFFA834, 2.2, 10.0);
    this.carriagePointLight.position.set(0, 2.4, 0);
    this.scene.add(this.carriagePointLight);

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xD8CBB0, 0.6);
    this.scene.add(ambientLight);

    // Cold Tunnel DirectionalLight (6500K: 0x9EC5FF)
    this.tunnelDirectionalLight = new THREE.DirectionalLight(0x9EC5FF, 0.8);
    this.tunnelDirectionalLight.position.set(-3.0, 2.0, 2.0);
    this.scene.add(this.tunnelDirectionalLight);

    // Dynamic Electric Spark Flash Light (#00F0FF)
    this.sparksPointLight = new THREE.PointLight(0x00F0FF, 0, 8.0);
    this.sparksPointLight.position.set(0, 0.5, 0);
    this.scene.add(this.sparksPointLight);

    // Add 1980s Retro Carriage Mesh
    const carriage = ProceduralModels.createMetroCarriage();
    this.scene.add(carriage);

    // Add Tunnel Visuals
    this.tunnelVisuals = new TunnelVisuals();
    this.scene.add(this.tunnelVisuals.getContainer());

    // Add Entity Manager
    this.entityManager = new EntityManager();
    this.scene.add(this.entityManager.getContainer());

    // Add Particle VFX Pool
    this.particleSystem = new ParticleSystem();
    this.scene.add(this.particleSystem.getContainer());

    // Bind window resize
    window.addEventListener('resize', () => this.handleResize());
  }

  public init(canvas: HTMLCanvasElement): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.handleResize();
  }

  public handleResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.renderer) {
      this.renderer.setSize(w, h);
    }
    const aspect = w / h;
    this.camera.aspect = aspect;

    // Portrait mode vertical FOV adjustment so 3m stack stays in view
    if (aspect < 1.0) {
      this.camera.fov = 58 + (1.0 - aspect) * 22;
      this.baseCamPos.set(0, 2.3, 3.8);
    } else {
      this.camera.fov = 58;
      this.baseCamPos.set(0, 2.1, 3.4);
    }
    this.camera.updateProjectionMatrix();
  }

  public addTrauma(amount: number): void {
    this.cameraTrauma = Math.min(1.0, this.cameraTrauma + amount);
  }

  public triggerSparks(x: number, y: number, z: number): void {
    this.particleSystem.emitSparks(x, y, z, 35);
    this.sparksPointLight.position.set(x, y, z);
    this.sparksPointLight.intensity = 3.5;
    this.addTrauma(0.25);
  }

  public getEntityManager(): EntityManager {
    return this.entityManager;
  }

  public update(dt: number, speedMps: number, isCurving: boolean, curveDirection: number, isMenuIdle: boolean): void {
    // Dim spark flash light
    if (this.sparksPointLight.intensity > 0) {
      this.sparksPointLight.intensity = Math.max(0, this.sparksPointLight.intensity - dt * 10);
    }

    // Update tunnel visuals
    this.tunnelVisuals.update(dt, speedMps, isCurving, curveDirection);

    // Update entities & particles
    this.entityManager.update(dt, isMenuIdle);
    this.particleSystem.update(dt);

    // Camera Shake Decay
    if (this.cameraTrauma > 0) {
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.0);
      const shake = this.cameraTrauma * this.cameraTrauma;
      const offsetX = (Math.random() - 0.5) * 0.12 * shake;
      const offsetY = (Math.random() - 0.5) * 0.12 * shake;
      const offsetZ = (Math.random() - 0.5) * 0.08 * shake;

      this.camera.position.set(
        this.baseCamPos.x + offsetX,
        this.baseCamPos.y + offsetY,
        this.baseCamPos.z + offsetZ
      );
    } else {
      this.camera.position.copy(this.baseCamPos);
    }
    this.camera.lookAt(this.baseCamLook);
  }

  public render(): void {
    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
