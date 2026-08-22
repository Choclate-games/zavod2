import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { EventBus } from "../core/EventBus";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { TimeManager } from "../core/TimeManager";
import { VFXPool } from "../renderer/VFXPool";
import { ProceduralMeshFactory } from "../renderer/ProceduralMeshFactory";
import type { BreachPointData, ExplosiveConfig, ExplosiveId } from "../core/Types";

export const EXPLOSIVE_CONFIGS: Record<ExplosiveId, ExplosiveConfig> = {
  c4_standard: {
    id: "c4_standard",
    name: "Пластичный C4",
    blastRadius: 2.2,
    impulseForce: 450,
    canBreachReinforced: false,
    stunDuration: 2.5,
    cost: 0,
    description: "Стандартный направленный заряд для гипсокартона и деревянных дверей.",
  },
  thermite_x: {
    id: "thermite_x",
    name: "Термо-лента Thermite-X",
    blastRadius: 2.8,
    impulseForce: 520,
    canBreachReinforced: true,
    stunDuration: 3.0,
    cost: 800,
    description: "Прожигает армированную сталь и титановые перегородки за доли секунды.",
  },
  heavy_c4: {
    id: "heavy_c4",
    name: "Кумулятивный Молот C4",
    blastRadius: 3.5,
    impulseForce: 680,
    canBreachReinforced: true,
    stunDuration: 3.5,
    cost: 1500,
    description: "Сверхмощный заряд с максимальным радиусом разлета осколков и контузии.",
  },
};

export interface ActiveBreachWall {
  data: BreachPointData;
  intactMesh: THREE.Group;
  fracturedMesh: THREE.Group;
  debrisPieces: { hx: number; hy: number; hz: number; mesh: THREE.Mesh; body?: RAPIER.RigidBody }[];
  staticCollider: RAPIER.Collider;
  staticBody: RAPIER.RigidBody;
  c4Mesh?: THREE.Group;
  isPlanted: boolean;
  isBreached: boolean;
}

export class BreachManager {
  private eventBus: EventBus;
  private physics: PhysicsWorld;
  private timeManager: TimeManager;
  private vfx: VFXPool;
  private scene: THREE.Scene;

  public activeWalls: ActiveBreachWall[] = [];
  public selectedExplosive: ExplosiveConfig = EXPLOSIVE_CONFIGS.c4_standard;
  private plantedWall: ActiveBreachWall | null = null;

  constructor(
    eventBus: EventBus,
    physics: PhysicsWorld,
    timeManager: TimeManager,
    vfx: VFXPool,
    scene: THREE.Scene
  ) {
    this.eventBus = eventBus;
    this.physics = physics;
    this.timeManager = timeManager;
    this.vfx = vfx;
    this.scene = scene;
  }

  setupBreachPoints(points: BreachPointData[]): void {
    this.cleanup();

    points.forEach((point) => {
      const { intactMesh, fracturedMesh, debrisPieces } =
        ProceduralMeshFactory.createDestructibleWallMesh(
          point.width,
          point.height,
          0.3,
          point.isReinforced,
          point.isDoor
        );

      intactMesh.position.set(point.x, point.y, point.z);
      intactMesh.rotation.y = point.rotY;
      fracturedMesh.position.set(point.x, point.y, point.z);
      fracturedMesh.rotation.y = point.rotY;

      this.scene.add(intactMesh);
      this.scene.add(fracturedMesh);

      // Create static physical collider for intact wall
      const { body, collider } = this.physics.createStaticBox(
        point.x,
        point.y,
        point.z,
        point.width / 2,
        point.height / 2,
        0.15
      );

      this.activeWalls.push({
        data: point,
        intactMesh,
        fracturedMesh,
        debrisPieces,
        staticCollider: collider,
        staticBody: body,
        isPlanted: false,
        isBreached: false,
      });
    });
  }

