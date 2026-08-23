import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export interface PhysicsBodyHandle {
  id: string;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh?: THREE.Object3D;
  isHazard?: boolean;
  hazardType?: string;
  isAlive?: boolean;
}

export class PhysicsWorld {
  private world: RAPIER.World | null = null;
  private isInitialized = false;
  private handles: Map<string, PhysicsBodyHandle> = new Map();

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await RAPIER.init();
      const gravity = { x: 0.0, y: -9.81, z: 0.0 };
      this.world = new RAPIER.World(gravity);
      this.world.timestep = 1 / 60;
      this.isInitialized = true;
      console.info('[PhysicsWorld] Rapier3D initialized');
    } catch (err) {
      console.error('[PhysicsWorld] Failed to initialize Rapier3D:', err);
    }
  }

  public step(): void {
    if (!this.world) return;
    this.world.step();

    // Sync mesh transforms from physics bodies
    for (const handle of this.handles.values()) {
      if (handle.mesh && handle.body.isDynamic()) {
        const trans = handle.body.translation();
        const rot = handle.body.rotation();
        handle.mesh.position.set(trans.x, trans.y, trans.z);
        handle.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      }
    }
  }

  public addStaticBox(id: string, x: number, y: number, z: number, hx: number, hy: number, hz: number): PhysicsBodyHandle | null {
    if (!this.world) return null;
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
    const collider = this.world.createCollider(colliderDesc, body);

    const handle: PhysicsBodyHandle = { id, body, collider };
    this.handles.set(id, handle);
    return handle;
  }

  public addDynamicBox(
    id: string,
    x: number,
    y: number,
    z: number,
    hx: number,
    hy: number,
    hz: number,
    mesh?: THREE.Object3D,
    isHazard = false,
    hazardType = ''
  ): PhysicsBodyHandle | null {
    if (!this.world) return null;
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setRestitution(0.2);
    const collider = this.world.createCollider(colliderDesc, body);

    const handle: PhysicsBodyHandle = { id, body, collider, mesh, isHazard, hazardType, isAlive: true };
    this.handles.set(id, handle);
    return handle;
  }

  public raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxToi = 1000
  ): { point: THREE.Vector3; normal: THREE.Vector3; handleId?: string; toi: number } | null {
    if (!this.world) return null;
    const ray = new RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z }
    );
    const hit = this.world.castRayAndGetNormal(ray, maxToi, true);
    if (!hit) return null;

    const toi = (hit as any).timeOfImpact ?? (hit as any).toi ?? 0;
    const hitPoint = new THREE.Vector3(
      origin.x + direction.x * toi,
      origin.y + direction.y * toi,
      origin.z + direction.z * toi
    );
    const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);

    let hitHandleId: string | undefined;
    for (const [id, handle] of this.handles.entries()) {
      if (handle.collider.handle === hit.collider.handle) {
        hitHandleId = id;
        break;
      }
    }

    return { point: hitPoint, normal, handleId: hitHandleId, toi };
  }

  public getHandle(id: string): PhysicsBodyHandle | undefined {
    return this.handles.get(id);
  }

  public removeHandle(id: string): void {
    const handle = this.handles.get(id);
    if (handle && this.world) {
      this.world.removeCollider(handle.collider, false);
      this.world.removeRigidBody(handle.body);
      this.handles.delete(id);
    }
  }

  public clear(): void {
    if (!this.world) return;
    for (const handle of this.handles.values()) {
      try {
        this.world.removeCollider(handle.collider, false);
        this.world.removeRigidBody(handle.body);
      } catch {
        // Ignored
      }
    }
    this.handles.clear();
  }
}
