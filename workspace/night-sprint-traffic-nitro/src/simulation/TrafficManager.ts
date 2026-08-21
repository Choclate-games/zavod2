import * as THREE from 'three';
import { proceduralModels } from '../rendering/ProceduralModels';
import { TrafficCarType, TrafficVehicleData } from '../types';
import { CONFIG } from '../core/Config';
import { eventBus } from '../core/EventBus';

export class TrafficManager {
  readonly group = new THREE.Group();

  private readonly poolSize = 24;
  private vehicleData: TrafficVehicleData[] = [];
  private vehicleMeshes: THREE.Group[] = [];

  // 4 Lanes
  private readonly lanePositions = [-5.5, -1.8, 1.8, 5.5];
  private readonly laneIsOpposing = [true, true, false, false];

  constructor(
    private readonly scene: THREE.Scene
  ) {
    this.scene.add(this.group);
    this.initializePool();
  }

  private initializePool(): void {
    const types: TrafficCarType[] = ['sedan', 'taxi', 'muscle', 'truck'];

    for (let i = 0; i < this.poolSize; i++) {
      const type = types[i % types.length];
      const mesh = proceduralModels.createTrafficVehicle(type);
      mesh.visible = false;
      this.group.add(mesh);
      this.vehicleMeshes.push(mesh);

      const isTruck = type === 'truck';
      this.vehicleData.push({
        id: i,
        type,
        lane: 2,
        speed: 80,
        isOpposing: false,
        length: isTruck ? 12.0 : 4.2,
        width: isTruck ? 2.6 : 1.8,
        height: isTruck ? 3.4 : 1.5,
        turnSignal: 'none',
        turnSignalTimer: 0,
        targetLane: 2,
        nearMissed: false,
      });
    }
  }

  spawnInitial(playerZ: number): void {
    for (let i = 0; i < this.poolSize; i++) {
      const distance = 60 + i * 25;
      this.respawnVehicle(i, playerZ + distance);
    }
  }

  private respawnVehicle(index: number, spawnZ: number): void {
    const data = this.vehicleData[index];
    const mesh = this.vehicleMeshes[index];

    const lane = Math.floor(Math.random() * 4);
    const isOpposing = this.laneIsOpposing[lane];

    data.lane = lane;
    data.targetLane = lane;
    data.isOpposing = isOpposing;
    data.nearMissed = false;
    data.turnSignal = 'none';
    data.turnSignalTimer = 0;

    const baseSpeed = data.type === 'truck' ? 65 : 85 + Math.random() * 30;
    data.speed = isOpposing ? -1 * baseSpeed : baseSpeed;

    const x = this.lanePositions[lane];
    mesh.position.set(x, 0, spawnZ);
    mesh.rotation.y = isOpposing ? Math.PI : 0;
    mesh.visible = true;
  }

  update(dt: number, playerPos: THREE.Vector3, playerSpeedKmh: number, playerInvulnerable: boolean): void {
    for (let i = 0; i < this.poolSize; i++) {
      const data = this.vehicleData[i];
      const mesh = this.vehicleMeshes[i];
      if (!mesh.visible) continue;

      // 1. Move vehicle along Z
      const movementZ = (data.speed / 3.6) * dt;
      mesh.position.z += movementZ;

      // 2. Lane change logic
      if (data.turnSignalTimer > 0) {
        data.turnSignalTimer -= dt;
        if (data.turnSignalTimer <= 0) {
          data.lane = data.targetLane;
          data.turnSignal = 'none';
        }
      } else if (Math.random() < 0.002 && data.type !== 'truck') {
        if (data.lane === 0 && Math.random() < 0.5) {
          data.targetLane = 1;
          data.turnSignal = 'right';
          data.turnSignalTimer = 0.8;
        } else if (data.lane === 1 && Math.random() < 0.5) {
          data.targetLane = 0;
          data.turnSignal = 'left';
          data.turnSignalTimer = 0.8;
        } else if (data.lane === 2 && Math.random() < 0.5) {
          data.targetLane = 3;
          data.turnSignal = 'right';
          data.turnSignalTimer = 0.8;
        } else if (data.lane === 3 && Math.random() < 0.5) {
          data.targetLane = 2;
          data.turnSignal = 'left';
          data.turnSignalTimer = 0.8;
        }
      }

      const targetX = this.lanePositions[data.lane];
      mesh.position.x = THREE.MathUtils.lerp(mesh.position.x, targetX, 3.0 * dt);

      // 3. Recycling behind player
      if (mesh.position.z < playerPos.z - 40.0) {
        const furthestZ = this.getFurthestZ(playerPos.z);
        this.respawnVehicle(i, furthestZ + 20.0 + Math.random() * 25.0);
        continue;
      }

      if (mesh.position.z > playerPos.z + 250.0) {
        mesh.position.z = playerPos.z + 200.0;
      }

      // 4. Collision check
      const dx = Math.abs(mesh.position.x - playerPos.x);
      const dz = Math.abs(mesh.position.z - playerPos.z);
      const collisionX = (data.width / 2) + 0.90;
      const collisionZ = (data.length / 2) + 2.00;

      if (!playerInvulnerable && dx < collisionX && dz < collisionZ) {
        eventBus.emit('game:crash', {
          fatal: data.type === 'truck' || data.isOpposing || playerSpeedKmh > 180,
          speedKmh: playerSpeedKmh,
        });
      }

      // 5. Near Miss trigger check
      if (!data.nearMissed && dz < collisionZ + 1.5 && dx < CONFIG.combo.nearMissMaxLateral + data.width / 2) {
        if (playerSpeedKmh >= CONFIG.combo.nearMissMinSpeedKmh && dx >= collisionX - 0.20) {
          data.nearMissed = true;
          eventBus.emit('near_miss:trigger', {
            distance: dx - data.width / 2,
            isOpposing: data.isOpposing,
            speedKmh: playerSpeedKmh,
            combo: 1,
            position: { x: mesh.position.x, y: 1.0, z: mesh.position.z },
          });
        }
      }
    }
  }

  findHeavyTruckAhead(playerPos: THREE.Vector3, maxDist = 8.0): TrafficVehicleData | null {
    for (let i = 0; i < this.poolSize; i++) {
      const data = this.vehicleData[i];
      const mesh = this.vehicleMeshes[i];
      if (data.type === 'truck' && !data.isOpposing) {
        const dz = mesh.position.z - playerPos.z;
        const dx = Math.abs(mesh.position.x - playerPos.x);
        if (dz > 0 && dz < maxDist + 6.0 && dx < CONFIG.combo.slingshotMaxLateral) {
          return data;
        }
      }
    }
    return null;
  }

  private getFurthestZ(playerZ: number): number {
    let maxZ = playerZ;
    for (const m of this.vehicleMeshes) {
      if (m.visible && m.position.z > maxZ) {
        maxZ = m.position.z;
      }
    }
    return maxZ;
  }

  reset(startZ = 0): void {
    this.spawnInitial(startZ);
  }
}
