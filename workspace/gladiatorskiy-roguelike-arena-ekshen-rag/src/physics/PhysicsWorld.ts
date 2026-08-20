import * as THREE from 'three';

export interface ArenaObstacle {
  x: number;
  z: number;
  radius: number;
  type: 'pillar' | 'spike_trap' | 'brazier';
}

export class PhysicsWorld {
  public static readonly ARENA_RADIUS = 18.0;
  public static readonly WALL_BOUNCE_FACTOR = 0.62;
  public static readonly GRAVITY = -9.81;

  public obstacles: ArenaObstacle[] = [];

  constructor() {
    this.initObstacles();
  }

  private initObstacles(): void {
    // 4 Roman marble pillars
    const pillarDist = 8.5;
    this.obstacles.push(
      { x: pillarDist, z: pillarDist, radius: 1.4, type: 'pillar' },
      { x: -pillarDist, z: pillarDist, radius: 1.4, type: 'pillar' },
      { x: pillarDist, z: -pillarDist, radius: 1.4, type: 'pillar' },
      { x: -pillarDist, z: -pillarDist, radius: 1.4, type: 'pillar' },
    );

    // 4 Spiked perimeter trap zones near the walls
    const trapDist = 14.5;
    this.obstacles.push(
      { x: trapDist, z: 0, radius: 1.6, type: 'spike_trap' },
      { x: -trapDist, z: 0, radius: 1.6, type: 'spike_trap' },
      { x: 0, z: trapDist, radius: 1.6, type: 'spike_trap' },
      { x: 0, z: -trapDist, radius: 1.6, type: 'spike_trap' },
    );
  }

  /**
   * Constrains an entity to the circular Colosseum arena and handles wall bounce.
   * Returns true if a hard wall impact occurred.
   */
  public constrainToArena(
    pos: THREE.Vector3,
    velocity: THREE.Vector3,
    entityRadius: number,
    isRagdoll: boolean = false
  ): { hitWall: boolean; impactSpeed: number; hitTrap: boolean } {
    let hitWall = false;
    let impactSpeed = 0;
    let hitTrap = false;

    const distFromCenter = Math.hypot(pos.x, pos.z);
    const maxRadius = PhysicsWorld.ARENA_RADIUS - entityRadius;

    if (distFromCenter > maxRadius) {
      hitWall = true;
      const normalX = pos.x / distFromCenter;
      const normalZ = pos.z / distFromCenter;

      // Project back inside bounds
      pos.x = normalX * maxRadius;
      pos.z = normalZ * maxRadius;

      // Calculate radial inward impact velocity
      const radialVel = velocity.x * normalX + velocity.z * normalZ;
      if (radialVel > 0) {
        impactSpeed = radialVel;
        // Elastic bounce with friction
        velocity.x -= (1 + PhysicsWorld.WALL_BOUNCE_FACTOR) * radialVel * normalX;
        velocity.z -= (1 + PhysicsWorld.WALL_BOUNCE_FACTOR) * radialVel * normalZ;

        if (isRagdoll) {
          velocity.y += Math.abs(radialVel) * 0.35; // Kick upward slightly on hard wall smash
        }
      }
    }

    // Check obstacle collisions (pillars & traps)
    for (const obs of this.obstacles) {
      const dx = pos.x - obs.x;
      const dz = pos.z - obs.z;
      const dist = Math.hypot(dx, dz);
      const minDist = entityRadius + obs.radius;

      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const nz = dz / dist;
        pos.x = obs.x + nx * minDist;
        pos.z = obs.z + nz * minDist;

        const normalSpeed = velocity.x * nx + velocity.z * nz;
        if (normalSpeed < 0) {
          velocity.x -= (1 + PhysicsWorld.WALL_BOUNCE_FACTOR) * normalSpeed * nx;
          velocity.z -= (1 + PhysicsWorld.WALL_BOUNCE_FACTOR) * normalSpeed * nz;
          impactSpeed = Math.max(impactSpeed, Math.abs(normalSpeed));
          hitWall = true;
        }

        if (obs.type === 'spike_trap') {
          hitTrap = true;
        }
      }
    }

    return { hitWall, impactSpeed, hitTrap };
  }
}

export const physicsWorld = new PhysicsWorld();
