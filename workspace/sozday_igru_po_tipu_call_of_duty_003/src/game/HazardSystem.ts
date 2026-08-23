import * as THREE from 'three';
import { BALANCE } from '../core/Constants';
import { EventBus } from '../core/EventBus';

export interface HazardObject {
  id: string;
  type: 'SPOTLIGHT_CABLE' | 'FUEL_BARREL' | 'STEAM_VALVE';
  position: THREE.Vector3;
  mesh: THREE.Object3D;
  isTriggered: boolean;
  fallTimer: number;
  isFalling: boolean;
}

export class HazardSystem {
  public hazards: Map<string, HazardObject> = new Map();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createInteractiveHazards();
  }

  private createInteractiveHazards(): void {
    // Hanging spotlight #1 over main courtyard
    const spotGroup = new THREE.Group();
    spotGroup.position.set(-20, 24, 15);

    // Cable mesh
    const cableGeo = new THREE.CylinderGeometry(0.04, 0.04, 8);
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const cableMesh = new THREE.Mesh(cableGeo, cableMat);
    cableMesh.position.set(0, 4, 0);
    spotGroup.add(cableMesh);

    // Heavy lamp fixture
    const lampGeo = new THREE.ConeGeometry(1.2, 1.6, 12);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5 });
    const lampMesh = new THREE.Mesh(lampGeo, lampMat);
    lampMesh.rotation.x = Math.PI;
    spotGroup.add(lampMesh);

    this.scene.add(spotGroup);
    this.hazards.set('spotlight_cable_1', {
      id: 'spotlight_cable_1',
      type: 'SPOTLIGHT_CABLE',
      position: new THREE.Vector3(-20, 24, 15),
      mesh: spotGroup,
      isTriggered: false,
      fallTimer: BALANCE.structure_fall_time, // 0.45 s
      isFalling: false
    });

    // Fuel barrel near generator
    const barrelGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.4, 12);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 });
    const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
    barrelMesh.position.set(25, 0.7, 10);
    barrelMesh.castShadow = true;
    this.scene.add(barrelMesh);

    this.hazards.set('fuel_barrel_1', {
      id: 'fuel_barrel_1',
      type: 'FUEL_BARREL',
      position: new THREE.Vector3(25, 0.7, 10),
      mesh: barrelMesh,
      isTriggered: false,
      fallTimer: 0,
      isFalling: false
    });
  }

  public update(dt: number, onHazardImpact: (pos: THREE.Vector3, radius: number, type: string) => void): void {
    for (const hazard of this.hazards.values()) {
      if (hazard.isFalling) {
        hazard.fallTimer -= dt;
        hazard.mesh.position.y -= 45 * dt;

        if (hazard.fallTimer <= 0 || hazard.mesh.position.y <= 0.8) {
          hazard.isFalling = false;
          hazard.mesh.position.y = 0.8;
          onHazardImpact(hazard.mesh.position, BALANCE.spotlight_hazard_radius, hazard.type);
        }
      }
    }
  }

  public triggerHazard(hazardId: string): boolean {
    const hazard = this.hazards.get(hazardId);
    if (!hazard || hazard.isTriggered) return false;

    hazard.isTriggered = true;
    if (hazard.type === 'SPOTLIGHT_CABLE') {
      hazard.isFalling = true;
      hazard.fallTimer = BALANCE.structure_fall_time; // 0.45 s
    }

    EventBus.emit('HAZARD_TRIGGERED', {
      hazardId: hazard.id,
      hazardType: hazard.type,
      posX: hazard.position.x,
      posY: hazard.position.y,
      posZ: hazard.position.z
    });

    return true;
  }

  public checkRayHit(origin: THREE.Vector3, direction: THREE.Vector3): HazardObject | null {
    const ray = new THREE.Ray(origin, direction);
    const box = new THREE.Box3();

    for (const hazard of this.hazards.values()) {
      if (hazard.isTriggered) continue;
      box.setFromObject(hazard.mesh);
      // Expand hitbox slightly for responsiveness
      box.expandByScalar(0.4);
      if (ray.intersectsBox(box)) {
        return hazard;
      }
    }
    return null;
  }
}
