/**
 * EntityManager: Aggregates active world entities and coordinates updates.
 */

import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CargoStackEntity } from './CargoStackEntity';
import { CourierEntity } from './CourierEntity';

export class EntityManager {
  private courier: CourierEntity;
  private cargoStack: CargoStackEntity;
  private container: THREE.Group;
  private physicsWorld: PhysicsWorld = PhysicsWorld.get();

  constructor() {
    this.container = new THREE.Group();
    this.container.name = 'entity_manager_root';

    this.courier = new CourierEntity();
    this.cargoStack = new CargoStackEntity();

    this.container.add(this.courier.getMesh());
    this.container.add(this.cargoStack.getContainer());
  }

  public getContainer(): THREE.Group {
    return this.container;
  }

  public resetCargo(level: number): void {
    const bodies = this.physicsWorld.getCargoBodies();
    this.cargoStack.rebuildStack(bodies);
  }

  public update(_dt: number, isMenuIdle: boolean): void {
    const courierState = this.physicsWorld.getCourierState();
    this.courier.update(
      courierState.baseX,
      courierState.crouchOffset,
      courierState.pitchAngleRad,
      courierState.isGripActive,
      isMenuIdle
    );

    const bodies = this.physicsWorld.getCargoBodies();
    const slosh = this.physicsWorld.getSloshDisplacement();
    this.cargoStack.update(bodies, slosh);
  }
}
