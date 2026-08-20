import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { EventBus } from '../core/EventBus';
import type { CargoKind, CargoPackageType } from '../core/types';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import { RoadGenerator } from '../world/RoadGenerator';
import { TruckController } from './TruckController';
import { CARGO_SPECS, CARGO_PACKAGES, type CargoSlot } from './truckSpec';

interface CargoItem {
  body: RAPIER.RigidBody;
  mesh: THREE.Object3D;
  slot: CargoSlot;
  kind: CargoKind;
  active: boolean;
}

/**
 * Cargo is spawned from bed-local slots, so it always starts inside the bed walls and
 * never overlaps the chassis collider — an overlap makes Rapier eject the load on frame one.
 * Supports multiple cargo packages: Logs, Fuel Barrels, Construction Materials, Farm Hay, Fragile Supplies, and Mixed.
 */
export class CargoManager {
  total = 8;
  remaining = 8;
  currentPackage: CargoPackageType = 'logs';
  private readonly items: CargoItem[] = [];
  private readonly scratch = new THREE.Vector3();

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly scene: SceneManager,
    private readonly truck: TruckController,
    private readonly road: RoadGenerator,
  ) {}

  build(packageType: CargoPackageType = 'logs'): void {
    this.clear();
    this.currentPackage = packageType;
    const pkg = CARGO_PACKAGES[packageType] || CARGO_PACKAGES.logs;
    this.total = pkg.slots.length;
    this.remaining = this.total;

    for (const slot of pkg.slots) {
      const mesh = this.createCargoVisual(slot.kind);
      this.scene.cargoGroup.add(mesh);
      const spawn = this.slotToWorld(slot);
      const body = this.createCargoPhysicsBody(slot.kind, mesh, spawn);
      this.items.push({ body, mesh, slot, kind: slot.kind, active: true });
    }
  }

  clear(): void {
    for (const item of this.items) {
      this.physics.removeBody(item.body);
    }
    this.items.length = 0;
    this.scene.clearGroup(this.scene.cargoGroup);
  }

  /** Bodies are re-used across runs: a lost cargo item is disabled, not destroyed, then re-enabled here. */
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
      events.emit('cargo:lost', { remaining: this.remaining, total: this.total, kind: item.kind });
    }
  }

  private slotToWorld(slot: CargoSlot): THREE.Vector3 {
    return this.truck.localToWorld(this.scratch.set(slot.x, slot.y, slot.z));
  }

  private createCargoPhysicsBody(kind: CargoKind, mesh: THREE.Object3D, spawn: THREE.Vector3): RAPIER.RigidBody {
    const spec = CARGO_SPECS[kind];
    const dims = spec.dimensions;

    switch (kind) {
      case 'log':
        return this.physics.createCargoLog(
          mesh,
          spawn,
          dims.radius ?? 0.28,
          dims.halfLength ?? 0.95,
          spec.mass,
          spec.friction,
          spec.restitution,
        );

      case 'pipe':
        return this.physics.createCargoLog(
          mesh,
          spawn,
          dims.radius ?? 0.24,
          dims.halfLength ?? 0.95,
          spec.mass,
          spec.friction,
          spec.restitution,
        );

      case 'barrel':
        return this.physics.createCargoBarrel(
          mesh,
          spawn,
          dims.radius ?? 0.28,
          dims.halfLength ?? 0.38,
          spec.mass,
          spec.friction,
          spec.restitution,
        );

      case 'concrete':
        return this.physics.createCargoBox(
          mesh,
          spawn,
          new THREE.Vector3(dims.halfX ?? 0.38, dims.halfY ?? 0.22, dims.halfZ ?? 0.38),
          spec.mass,
          spec.friction,
          spec.restitution,
        );

      case 'hay':
        return this.physics.createCargoBox(
          mesh,
          spawn,
          new THREE.Vector3(dims.halfX ?? 0.38, dims.halfY ?? 0.28, dims.halfZ ?? 0.42),
          spec.mass,
          spec.friction,
          spec.restitution,
        );

      case 'fragile':
        return this.physics.createCargoBox(
          mesh,
          spawn,
          new THREE.Vector3(dims.halfX ?? 0.32, dims.halfY ?? 0.32, dims.halfZ ?? 0.32),
          spec.mass,
          spec.friction,
          spec.restitution,
        );

      case 'crate':
      default:
        return this.physics.createCargoBox(
          mesh,
          spawn,
          new THREE.Vector3(dims.halfX ?? 0.31, dims.halfY ?? 0.31, dims.halfZ ?? 0.31),
          spec.mass,
          spec.friction,
          spec.restitution,
        );
    }
  }

  private createCargoVisual(kind: CargoKind): THREE.Object3D {
    const { materials } = this.scene;
    const group = new THREE.Group();

    switch (kind) {
      case 'log': {
        const r = CARGO_SPECS.log.dimensions.radius ?? 0.28;
        const hl = CARGO_SPECS.log.dimensions.halfLength ?? 0.95;
        const geom = new THREE.CylinderGeometry(r, r, hl * 2, 14);
        geom.rotateX(Math.PI / 2);
        const logMesh = new THREE.Mesh(geom, materials.log);
        logMesh.castShadow = true;
        group.add(logMesh);

        for (const z of [-hl, hl]) {
          const endGeom = new THREE.CircleGeometry(r * 0.96, 12);
          const end = new THREE.Mesh(endGeom, materials.logEnd);
          end.position.set(0, 0, z + (z < 0 ? -0.005 : 0.005));
          if (z < 0) end.rotateY(Math.PI);
          group.add(end);
        }
        break;
      }

      case 'crate': {
        const h = CARGO_SPECS.crate.dimensions.halfX ?? 0.31;
        const crateMesh = new THREE.Mesh(new THREE.BoxGeometry(h * 2, h * 2, h * 2), materials.crate);
        crateMesh.castShadow = true;
        group.add(crateMesh);

        // Corner braces
        const trimX = new THREE.Mesh(new THREE.BoxGeometry(h * 2.02, 0.04, 0.04), materials.crateDark);
        trimX.position.set(0, h - 0.02, h - 0.02);
        group.add(trimX);
        break;
      }

      case 'barrel': {
        const r = CARGO_SPECS.barrel.dimensions.radius ?? 0.28;
        const hh = CARGO_SPECS.barrel.dimensions.halfLength ?? 0.38;
        const barrelMesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hh * 2, 16), materials.barrel);
        barrelMesh.castShadow = true;
        group.add(barrelMesh);

        // Reinforcement rib rings
        for (const y of [-hh * 0.5, hh * 0.5]) {
          const ringGeom = new THREE.TorusGeometry(r * 1.01, 0.022, 6, 16);
          ringGeom.rotateX(Math.PI / 2);
          const ring = new THREE.Mesh(ringGeom, materials.barrelBand);
          ring.position.set(0, y, 0);
          group.add(ring);
        }
        break;
      }

      case 'concrete': {
        const dims = CARGO_SPECS.concrete.dimensions;
        const hx = dims.halfX ?? 0.38;
        const hy = dims.halfY ?? 0.22;
        const hz = dims.halfZ ?? 0.38;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), materials.concrete);
        slab.castShadow = true;
        group.add(slab);

        // Rebar/grout stripe
        const seam = new THREE.Mesh(new THREE.BoxGeometry(hx * 2.01, 0.04, hz * 2.01), materials.rockDark);
        seam.position.set(0, 0, 0);
        group.add(seam);
        break;
      }

      case 'hay': {
        const dims = CARGO_SPECS.hay.dimensions;
        const hx = dims.halfX ?? 0.38;
        const hy = dims.halfY ?? 0.28;
        const hz = dims.halfZ ?? 0.42;
        const bale = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), materials.hay);
        bale.castShadow = true;
        group.add(bale);

        // Twine binding straps
        for (const z of [-hz * 0.45, hz * 0.45]) {
          const strap = new THREE.Mesh(new THREE.BoxGeometry(hx * 2.02, hy * 2.02, 0.03), materials.hayBand);
          strap.position.set(0, 0, z);
          group.add(strap);
        }
        break;
      }

      case 'pipe': {
        const r = CARGO_SPECS.pipe.dimensions.radius ?? 0.24;
        const hl = CARGO_SPECS.pipe.dimensions.halfLength ?? 0.95;
        const geom = new THREE.CylinderGeometry(r, r, hl * 2, 16);
        geom.rotateX(Math.PI / 2);
        const pipeMesh = new THREE.Mesh(geom, materials.pipe);
        pipeMesh.castShadow = true;
        group.add(pipeMesh);

        // Inner hollow ring ends
        for (const z of [-hl, hl]) {
          const ring = new THREE.Mesh(new THREE.RingGeometry(0, r * 0.82, 14), materials.pipeEnd);
          ring.position.set(0, 0, z + (z < 0 ? -0.005 : 0.005));
          if (z < 0) ring.rotateY(Math.PI);
          group.add(ring);
        }
        break;
      }

      case 'fragile': {
        const dims = CARGO_SPECS.fragile.dimensions;
        const h = dims.halfX ?? 0.32;
        const box = new THREE.Mesh(new THREE.BoxGeometry(h * 2, h * 2, h * 2), materials.fragile);
        box.castShadow = true;
        group.add(box);

        // Red cross hazard insignia on 4 sides
        for (const side of [-1, 1]) {
          // X-facing cross
          const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.02, h * 0.9, 0.12), materials.fragileCross);
          vBar.position.set(side * (h + 0.005), 0, 0);
          const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, h * 0.9), materials.fragileCross);
          hBar.position.set(side * (h + 0.005), 0, 0);
          group.add(vBar, hBar);

          // Z-facing cross
          const vzBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.9, 0.02), materials.fragileCross);
          vzBar.position.set(0, 0, side * (h + 0.005));
          const hzBar = new THREE.Mesh(new THREE.BoxGeometry(h * 0.9, 0.12, 0.02), materials.fragileCross);
          hzBar.position.set(0, 0, side * (h + 0.005));
          group.add(vzBar, hzBar);
        }
        break;
      }
    }

    return group;
  }
}

