import * as THREE from 'three';

export interface Collider {
  id: string;
  box: THREE.Box3;
  isPenetrable: boolean; // For wallbang
  penetrationRatio: number; // e.g. 0.65
  maxThickness: number; // e.g. 0.20
}

export class PhysicsWorld {
  private static instance: PhysicsWorld;
  public colliders: Collider[] = [];
  public readonly arenaBounds = new THREE.Box3(
    new THREE.Vector3(-12, -1, -8),
    new THREE.Vector3(12, 10, 8)
  );

  public static get(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld();
    }
    return PhysicsWorld.instance;
  }

  public initArena(): void {
    this.colliders = [];

    // Main Cover I-Beams (1.2m wide, impenetrable)
    this.addBoxCollider('beam_p1', new THREE.Vector3(-4.5, 1.5, -2), new THREE.Vector3(1.2, 3.0, 1.2), false, 0.0, 0.0);
    this.addBoxCollider('beam_p2', new THREE.Vector3(-4.5, 1.5, 2), new THREE.Vector3(1.2, 3.0, 1.2), false, 0.0, 0.0);
    this.addBoxCollider('beam_e1', new THREE.Vector3(4.5, 1.5, -2), new THREE.Vector3(1.2, 3.0, 1.2), false, 0.0, 0.0);
    this.addBoxCollider('beam_e2', new THREE.Vector3(4.5, 1.5, 2), new THREE.Vector3(1.2, 3.0, 1.2), false, 0.0, 0.0);

    // Center Ventilation Block
    this.addBoxCollider('vent_center', new THREE.Vector3(0, 1.1, 0), new THREE.Vector3(2.4, 2.2, 1.6), false, 0.0, 0.0);

    // Light Wallbang Shield (0.2m thickness, 0.65 penetration)
    this.addBoxCollider('wallbang_north', new THREE.Vector3(0, 1.2, -4.5), new THREE.Vector3(3.2, 2.4, 0.2), true, 0.65, 0.20);
    this.addBoxCollider('wallbang_south', new THREE.Vector3(0, 1.2, 4.5), new THREE.Vector3(3.2, 2.4, 0.2), true, 0.65, 0.20);
  }

  public addBoxCollider(id: string, center: THREE.Vector3, size: THREE.Vector3, isPenetrable: boolean, penetrationRatio: number, maxThickness: number): void {
    const half = size.clone().multiplyScalar(0.5);
    const box = new THREE.Box3(
      center.clone().sub(half),
      center.clone().add(half)
    );
    this.colliders.push({
      id,
      box,
      isPenetrable,
      penetrationRatio,
      maxThickness
    });
  }

  public resolveMovement(currentPos: THREE.Vector3, targetPos: THREE.Vector3, radius: number = 0.4): THREE.Vector3 {
    const result = targetPos.clone();
    
    // Clamp to rooftop boundary
    result.x = Math.max(this.arenaBounds.min.x + radius, Math.min(this.arenaBounds.max.x - radius, result.x));
    result.z = Math.max(this.arenaBounds.min.z + radius, Math.min(this.arenaBounds.max.z - radius, result.z));

    const playerBox = new THREE.Box3();
    const half = new THREE.Vector3(radius, 0.9, radius);

    // Simple AABB continuous sliding collision
    for (const col of this.colliders) {
      playerBox.set(result.clone().sub(half), result.clone().add(half));
      if (playerBox.intersectsBox(col.box)) {
        // Try slide on X
        const testX = new THREE.Vector3(result.x, currentPos.y, currentPos.z);
        playerBox.set(testX.clone().sub(half), testX.clone().add(half));
        if (!playerBox.intersectsBox(col.box)) {
          result.z = currentPos.z;
        } else {
          // Try slide on Z
          const testZ = new THREE.Vector3(currentPos.x, currentPos.y, result.z);
          playerBox.set(testZ.clone().sub(half), testZ.clone().add(half));
          if (!playerBox.intersectsBox(col.box)) {
            result.x = currentPos.x;
          } else {
            result.x = currentPos.x;
            result.z = currentPos.z;
          }
        }
      }
    }

    return result;
  }
}