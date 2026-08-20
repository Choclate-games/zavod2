import * as THREE from "three";
import { CollisionBody, BoxCollider } from "./CollisionBody";
import { GAME_CONSTANTS } from "../utils/Constants";

export interface RaycastHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  body?: CollisionBody;
  materialType?: "granite" | "crystal" | "chasm" | "station" | "enemy";
}

export class PhysicsWorld {
  private bodies: CollisionBody[] = [];
  private staticObstacles: THREE.Box3[] = [];
  private chasmPits: THREE.Box3[] = [];
  private gravity: number = GAME_CONSTANTS.GRAVITY;

  // Reusable vectors to prevent GC allocations in 60Hz loop
  private tempVec1: THREE.Vector3 = new THREE.Vector3();
  private tempVec2: THREE.Vector3 = new THREE.Vector3();
  private tempBox: THREE.Box3 = new THREE.Box3();

  constructor() {}

  public addBody(body: CollisionBody): void {
    if (!this.bodies.includes(body)) {
      this.bodies.push(body);
    }
  }

  public removeBody(body: CollisionBody): void {
    const idx = this.bodies.indexOf(body);
    if (idx !== -1) {
      this.bodies.splice(idx, 1);
    }
  }

  public addStaticObstacle(min: THREE.Vector3, max: THREE.Vector3): void {
    this.staticObstacles.push(new THREE.Box3(min.clone(), max.clone()));
  }

  public addChasmPit(min: THREE.Vector3, max: THREE.Vector3): void {
    this.chasmPits.push(new THREE.Box3(min.clone(), max.clone()));
  }

  public clear(): void {
    this.bodies = [];
    this.staticObstacles = [];
    this.chasmPits = [];
  }

  public step(dt: number): void {
    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      if (!body.enabled || body.isStatic) continue;

      // Apply gravity if not grounded
      if (!body.isGrounded) {
        body.velocity.y += this.gravity * dt;
      }

      // Horizontal displacement
      const moveX = body.velocity.x * dt;
      const moveZ = body.velocity.z * dt;
      const moveY = body.velocity.y * dt;

      // Resolve Horizontal Collisions
      this.resolveHorizontalMovement(body, moveX, moveZ);

      // Resolve Vertical Collisions
      this.resolveVerticalMovement(body, moveY);

      // Apply air / ground friction damping
      const damping = body.isGrounded ? 0.85 : 0.98;
      body.velocity.x *= damping;
      body.velocity.z *= damping;

      if (Math.abs(body.velocity.x) < 0.01) body.velocity.x = 0;
      if (Math.abs(body.velocity.z) < 0.01) body.velocity.z = 0;
    }
  }

  private resolveHorizontalMovement(body: CollisionBody, moveX: number, moveZ: number): void {
    // Attempt X movement
    if (moveX !== 0) {
      const targetX = body.position.x + moveX;
      if (!this.checkWallCollision(targetX, body.position.y, body.position.z, body.radius)) {
        body.position.x = targetX;
      } else {
        body.velocity.x = 0;
      }
    }

    // Attempt Z movement
    if (moveZ !== 0) {
      const targetZ = body.position.z + moveZ;
      if (!this.checkWallCollision(body.position.x, body.position.y, targetZ, body.radius)) {
        body.position.z = targetZ;
      } else {
        body.velocity.z = 0;
      }
    }
  }

  private resolveVerticalMovement(body: CollisionBody, moveY: number): void {
    const targetY = body.position.y + moveY;

    // Check if falling below floor
    if (moveY <= 0) {
      let groundLevel = 0.0;
      let isOverPit = false;

      // Check if over a chasm pit
      for (let i = 0; i < this.chasmPits.length; i++) {
        const pit = this.chasmPits[i];
        if (body.position.x >= pit.min.x && body.position.x <= pit.max.x &&
            body.position.z >= pit.min.z && body.position.z <= pit.max.z) {
          isOverPit = true;
          groundLevel = -50.0; // bottomless abyss
          break;
        }
      }

      if (targetY <= groundLevel && !isOverPit) {
        body.position.y = groundLevel;
        body.isGrounded = true;
        body.velocity.y = 0;
      } else {
        body.position.y = targetY;
        body.isGrounded = false;
      }
    } else {
      // Moving up (jump)
      body.position.y = targetY;
      body.isGrounded = false;
    }
  }

  public checkWallCollision(x: number, y: number, z: number, radius: number): boolean {
    for (let i = 0; i < this.staticObstacles.length; i++) {
      const box = this.staticObstacles[i];
      // Quick AABB expansion check
      if (
        x + radius > box.min.x &&
        x - radius < box.max.x &&
        z + radius > box.min.z &&
        z - radius < box.max.z &&
        y + 1.8 > box.min.y &&
        y < box.max.y
      ) {
        return true;
      }
    }
    return false;
  }

  public isPositionInChasm(x: number, z: number): boolean {
    for (let i = 0; i < this.chasmPits.length; i++) {
      const pit = this.chasmPits[i];
      if (x >= pit.min.x && x <= pit.max.x && z >= pit.min.z && z <= pit.max.z) {
        return true;
      }
    }
    return false;
  }

  public getObstacles(): THREE.Box3[] {
    return this.staticObstacles;
  }

  public getChasmPits(): THREE.Box3[] {
    return this.chasmPits;
  }

  public getBodies(): CollisionBody[] {
    return this.bodies;
  }

  public raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDist: number): RaycastHit | null {
    let closestDist = maxDist;
    let hitPoint: THREE.Vector3 | null = null;
    let hitNormal: THREE.Vector3 | null = null;

    const dirNorm = direction.clone().normalize();
    const ray = new THREE.Ray(origin, dirNorm);

    for (let i = 0; i < this.staticObstacles.length; i++) {
      const box = this.staticObstacles[i];
      const target = new THREE.Vector3();
      const intersect = ray.intersectBox(box, target);

      if (intersect) {
        const d = origin.distanceTo(target);
        if (d < closestDist) {
          closestDist = d;
          hitPoint = target.clone();
          hitNormal = new THREE.Vector3(0, 1, 0); // approx upward / normal
        }
      }
    }

    if (hitPoint) {
      return {
        point: hitPoint,
        normal: hitNormal || new THREE.Vector3(0, 1, 0),
        distance: closestDist,
        materialType: "granite"
      };
    }

    return null;
  }
}
