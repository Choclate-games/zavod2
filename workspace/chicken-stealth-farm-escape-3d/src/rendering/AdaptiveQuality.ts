// src/rendering/AdaptiveQuality.ts
import * as THREE from 'three';

export interface QualityRung {
  dpr: number;
  shadowMapSize: number;
  shadowsEnabled: boolean;
  raycastSegments: number;
}

export const QUALITY_LADDER: QualityRung[] = [
  // 0: Low (budget phones)
  { dpr: 1.0, shadowMapSize: 512, shadowsEnabled: false, raycastSegments: 12 },
  // 1: Medium (standard mobile)
  { dpr: 1.25, shadowMapSize: 1024, shadowsEnabled: true, raycastSegments: 16 },
  // 2: High (desktop / fast phone)
  { dpr: 1.5, shadowMapSize: 2048, shadowsEnabled: true, raycastSegments: 24 }
];

export class AdaptiveQualityGovernor {
  private renderer: THREE.WebGLRenderer;
  private dirLight: THREE.DirectionalLight | null = null;
  private currentRungIndex: number = 2; // Start optimistic at high
  private ceilingRungIndex: number = 2;
  private strikes: number[] = [0, 0, 0];

  private targetFps: number = 60;
  private lastRenderMs: number = 0;
  private avgCadence: number = 16.67;
  private goodCadenceDuration: number = 0;
  private badCadenceDuration: number = 0;
  private cooldownTimer: number = 3.0; // 3 seconds warm-up guard

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.applyCurrentRung();
  }

  public setDirectionalLight(light: THREE.DirectionalLight): void {
    this.dirLight = light;
    this.applyCurrentRung();
  }

  public getCurrentRung(): QualityRung {
    return QUALITY_LADDER[this.currentRungIndex];
  }

  public getRaycastSegments(): number {
    return QUALITY_LADDER[this.currentRungIndex].raycastSegments;
  }

  public beforeRender(): void {
    const now = performance.now();
    if (this.lastRenderMs > 0) {
      const rdt = now - this.lastRenderMs;
      if (rdt < 500) {
        this.tune(rdt);
      }
    }
    this.lastRenderMs = now;
  }

  private tune(rdt: number): void {
    const budget = 1000 / this.targetFps;
    this.avgCadence = this.avgCadence * 0.85 + rdt * 0.15;
    const dt = rdt / 1000;

    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
      return;
    }

    if (this.avgCadence > budget * 1.25) {
      // Struggling to hold 60fps
      this.goodCadenceDuration = 0;
      this.badCadenceDuration += dt;

      if (this.badCadenceDuration >= 0.4 && this.currentRungIndex > 0) {
        this.badCadenceDuration = 0;
        this.strikes[this.currentRungIndex] = (this.strikes[this.currentRungIndex] || 0) + 1;

        if (this.strikes[this.currentRungIndex] >= 2) {
          this.ceilingRungIndex = Math.min(this.ceilingRungIndex, this.currentRungIndex - 1);
        }

        this.currentRungIndex--;
        this.cooldownTimer = 5.0; // Wait before further tuning
        this.applyCurrentRung();
      }
    } else if (this.avgCadence <= budget * 1.08) {
      // Smoothly holding budget -> probe one rung up if below ceiling
      this.badCadenceDuration = 0;
      this.goodCadenceDuration += dt;

      if (this.goodCadenceDuration >= 3.5 && this.currentRungIndex < this.ceilingRungIndex) {
        this.goodCadenceDuration = 0;
        this.currentRungIndex++;
        this.applyCurrentRung();
      }
    } else {
      this.badCadenceDuration = 0;
      this.goodCadenceDuration = 0;
    }
  }

  private applyCurrentRung(): void {
    const rung = QUALITY_LADDER[this.currentRungIndex];
    const dpr = Math.min(window.devicePixelRatio || 1, rung.dpr);
    this.renderer.setPixelRatio(dpr);

    if (this.dirLight) {
      this.renderer.shadowMap.enabled = rung.shadowsEnabled;
      if (rung.shadowsEnabled) {
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.set(rung.shadowMapSize, rung.shadowMapSize);
        if (this.dirLight.shadow.map) {
          this.dirLight.shadow.map.dispose();
          this.dirLight.shadow.map = null;
        }
        this.renderer.shadowMap.needsUpdate = true;
      } else {
        this.dirLight.castShadow = false;
      }
    }
  }
}
