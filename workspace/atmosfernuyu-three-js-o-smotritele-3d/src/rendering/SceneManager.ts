import * as THREE from 'three';
import { COLORS, SPOTLIGHT, math } from '../config/GameConfig';

interface QualityLevel {
  pixelRatio: number;
  shadows: boolean;
}

/**
 * Rendering Layer. Owns the WebGL renderer, scene graph, lighting and camera.
 * Implements an auto-tuning quality governor that converges to the richest
 * quality the device sustains at 60 fps (see skills/RENDERER_SKILL.md): it starts
 * optimistic and steps DOWN on sustained overload, probing back UP only after a
 * stable window — never crawling up from a reduced launch.
 */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private readonly spotLight: THREE.SpotLight;
  private readonly spotTarget: THREE.Object3D;
  private readonly ambient: THREE.AmbientLight;
  private readonly playerGlow: THREE.PointLight;
  private readonly snow: THREE.Points;

  private targetFps: number;
  private levelIndex = 0;
  private readonly ladder: QualityLevel[];
  private perfAvg = 16.7;
  private perfGood = 0;
  private perfBad = 0;
  private cooldown = 6;
  private ceiling = 99;
  private lastRenderMs = 0;
  private warmup = 1.0;
  private refreshSamples: number[] = [];
  private sampled = false;

  constructor(canvas: HTMLCanvasElement, isMobile: boolean) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setClearColor(COLORS.fogDeep, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.fogDeep);
    this.scene.fog = new THREE.FogExp2(COLORS.fogDeep, 0.018);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);
    this.camera.position.set(0, 16, 18);

    this.ambient = new THREE.AmbientLight(0x16304a, 0.35);
    this.scene.add(this.ambient);

    this.spotLight = new THREE.SpotLight(
      COLORS.light,
      16,
      SPOTLIGHT.range[1],
      THREE.MathUtils.degToRad(SPOTLIGHT.angleDeg[1]),
      0.45,
      1.4,
    );
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.set(1024, 1024);
    this.spotLight.shadow.camera.near = 0.5;
    this.spotLight.shadow.camera.far = 60;
    this.scene.add(this.spotLight);
    this.spotTarget = new THREE.Object3D();
    this.scene.add(this.spotTarget);
    this.spotLight.target = this.spotTarget;

    this.playerGlow = new THREE.PointLight(COLORS.player, 2.2, 10, 2);
    this.scene.add(this.playerGlow);

    this.snow = this.buildSnow();
    this.scene.add(this.snow);

    const maxPr = isMobile ? 1.5 : 2.0;
    this.ladder = isMobile
      ? [
          { pixelRatio: 1.0, shadows: false },
          { pixelRatio: 1.25, shadows: false },
          { pixelRatio: 1.5, shadows: false },
          { pixelRatio: 1.5, shadows: true },
        ]
      : [
          { pixelRatio: 1.0, shadows: false },
          { pixelRatio: 1.25, shadows: true },
          { pixelRatio: 1.5, shadows: true },
          { pixelRatio: maxPr, shadows: true },
        ];
    this.levelIndex = this.ladder.length - 1; // start optimistic
    this.targetFps = 60;
    this.applyLevel(this.levelIndex);
    this.resize();
  }

  private buildSnow(): THREE.Points {
    const count = 1400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = math.randRange(-50, 50);
      positions[i * 3 + 1] = math.randRange(-130, 5);
      positions[i * 3 + 2] = math.randRange(-50, 50);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x9fd0ff,
      size: 0.18,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  add(obj: THREE.Object3D): void {
    this.scene.add(obj);
  }
  remove(obj: THREE.Object3D): void {
    this.scene.remove(obj);
  }

  /** Position the player's spotlight and local glow. */
  setPlayerLight(pos: THREE.Vector3, dir: THREE.Vector3, tier: number): void {
    this.spotLight.position.copy(pos);
    this.spotTarget.position.copy(pos).addScaledVector(dir, 12);
    this.spotLight.distance = SPOTLIGHT.range[tier];
    this.spotLight.intensity = SPOTLIGHT.intensity[tier];
    this.spotLight.angle = THREE.MathUtils.degToRad(SPOTLIGHT.angleDeg[tier]);
    this.playerGlow.position.copy(pos);
  }

  setPlayerGlow(visible: boolean): void {
    this.playerGlow.intensity = visible ? 2.2 : 0.6;
  }

  /** Smooth follow camera (fixed offset, 45° downward pitch). */
  updateCamera(target: THREE.Vector3, dt: number, snap = false): void {
    const desired = new THREE.Vector3(target.x, target.y + 14, target.z + 16);
    if (snap) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, 1 - Math.exp(-8 * dt));
    this.camera.lookAt(target.x, target.y - 1, target.z);
    // Drift the marine snow with the player so it always surrounds them.
    this.snow.position.set(target.x, target.y, target.z);
  }

  private applyLevel(index: number): void {
    const lvl = this.ladder[Math.max(0, Math.min(this.ladder.length - 1, index))];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, lvl.pixelRatio));
    this.renderer.shadowMap.enabled = lvl.shadows;
    this.renderer.shadowMap.needsUpdate = true;
    this.spotLight.castShadow = lvl.shadows;
  }

  get qualityInfo(): { level: number; targetFps: number; avg: number; ceiling: number } {
    return { level: this.levelIndex, targetFps: this.targetFps, avg: this.perfAvg, ceiling: this.ceiling };
  }

  /** Called once per rendered frame to drive the auto-tuner. */
  private tune(now: number): void {
    if (this.warmup > 0) {
      this.warmup -= 1 / 60;
      return;
    }
    if (!this.sampled) {
      const sample = now - (this.lastRenderMs || now);
      if (sample >= 3 && sample <= 500) {
        this.refreshSamples.push(sample);
        if (this.refreshSamples.length > 40) {
          const min = Math.min(...this.refreshSamples);
          this.targetFps = Math.max(30, Math.min(60, Math.round(1000 / min)));
          this.sampled = true;
        }
      }
    }
    const rdt = now - this.lastRenderMs;
    if (rdt < 500) {
      this.perfAvg = this.perfAvg * 0.85 + rdt * 0.15;
      const budget = 1000 / this.targetFps;
      this.cooldown -= rdt / 1000;
      if (this.perfAvg > budget * 1.25) {
        this.perfGood = 0;
        this.perfBad += rdt / 1000;
        if (this.perfBad >= 0.4 && this.levelIndex > 0) {
          this.perfBad = 0;
          this.ceiling = Math.min(this.ceiling, this.levelIndex - 1);
          this.levelIndex--;
          this.cooldown = 6;
          this.applyLevel(this.levelIndex);
        }
      } else if (this.perfAvg <= budget * 1.1) {
        this.perfBad = 0;
        this.perfGood += rdt / 1000;
        if (this.perfGood >= 3 && this.cooldown <= 0 && this.levelIndex < this.ceiling) {
          this.perfGood = 0;
          this.levelIndex++;
          this.applyLevel(this.levelIndex);
        }
      } else {
        this.perfBad = 0;
        this.perfGood = 0;
      }
    }
  }

  render(): void {
    const now = performance.now();
    if (this.lastRenderMs !== 0) this.tune(now);
    this.lastRenderMs = now;
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.applyLevel(this.levelIndex);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
