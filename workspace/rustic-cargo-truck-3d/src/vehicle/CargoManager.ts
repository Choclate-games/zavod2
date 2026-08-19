import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { EventBus } from '../core/EventBus';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import { RoadGenerator } from '../world/RoadGenerator';
import { TruckController } from './TruckController';
import { CARGO, CARGO_SLOTS } from './truckSpec';

interface CargoItem {
  body: RAPIER.RigidBody;
  mesh: THREE.Object3D;
  slot: (typeof CARGO_SLOTS)[number];
  active: boolean;
}

/**
 * Cargo is spawned from bed-local slots, so it always starts inside the bed walls and
 * never overlaps the chassis collider — an overlap makes Rapier eject the load on frame one.
 */
export class CargoManager {
  readonly total = CARGO_SLOTS.length;
  remaining = this.total;
  private readonly items: CargoItem[] = [];
  private readonly scratch = new THREE.Vector3();

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly scene: SceneManager,
    private readonly truck: TruckController,
    private readonly road: RoadGenerator,
  ) {}

  build(): void {
    const logGeometry = new THREE.CylinderGeometry(CARGO.log.radius, CARGO.log.radius, CARGO.log.halfLength * 2, 12);
    logGeometry.rotateX(Math.PI / 2);
    const crateGeometry = new THREE.BoxGeometry(CARGO.crate.half * 2, CARGO.crate.half * 2, CARGO.crate.half * 2);
    for (const slot of CARGO_SLOTS) {
      const isLog = slot.kind === 'log';
      const mesh = new THREE.Mesh(isLog ? logGeometry : crateGeometry, isLog ? this.scene.materials.log : this.scene.materials.crate);
      mesh.castShadow = true;
      this.scene.cargoGroup.add(mesh);
      const spawn = this.slotToWorld(slot);
      const body = isLog
        ? this.physics.createCargoLog(mesh, spawn, CARGO.log.radius, CARGO.log.halfLength, CARGO.log.mass)
        : this.physics.createCargoBox(mesh, spawn, new THREE.Vector3(CARGO.crate.half, CARGO.crate.half, CARGO.crate.half), CARGO.crate.mass);
      this.items.push({ body, mesh, slot, active: true });
    }
  }

  /** Bodies are re-used across runs: a lost log is disabled, not destroyed, then re-enabled here. */
  reset(): void {
    this.remaining = this.total;
    for (const item of this.items) {
      item.active = true;
      item.mesh.visible = true;
      item.body.setEnabled(true);
      this.physics.placeBody(item.body, this.slotToWorld(item.slot));
    }
  }

  fixedUpdate(events: EventBus): void {
    for (const item of this.items) {
      if (!item.active) continue;
      const p = item.body.translation();
      // On the ground means off the truck: the bed floor sits well above the terrain everywhere.
      const grounded = p.y < this.road.heightAt(p.x, p.z) + 0.55;
      const behind = p.z < this.truck.positionZ - 14;
      if (!grounded && !behind && p.y > -6) continue;
      item.active = false;
      item.mesh.visible = false;
      item.body.setEnabled(false);
      this.remaining = Math.max(0, this.remaining - 1);
      events.emit('cargo:lost', { remaining: this.remaining, total: this.total });
    }
  }

  private slotToWorld(slot: (typeof CARGO_SLOTS)[number]): THREE.Vector3 {
    return this.truck.localToWorld(this.scratch.set(slot.x, slot.y, slot.z));
  }
}
