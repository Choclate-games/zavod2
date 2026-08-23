import { GAME_BALANCE } from '../core/Constants';
import { audio } from '../audio/AudioManager';

export interface DriftState {
  isDrifting: boolean;
  driftAngleDeg: number;
  slipRatio: number;
  driftScoreTotal: number;
  currentComboScore: number;
  comboMultiplier: number;
  isNearMiss: boolean;
  tireTemperatureC: number;
  nitroRatio: number; // 0.0 to 3.0 (up to 3 bottles)
  isNitroBoosting: boolean;
}

export class DriftAndNitroSystem {
  private scoreTotal = 0;
  private currentCombo = 0;
  private comboMultiplier = 1.0;
  private comboStreak = 0;
  private comboTimer = 0;
  private riskMultiplier = 1.0;
  private nearMissTimer = 0;

  private nitroCharge = 1.0; // Starts with 1 full bottle (1.0 / 3.0)
  private isBoosting = false;
  private boostTimer = 0;

  private tireTemperature = 80.0; // Starts in optimal range (70-105°C)

  update(
    dt: number,
    speedKmh: number,
    slipAngleRad: number,
    slipRatio: number,
    distanceToObstacleM: number,
    wantsNitro: boolean
  ): DriftState {
    const angleDeg = (slipAngleRad * 180) / Math.PI;
    const isDrifting = speedKmh >= GAME_BALANCE.drift.minDriftEntrySpeedKmh && slipRatio > 0.28 && angleDeg > 12.0;

    // 1. Razor Edge Proximity Risk Multiplier
    const thresh = GAME_BALANCE.risk.proximityThresholdM; // 1.20 m
    const crit = GAME_BALANCE.risk.criticalMaxDistanceM;   // 0.35 m
    let isNearMiss = false;

    if (distanceToObstacleM <= thresh && speedKmh > 50) {
      isNearMiss = true;
      this.nearMissTimer = 0.5;
      const t = Math.max(0, Math.min(1, (thresh - distanceToObstacleM) / (thresh - crit)));
      this.riskMultiplier = Math.min(GAME_BALANCE.risk.maxComboMultiplier, 1.0 + t * 3.0);
    } else {
      if (this.nearMissTimer > 0) {
        this.nearMissTimer -= dt;
        isNearMiss = true;
      } else {
        this.riskMultiplier = Math.max(1.0, this.riskMultiplier - dt * 1.5);
      }
    }

    // 2. Tire Temperature Dynamics
    if (isDrifting) {
      this.tireTemperature = Math.min(
        GAME_BALANCE.tires.criticalBoilingTempC,
        this.tireTemperature + GAME_BALANCE.tires.driftHeatingRateCPerSec * dt
      );
    } else {
      const coolingRate = GAME_BALANCE.tires.airflowCoolingRateCPerSec * (speedKmh / 150);
      this.tireTemperature = Math.max(
        65.0,
        this.tireTemperature - coolingRate * dt
      );
    }

    // 3. Drift Scoring & Combo
    if (isDrifting && angleDeg < 75.0) {
      this.comboTimer = GAME_BALANCE.drift.comboHoldWindowSec;
      const tick = (speedKmh * 0.50) * Math.sin(slipAngleRad) * this.riskMultiplier * dt * (this.comboStreak + 1);
      this.currentCombo += tick * 10;
      this.comboMultiplier = Math.min(4.0, 1.0 + Math.floor(this.currentCombo / 500) * 0.5);

      // Nitro Charging: dNitro/dt = 0.25 * (angle / 45) * (speed / 200) * risk
      const chargeRate = 0.25 * (angleDeg / GAME_BALANCE.drift.optimalDriftAngleDeg) * Math.min(1.2, speedKmh / 200) * this.riskMultiplier;
      this.nitroCharge = Math.min(GAME_BALANCE.nitro.maxBottles, this.nitroCharge + chargeRate * dt);
    } else {
      if (this.currentCombo > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          // Bank combo
          this.scoreTotal += this.currentCombo * this.comboMultiplier;
          this.currentCombo = 0;
          this.comboMultiplier = 1.0;
          this.comboStreak = 0;
          audio.playChime();
        }
      }
    }

    // 4. Nitro Boost Logic
    if (wantsNitro && this.nitroCharge >= 0.1 && !this.isBoosting) {
      this.isBoosting = true;
      this.boostTimer = GAME_BALANCE.nitro.boostDurationPerBottleSec;
    }

    if (this.isBoosting) {
      const burnRate = 1.0 / GAME_BALANCE.nitro.boostDurationPerBottleSec;
      this.nitroCharge = Math.max(0, this.nitroCharge - burnRate * dt);
      this.boostTimer -= dt;
      if (this.boostTimer <= 0 || this.nitroCharge <= 0) {
        this.isBoosting = false;
      }
    }

    return {
      isDrifting,
      driftAngleDeg: angleDeg,
      slipRatio,
      driftScoreTotal: Math.floor(this.scoreTotal),
      currentComboScore: Math.floor(this.currentCombo),
      comboMultiplier: this.comboMultiplier,
      isNearMiss,
      tireTemperatureC: this.tireTemperature,
      nitroRatio: this.nitroCharge,
      isNitroBoosting: this.isBoosting,
    };
  }

  onCollisionImpact(impactG: number): void {
    if (impactG >= GAME_BALANCE.risk.collisionPenaltyThresholdG) {
      // Crash cancels unbanked combo
      this.currentCombo = 0;
      this.comboMultiplier = 1.0;
      this.comboStreak = 0;
      this.isBoosting = false;
    }
  }

  reset(): void {
    this.scoreTotal = 0;
    this.currentCombo = 0;
    this.comboMultiplier = 1.0;
    this.comboStreak = 0;
    this.nitroCharge = 1.0;
    this.isBoosting = false;
    this.tireTemperature = 80.0;
  }
}
