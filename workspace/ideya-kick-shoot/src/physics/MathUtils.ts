import { Vector3D } from '../core/Types';

export class MathUtils {
  public static distance2D(x1: number, z1: number, x2: number, z2: number): number {
    const dx = x2 - x1;
    const dz = z2 - z1;
    return Math.hypot(dx, dz);
  }

  public static distance3D(a: Vector3D, b: Vector3D): number {
    return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }

  public static clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(val, max));
  }

  public static lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  public static isInsideCone(
    sourceX: number,
    sourceZ: number,
    forwardX: number,
    forwardZ: number,
    targetX: number,
    targetZ: number,
    maxDistance: number,
    coneAngleDegrees: number
  ): boolean {
    const dx = targetX - sourceX;
    const dz = targetZ - sourceZ;
    const dist = Math.hypot(dx, dz);

    if (dist > maxDistance || dist < 0.01) {
      return false;
    }

    const normTargetX = dx / dist;
    const normTargetZ = dz / dist;

    const fDist = Math.hypot(forwardX, forwardZ);
    const normForwardX = fDist > 0.001 ? forwardX / fDist : 0;
    const normForwardZ = fDist > 0.001 ? forwardZ / fDist : 1;

    // Dot product = cos(angle)
    const dot = normTargetX * normForwardX + normTargetZ * normForwardZ;
    const minDot = Math.cos((coneAngleDegrees * Math.PI) / 360); // Half angle

    return dot >= minDot;
  }
}