  plantCharge(wallId: string): boolean {
    const wall = this.activeWalls.find((w) => w.data.id === wallId);
    if (!wall || wall.isBreached) return false;

    if (wall.data.isReinforced && !this.selectedExplosive.canBreachReinforced) {
      return false; // Requires Thermite / Heavy C4
    }

    if (wall.c4Mesh) {
      this.scene.remove(wall.c4Mesh);
    }

    const c4 = ProceduralMeshFactory.createC4ChargeMesh();
    c4.position.set(wall.data.x, wall.data.y, wall.data.z - 0.16);
    c4.rotation.y = wall.data.rotY;
    this.scene.add(c4);

    wall.c4Mesh = c4;
    wall.isPlanted = true;
    this.plantedWall = wall;

    this.eventBus.emit("breach:planted", {
      point: wall.data,
      explosive: this.selectedExplosive,
    });

    return true;
  }

  detonatePlanted(): boolean {
    if (!this.plantedWall || this.plantedWall.isBreached) return false;

    const wall = this.plantedWall;
    wall.isBreached = true;
    wall.isPlanted = false;

    // 1. Hide intact mesh, show fractured frame
    wall.intactMesh.visible = false;
    wall.fracturedMesh.visible = true;
    if (wall.c4Mesh) {
      this.scene.remove(wall.c4Mesh);
      wall.c4Mesh = undefined;
    }

    // 2. Disable static collider so player & bullets pass through
    this.physics.removeRigidBody(wall.staticBody);

    // 3. Spawn physical debris chunks with radial blast impulse
    wall.debrisPieces.forEach((piece) => {
      const offsetX = (Math.random() - 0.5) * (wall.data.width * 0.5);
      const offsetY = (Math.random() - 0.5) * (wall.data.height * 0.5);
      const spawnX = wall.data.x + offsetX;
      const spawnY = wall.data.y + offsetY;
      const spawnZ = wall.data.z;

      this.scene.add(piece.mesh);
      piece.mesh.position.set(spawnX, spawnY, spawnZ);
      piece.mesh.visible = true;

      const { body } = this.physics.createDynamicDebris(
        spawnX,
        spawnY,
        spawnZ,
        piece.hx,
        piece.hy,
        piece.hz,
        0.4
      );

      // Apply explosive impulse flying into the room (+Z direction)
      const impulseVector = new RAPIER.Vector3(
        (Math.random() - 0.5) * 4.0,
        Math.random() * 5.0 + 2.0,
        Math.random() * 8.0 + 6.0
      );
      body.applyImpulse(impulseVector, true);
      body.applyTorqueImpulse(
        new RAPIER.Vector3(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5
        ),
        true
      );

      piece.body = body;
    });

    // 4. Spawn Explosion VFX
    this.vfx.spawnExplosion({ x: wall.data.x, y: wall.data.y, z: wall.data.z });

    // 5. Trigger Slow-Mo
    this.timeManager.triggerSlowMo(2.5, 0.2);

    // 6. Emit Detonation Event
    this.eventBus.emit("breach:detonated", {
      point: wall.data,
      explosive: this.selectedExplosive,
      position: { x: wall.data.x, y: wall.data.y, z: wall.data.z },
    });

    this.plantedWall = null;
    return true;
  }

  update(_scaledDt: number): void {
    // Sync active debris pieces from Rapier3D bodies
    this.activeWalls.forEach((wall) => {
      if (wall.isBreached) {
        wall.debrisPieces.forEach((piece) => {
          if (piece.body && piece.mesh.visible) {
            const trans = piece.body.translation();
            const rot = piece.body.rotation();
            piece.mesh.position.set(trans.x, trans.y, trans.z);
            piece.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
          }
        });
      }
    });
  }

  cleanup(): void {
    this.activeWalls.forEach((wall) => {
      this.scene.remove(wall.intactMesh);
      this.scene.remove(wall.fracturedMesh);
      if (wall.c4Mesh) this.scene.remove(wall.c4Mesh);
      this.physics.removeRigidBody(wall.staticBody);

      wall.debrisPieces.forEach((piece) => {
        this.scene.remove(piece.mesh);
        if (piece.body) this.physics.removeRigidBody(piece.body);
      });
    });
    this.activeWalls = [];
    this.plantedWall = null;
  }
}
