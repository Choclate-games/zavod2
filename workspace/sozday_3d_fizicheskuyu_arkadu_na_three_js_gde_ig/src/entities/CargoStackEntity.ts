/**
 * CargoStackEntity: Synchronizes procedural 3D cargo meshes with Rapier RigidBody states.
 */

import * as THREE from 'three';
import { CargoBodyState } from '../physics/PhysicsWorld';
import { ProceduralModels } from '../rendering/ProceduralModels';

export class CargoStackEntity {
  private container: THREE.Group;
  private itemMeshes: Map<string, THREE.Group> = new Map();

  constructor() {
    this.container = new THREE.Group();
    this.container.name = 'cargo_stack_container';
  }

  public getContainer(): THREE.Group {
    return this.container;
  }

  public rebuildStack(bodies: CargoBodyState[]): void {
    // Clear old meshes
    while (this.container.children.length > 0) {
      this.container.remove(this.container.children[0]);
    }
    this.itemMeshes.clear();

    // Create 3D meshes for each body
    for (const bodyState of bodies) {
      const def = bodyState.def;
      let mesh: THREE.Group;

      switch (def.type) {
        case 'tv':
          mesh = ProceduralModels.createTvMesh(def.width, def.height, def.depth);
          break;
        case 'aquarium':
          mesh = ProceduralModels.createAquariumMesh(def.width, def.height, def.depth);
          break;
        case 'pizza_stack':
          mesh = ProceduralModels.createPizzaStackMesh(def.width, def.height, def.depth);
          break;
        case 'crate':
          mesh = ProceduralModels.createCrateMesh(def.width, def.height, def.depth);
          break;
        case 'vase':
          mesh = ProceduralModels.createVaseMesh(def.width, def.height, def.depth);
          break;
        case 'parcel':
        default:
          mesh = ProceduralModels.createParcelMesh(def.width, def.height, def.depth);
          break;
      }

      mesh.position.set(bodyState.posX, bodyState.posY, bodyState.posZ);
      this.container.add(mesh);
      this.itemMeshes.set(def.id, mesh);
    }
  }

  public update(bodies: CargoBodyState[], sloshDisplacement: number): void {
    for (const body of bodies) {
      const mesh = this.itemMeshes.get(body.def.id);
      if (mesh) {
        mesh.position.set(body.posX, body.posY, body.posZ);
        mesh.quaternion.set(body.rotX, body.rotY, body.rotZ, body.rotW);

        // Update aquarium internal water & goldfish slosh
        if (body.def.type === 'aquarium') {
          const water = mesh.getObjectByName('aquarium_water');
          if (water) {
            water.rotation.z = sloshDisplacement * 1.5;
          }
          const fish = mesh.getObjectByName('goldfish');
          if (fish) {
            fish.position.x = Math.sin(Date.now() * 0.005) * 0.1 + sloshDisplacement;
            fish.position.y = Math.cos(Date.now() * 0.004) * 0.05;
          }
        }
      }
    }
  }
}
