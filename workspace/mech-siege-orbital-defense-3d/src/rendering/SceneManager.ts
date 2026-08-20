// src/rendering/SceneManager.ts
// Three.js scene graph, isometric camera with tracking and screen-shake, adaptive quality governor

import * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem';
import { MeshFactory } from './MeshFactory';

export class SceneManager {
  private static instance: SceneManager;
  private canvas!: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private particles!: ParticleSystem;

  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private cameraOffset = new THREE.Vector3(0, 16, 14);

  // Screen shake
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;

  // Adaptive Quality Governor (from RENDERER_SKILL.md)
  private targetFps = 60;
  private accum = 0;
  private lastRenderMs: number | undefined;
  private perf = {
    avg: 16.6,
    good: 0,
    bad: 0,
    cooldown: 0,
    level: 2, // 0: low, 1: med, 2: high
    ceiling: 2,
    strikes: [0, 0, 0] as number[],
  };

  private dirLight!: THREE.DirectionalLight;

  private constructor() {}

  public static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  public init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06090e);
    this.scene.fog = new THREE.FogExp2(0x06090e, 0.015);

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.5, 200);
    this.camera.position.set(0, 18, 16);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
    });

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const maxPr = isMobile ? 1.5 : Math.min(window.devicePixelRatio, 2.0);
    this.renderer.setPixelRatio(maxPr);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupLights();
    this.setupEnvironment();

    this.particles = new ParticleSystem(this.scene);

    window.addEventListener('resize', () => this.handleResize());
    this.handleResize();
  }

  private setupLights(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x384a60, 1.0);
    this.scene.add(ambient);

    // Directional Key Light (Sun / Orbital Spotlight)
    this.dirLight = new THREE.DirectionalLight(0xfffaed, 1.5);
    this.dirLight.position.set(20, 30, 15);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 70;
    this.dirLight.shadow.camera.left = -25;
    this.dirLight.shadow.camera.right = 25;
    this.dirLight.shadow.camera.top = 25;
    this.dirLight.shadow.camera.bottom = -25;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // Reactor Core glow light
    const coreLight = new THREE.PointLight(0x00e5ff, 2.5, 20);
    coreLight.position.set(0, 2.5, 0);
    this.scene.add(coreLight);
  }

  private setupEnvironment(): void {
    const arena = MeshFactory.createArenaEnvironment();
    this.scene.add(arena);

    // Distant star particles / orbital space backdrop
    const starGeo = new THREE.BufferGeometry();
    const starCount = 400;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 160;
      starPos[i + 1] = Math.random() * 60 + 10;
      starPos[i + 2] = (Math.random() - 0.5) * 160;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x88bbff,
      size: 0.8,
      transparent: true,
      opacity: 0.7,
    });
    const stars = new THREE.Points(starGeo, starMat);
    this.scene.add(stars);
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public getParticles(): ParticleSystem {
    return this.particles;
  }

  public setCameraTarget(x: number, y: number, z: number): void {
    this.cameraTarget.set(x, y, z);
  }

  public triggerScreenShake(intensity: number = 0.4, duration: number = 0.25): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  public handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // Set custom CSS property for safe viewport height
    document.documentElement.style.setProperty('--vp-h', `${height}px`);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public update(dt: number): void {
    // Camera lerp tracking
    const targetPos = new THREE.Vector3(
      this.cameraTarget.x + this.cameraOffset.x,
      this.cameraTarget.y + this.cameraOffset.y,
      this.cameraTarget.z + this.cameraOffset.z
    );

    // Apply shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const progress = this.shakeTimer / this.shakeDuration;
      const currentIntensity = this.shakeIntensity * progress;
      targetPos.x += (Math.random() - 0.5) * currentIntensity;
      targetPos.y += (Math.random() - 0.5) * currentIntensity;
      targetPos.z += (Math.random() - 0.5) * currentIntensity;
    } else {
      this.shakeIntensity = 0;
    }

    this.camera.position.lerp(targetPos, Math.min(1.0, dt * 6.0));
    this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y + 0.5, this.cameraTarget.z);

    this.particles.update(dt);
  }

  public render(dtMs: number): void {
    // Adaptive Quality Governor logic
    const interval = 1000 / this.targetFps;
    this.accum = Math.min(this.accum + dtMs, interval * 3);
    if (this.accum < interval - 2) return;
    this.accum = Math.max(0, this.accum - interval);

    const now = performance.now();
    if (this.lastRenderMs !== undefined) {
      const rdt = now - this.lastRenderMs;
      if (rdt < 500) {
        this.tuneQuality(rdt);
      }
    }
    this.lastRenderMs = now;

    this.renderer.render(this.scene, this.camera);
  }

  private tuneQuality(rdt: number): void {
    const p = this.perf;
    const budget = 1000 / this.targetFps;
    p.avg = p.avg * 0.85 + rdt * 0.15;
    const dt = rdt / 1000;
    if (p.cooldown > 0) p.cooldown -= dt;

    if (p.avg > budget * 1.25) {
      p.good = 0;
      p.bad += dt;
      if (p.bad >= 0.4 && p.level > 0) {
        p.bad = 0;
        p.strikes[p.level] = (p.strikes[p.level] || 0) + 1;
        if (p.strikes[p.level] >= 2) p.ceiling = Math.min(p.ceiling, p.level - 1);
        p.level--;
        p.cooldown = 6;
        this.applyQualityLevel(p.level);
      }
    } else if (p.avg <= budget * 1.1) {
      p.bad = 0;
      p.good += dt;
      if (p.good >= 3 && p.cooldown <= 0 && p.level < p.ceiling) {
        p.good = 0;
        p.level++;
        this.applyQualityLevel(p.level);
      }
    } else {
      p.bad = 0;
      p.good = 0;
    }
  }

  private applyQualityLevel(level: number): void {
    if (level === 0) {
      this.renderer.shadowMap.enabled = false;
      this.renderer.setPixelRatio(1.0);
    } else if (level === 1) {
      this.renderer.shadowMap.enabled = true;
      this.dirLight.shadow.mapSize.width = 512;
      this.dirLight.shadow.mapSize.height = 512;
      this.renderer.setPixelRatio(1.2);
    } else {
      this.renderer.shadowMap.enabled = true;
      this.dirLight.shadow.mapSize.width = 1024;
      this.dirLight.shadow.mapSize.height = 1024;
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      this.renderer.setPixelRatio(isMobile ? 1.5 : Math.min(window.devicePixelRatio, 2.0));
    }
  }
}

export const sceneManager = SceneManager.getInstance();
