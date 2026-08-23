import * as THREE from 'three';
import { BALANCE } from '../core/Constants';

export interface BallisticsResult {
  hitPoint: THREE.Vector3;
  bulletDropMeters: number;
  windDriftMeters: number;
  flightTimeSeconds: number;
  milElevation: number;
  milWindage: number;
}

export class BallisticsSystem {
  public windSpeed = 6.5; // m/s
  public windAngle = Math.PI / 2; // Radian angle (90 deg = pure crosswind)
  public thunderTimer = 0.0;
  public dieselTimer = 0.0;
  public isMasked = false;

  public update(dt: number): void {
    // Acoustic masking cycles
    this.thunderTimer += dt;
    if (this.thunderTimer >= BALANCE.natural_thunder_interval) {
      this.thunderTimer = 0.0;
    }

    this.dieselTimer += dt;
    if (this.dieselTimer >= BALANCE.diesel_generator_interval) {
      this.dieselTimer = 0.0;
    }

    const isThunderActive = this.thunderTimer < BALANCE.thunder_masking_window;
    const isDieselActive = this.dieselTimer < 0.8;
    this.isMasked = isThunderActive || isDieselActive;

    // Small wind fluctuations (0.0 to 14.0 m/s range)
    this.windSpeed = Math.max(
      BALANCE.polar_wind_min,
      Math.min(BALANCE.polar_wind_max, this.windSpeed + (Math.random() - 0.5) * dt * 0.5)
    );
  }

  public calculateTrajectory(
    origin: THREE.Vector3,
    aimDirection: THREE.Vector3,
    distanceMeters: number
  ): BallisticsResult {
    const vMuzzle = BALANCE.bullet_muzzle_velocity; // 850.0 m/s
    const g = 9.81;

    const flightTime = distanceMeters / vMuzzle;
    // y_drop = 0.5 * g * (distance / v_muzzle)^2
    const bulletDrop = 0.5 * g * Math.pow(flightTime, 2);

    // x_drift = 0.5 * a_wind * (distance / v_muzzle)^1.45
    const aWind = this.windSpeed * Math.sin(this.windAngle);
    const windDrift = 0.5 * aWind * Math.pow(flightTime, 1.45);

    // Mil-Dot offsets (1 mil = 1 / 1000 distance)
    const milElevation = (bulletDrop / distanceMeters) * 1000;
    const milWindage = (windDrift / distanceMeters) * 1000;

    const hitPoint = origin.clone().add(aimDirection.clone().multiplyScalar(distanceMeters));
    hitPoint.y -= bulletDrop;
    hitPoint.x += windDrift;

    return {
      hitPoint,
      bulletDropMeters: bulletDrop,
      windDriftMeters: windDrift,
      flightTimeSeconds: flightTime,
      milElevation,
      milWindage
    };
  }

  public getMaskingRatio(): number {
    if (this.thunderTimer < BALANCE.thunder_masking_window) {
      return 1.0 - this.thunderTimer / BALANCE.thunder_masking_window;
    }
    if (this.dieselTimer < 0.8) {
      return 1.0 - this.dieselTimer / 0.8;
    }
    return 0.0;
  }
}
