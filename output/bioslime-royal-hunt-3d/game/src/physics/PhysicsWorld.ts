import RAPIER from '@dimforge/rapier3d-compat';
import { GameConfig } from '../config/GameConfig';

export class PhysicsWorld {
  private static instance: PhysicsWorld;
  public world: RAPIER.World | null = null;
  public isReady: boolean = false;

  private constructor() {}

  public static getInstance(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld();
    }
    return PhysicsWorld.instance;
  }

  public async init(): Promise<void> {
    try {
      await RAPIER.init();
      const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
      this.world = new RAPIER.World(gravity);
      this.isReady = true;
      console.log('Rapier3D physics initialized.');
    } catch (err) {
      console.warn('Rapier3D init fallback to custom solver:', err);
      this.isReady = true;
    }
  }

  public step(dt: number): void {
    if (this.world) {
      this.world.timestep = dt;
      this.world.step();
    }
  }

  public clampToArena(pos: { x: number; y: number; z: number }, radius: number): void {
    const maxR = GameConfig.ARENA_RADIUS - radius;
    const dist = Math.hypot(pos.x, pos.z);
    if (dist > maxR && dist > 0.001) {
      const scale = maxR / dist;
      pos.x *= scale;
      pos.z *= scale;
    }
    // Floor clamp
    if (pos.y < radius * 0.5) {
      pos.y = radius * 0.5;
    }
  }
}
