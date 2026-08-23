import * as THREE from 'three';
import { GAME_BALANCE } from '../config/balance';
import { Player } from '../entities/Player';

export class SlideFpsMovementPhysicsSystem {
  public static calculateSlideVelocity(
    direction: THREE.Vector3,
    remainingTime: number,
    baseSpeed: number = GAME_BALANCE.base_speed
  ): THREE.Vector3 {
    const progress = Math.max(0, remainingTime / GAME_BALANCE.slide_duration);
    // Exponential ease-out decay from 10.8 m/s (1.35x of 8.0 m/s) down to base speed
    const currentSpeed = (baseSpeed * GAME_BALANCE.slide_velocity_multiplier) * (0.35 + 0.65 * progress);
    return direction.clone().multiplyScalar(currentSpeed);
  }

  public static getHitboxHeight(isSliding: boolean): number {
    return isSliding ? GAME_BALANCE.hitbox_height_slide : GAME_BALANCE.hitbox_height_stand;
  }

  public static getCameraHeight(isSliding: boolean): number {
    return isSliding ? GAME_BALANCE.camera_height_slide : GAME_BALANCE.camera_height_stand;
  }
}