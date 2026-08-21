import * as THREE from 'three';
import { CONFIG } from '../core/Config';
import { eventBus } from '../core/EventBus';

export class AdrenalineSystem {
  comboMultiplier = 1.0;
  comboStreak = 0;
  comboTimerSec = 0;
  comboWindowSec = 2.8;

  totalScore = 0;
  nearMissCount = 0;
  driftPoints = 0;

  private draftChargeTime = 0;
  private slingshotReady = false;

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    eventBus.on('near_miss:trigger', (data) => {
      this.handleNearMiss(data);
    });

    eventBus.on('drift:ended', (data) => {
      this.driftPoints += data.points;
      this.totalScore += Math.floor(data.points * this.comboMultiplier);
    });
  }

  private handleNearMiss(data: {
    distance: number;
    isOpposing: boolean;
    speedKmh: number;
    position: { x: number; y: number; z: number };
  }): void {
    this.nearMissCount++;
    this.comboStreak++;

    this.comboMultiplier = Math.min(
      CONFIG.combo.maxComboMultiplier,
      1.0 + this.comboStreak * 0.5
    );

    this.comboWindowSec = Math.max(
      1.2,
      2.8 - (this.comboMultiplier - 1.0) * 0.35
    );
    this.comboTimerSec = this.comboWindowSec;

    const opposingMult = data.isOpposing ? CONFIG.combo.opposingMultiplier : 1.0;
    const proximityFactor = THREE.MathUtils.clamp((1.2 - data.distance) / 0.8, 0.5, 1.5);
    const speedFactor = 1.0 + Math.max(0, data.speedKmh - 120) / 100;

    const n2oGain = CONFIG.combo.baseNitroGain * speedFactor * opposingMult * proximityFactor;

    const basePoints = data.isOpposing ? 500 : 250;
    const points = Math.floor(basePoints * proximityFactor);
    this.totalScore += Math.floor(points * this.comboMultiplier);

    eventBus.emit('score:stunt', {
      type: data.isOpposing ? 'ONCOMING_MISS' : 'NEAR_MISS',
      points,
      multiplier: this.comboMultiplier,
      message: data.isOpposing ? 'ONCOMING NEAR MISS!' : 'RAZOR NEAR MISS!',
      posWorld: data.position,
    });

    eventBus.emit('nitro:updated', { current: n2oGain, max: 100 });
  }

  update(dt: number, speedKmh: number, isDrifting: boolean, isDrafting: boolean): void {
    // Combo timer decay
    if (this.comboTimerSec > 0) {
      this.comboTimerSec -= dt;
      if (this.comboTimerSec <= 0) {
        this.comboStreak = 0;
        this.comboMultiplier = 1.0;
      }
    }

    if (speedKmh > 100) {
      const speedPoints = (speedKmh / 100) ** 2 * 5 * dt;
      this.totalScore += Math.floor(speedPoints * this.comboMultiplier);
    }

    if (isDrifting && speedKmh > 60) {
      const driftScoreTick = 250 * dt;
      this.driftPoints += Math.floor(driftScoreTick);
      this.totalScore += Math.floor(driftScoreTick * this.comboMultiplier);
    }

    if (isDrafting) {
      this.draftChargeTime += dt;
      if (this.draftChargeTime >= CONFIG.combo.slingshotChargeTime && !this.slingshotReady) {
        this.slingshotReady = true;
        eventBus.emit('slingshot:ready', undefined);
      }
    } else {
      if (this.slingshotReady) {
        // Released out of draft pocket!
        eventBus.emit('slingshot:released', { boostKmh: CONFIG.combo.slingshotBoostKmh });
        eventBus.emit('score:stunt', {
          type: 'SLIPSTREAM_SLINGSHOT',
          points: 750,
          multiplier: this.comboMultiplier,
          message: 'SLIPSTREAM SLINGSHOT! +35 KM/H',
        });
      }
      this.draftChargeTime = 0;
      this.slingshotReady = false;
    }
  }

  reset(): void {
    this.comboMultiplier = 1.0;
    this.comboStreak = 0;
    this.comboTimerSec = 0;
    this.totalScore = 0;
    this.nearMissCount = 0;
    this.driftPoints = 0;
    this.draftChargeTime = 0;
    this.slingshotReady = false;
  }
}

export const adrenalineSystem = new AdrenalineSystem();
