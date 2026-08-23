/**
 * MetroKinematics: 4-phase subway run simulation.
 * Calculates train speed, acceleration vectors, and centrifugal lateral forces.
 */

import { BALANCE } from '../config/BalanceConfig';

export interface MetroKinematicsState {
  timeSec: number;
  totalDurationSec: number;
  phaseIndex: number; // 0: Start, 1: Curves, 2: Braking, 3: Arrival
  phaseName: string;
  speedKmH: number;
  speedMps: number;
  accelForwardMps2: number;
  accelLateralMps2: number; // Centrifugal force
  railVibrationY: number;
  isCurving: boolean;
  curveDirection: number; // -1: Left, +1: Right, 0: Straight
  stationDistanceMeters: number;
  progress01: number;
}

export class MetroKinematics {
  private runDurationSec: number = BALANCE.session.targetRunSec;
  private elapsedSec: number = 0;
  private currentSpeedMps: number = 0;
  private targetSpeedMps: number = 20.83; // 75 km/h
  private isFinished: boolean = false;

  public reset(durationSec: number = BALANCE.session.targetRunSec): void {
    this.runDurationSec = durationSec;
    this.elapsedSec = 0;
    this.currentSpeedMps = 0;
    this.isFinished = false;
  }

  public update(dt: number): MetroKinematicsState {
    this.elapsedSec = Math.min(this.runDurationSec, this.elapsedSec + dt);
    const t = this.elapsedSec;
    const progress = t / this.runDurationSec;

    let phaseIndex = 0;
    let phaseName = 'Разгон';
    let accelForward = 0;
    let accelLateral = 0;
    let curveDir = 0;
    let isCurving = false;

    // Phase 1: 0 - 10s: Start & Acceleration
    if (t <= 10) {
      phaseIndex = 0;
      phaseName = 'Старт и разгон';
      const normT = t / 10;
      this.currentSpeedMps = Math.min(this.targetSpeedMps, normT * this.targetSpeedMps);
      accelForward = 2.08; // Longitudinal acceleration push backwards on cargo
    }
    // Phase 2: 10 - 38s: High-speed tunnel & Curves
    else if (t <= 38) {
      phaseIndex = 1;
      phaseName = 'Виражи туннеля';
      this.currentSpeedMps = this.targetSpeedMps;
      accelForward = (Math.sin(t * 1.5) * 0.3); // Slight speed fluctuations

      // Curve 1: 14s - 20s (Left curve)
      if (t >= 14 && t <= 20) {
        isCurving = true;
        curveDir = -1;
        const curveFactor = Math.sin(((t - 14) / 6) * Math.PI);
        accelLateral = -curveFactor * 3.8; // Centrifugal push to the right
      }
      // Curve 2: 24s - 31s (S-curve Right then Left)
      else if (t >= 24 && t <= 31) {
        isCurving = true;
        const curveFactor = Math.sin(((t - 24) / 7) * Math.PI * 2);
        curveDir = curveFactor >= 0 ? 1 : -1;
        accelLateral = curveFactor * 4.2;
      }
      // Curve 3: 33s - 37s (Right switch)
      else if (t >= 33 && t <= 37) {
        isCurving = true;
        curveDir = 1;
        const curveFactor = Math.sin(((t - 33) / 4) * Math.PI);
        accelLateral = curveFactor * 4.8;
      }
    }
    // Phase 3: 38 - 52s: Emergency braking before station
    else if (t <= 52) {
      phaseIndex = 2;
      phaseName = 'Торможение перед платформой';
      const brakeT = (t - 38) / 14;
      accelForward = BALANCE.pitchCounterLean.trainBrakingDeceleration; // -3.6 m/s²
      this.currentSpeedMps = Math.max(0, this.targetSpeedMps * (1 - brakeT));
      accelLateral = Math.sin(t * 2) * 0.4;
    }
    // Phase 4: 52 - 60s: Station arrival & Stop
    else {
      phaseIndex = 3;
      phaseName = 'Прибытие на станцию';
      this.currentSpeedMps = 0;
      accelForward = 0;
      accelLateral = 0;
      this.isFinished = true;
    }

    // Rail joint vibration at ~1.34 Hz
    const railVib = (this.currentSpeedMps > 2) ? Math.sin(t * BALANCE.sloshingCargo.waterEigenfrequencyRadPerSec) * 0.015 : 0;
    const distanceMeters = Math.max(0, Math.round((1 - progress) * 850));

    return {
      timeSec: t,
      totalDurationSec: this.runDurationSec,
      phaseIndex,
      phaseName,
      speedKmH: Math.round(this.currentSpeedMps * 3.6),
      speedMps: this.currentSpeedMps,
      accelForwardMps2: accelForward,
      accelLateralMps2: accelLateral,
      railVibrationY: railVib,
      isCurving,
      curveDirection: curveDir,
      stationDistanceMeters: distanceMeters,
      progress01: Math.min(1, progress)
    };
  }

  public isRunComplete(): boolean {
    return this.elapsedSec >= this.runDurationSec;
  }
}
