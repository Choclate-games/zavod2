import * as THREE from 'three';

export interface QualityLevel {
  pixelRatio: number;
  shadowMapSize: number;
  shadowsEnabled: boolean;
}

export const QUALITY_LADDER: QualityLevel[] = [
  { pixelRatio: 0.85, shadowMapSize: 256, shadowsEnabled: false },
  { pixelRatio: 1.0, shadowMapSize: 512, shadowsEnabled: true },
  { pixelRatio: 1.25, shadowMapSize: 1024, shadowsEnabled: true },
  { pixelRatio: Math.min(window.devicePixelRatio || 1.5, 1.5), shadowMapSize: 1024, shadowsEnabled: true },
];

export class AdaptiveQuality {
  private renderer: THREE.WebGLRenderer;
  private dirLight: THREE.DirectionalLight | null = null;

  public currentLevelIndex: number = QUALITY_LADDER.length - 1;
  private ceiling: number = QUALITY_LADDER.length - 1;
  private strikes: number[] = [0, 0, 0, 0];

  private targetFps: number = 60;
  private avgFrameCadence: number = 16.6;
  private lastRenderMs: number = 0;
  private goodDuration: number = 0;
  private badDuration: number = 0;
  private cooldownTimer: number = 0;
  private warmupTimer: number = 1.5; // seconds before tuning starts

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.applyLevel(this.currentLevelIndex);
  }

  public setSunLight(light: THREE.DirectionalLight): void {
    this.dirLight = light;
    this.applyLevel(this.currentLevelIndex);
  }

  public onRenderFrame(now: number): void {
    if (this.lastRenderMs === 0) {
      this.lastRenderMs = now;
      return;
    }

    const rdt = now - this.lastRenderMs;
    this.lastRenderMs = now;

    if (rdt > 500) return; // ignore tab switch spikes

    if (this.warmupTimer > 0) {
      this.warmupTimer -= rdt / 1000;
      return;
    }

    this.tune(rdt);
  }

  private tune(rdt: number): void {
    const budget = 1000 / this.targetFps;
    this.avgFrameCadence = this.avgFrameCadence * 0.85 + rdt * 0.15;
    const dt = rdt / 1000;

    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
    }

    // Over budget -> step down
    if (this.avgFrameCadence > budget * 1.25) {
      this.goodDuration = 0;
      this.badDuration += dt;
      if (this.badDuration >= 0.4 && this.currentLevelIndex > 0) {
        this.badDuration = 0;
        this.strikes[this.currentLevelIndex] = (this.strikes[this.currentLevelIndex] || 0) + 1;
        if (this.strikes[this.currentLevelIndex] >= 2) {
          this.ceiling = Math.min(this.ceiling, this.currentLevelIndex - 1);
        }
        this.currentLevelIndex--;
        this.cooldownTimer = 6.0;
        this.applyLevel(this.currentLevelIndex);
      }
    } else if (this.avgFrameCadence <= budget * 1.1) {
      // Under budget -> probe one level up
      this.badDuration = 0;
      this.goodDuration += dt;
      if (this.goodDuration >= 3.5 && this.cooldownTimer <= 0 && this.currentLevelIndex < this.ceiling) {
        this.goodDuration = 0;
        this.currentLevelIndex++;
        this.applyLevel(this.currentLevelIndex);
      }
    } else {
      this.badDuration = 0;
      this.goodDuration = 0;
    }
  }

  public applyLevel(levelIdx: number): void {
    this.currentLevelIndex = Math.max(0, Math.min(QUALITY_LADDER.length - 1, levelIdx));
    const lvl = QUALITY_LADDER[this.currentLevelIndex];

    this.renderer.setPixelRatio(lvl.pixelRatio);

    if (this.renderer.shadowMap) {
      this.renderer.shadowMap.enabled = lvl.shadowsEnabled;
      if (this.dirLight && this.dirLight.shadow) {
        this.dirLight.castShadow = lvl.shadowsEnabled;
        this.dirLight.shadow.mapSize.set(lvl.shadowMapSize, lvl.shadowMapSize);
        if (this.dirLight.shadow.map) {
          this.dirLight.shadow.map.dispose();
          this.dirLight.shadow.map = null;
        }
      }
    }
  }
}
