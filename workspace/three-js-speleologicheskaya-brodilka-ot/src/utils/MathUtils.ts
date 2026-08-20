import * as THREE from "three";

export class MathUtils {
  public static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  public static lerp(start: number, end: number, t: number): number {
    return start + (end - start) * MathUtils.clamp(t, 0, 1);
  }

  public static damp(current: number, target: number, lambda: number, dt: number): number {
    return MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
  }

  public static distance2D(x1: number, z1: number, x2: number, z2: number): number {
    const dx = x2 - x1;
    const dz = z2 - z1;
    return Math.sqrt(dx * dx + dz * dz);
  }

  public static distance3D(v1: THREE.Vector3, v2: THREE.Vector3): number {
    return v1.distanceTo(v2);
  }

  public static randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  public static randomChoice<T>(items: T[]): T {
    const idx = Math.floor(Math.random() * items.length);
    return items[idx];
  }

  public static shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
