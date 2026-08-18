// src/systems/LevelManager.ts
import * as THREE from 'three';
import { Player } from '@/entities/Player';
import { Dog, Waypoint } from '@/entities/Dog';
import { Grain } from '@/entities/Grain';
import { Gate } from '@/entities/Gate';
import { ProceduralModels } from '@/rendering/ProceduralModels';
import { physicsWorld } from '@/physics/PhysicsWorld';
import { sceneManager } from '@/rendering/SceneManager';
import { eventBus } from '@/core/EventBus';

export interface ObstacleData {
  type: 'fence' | 'barn' | 'hay' | 'round_hay' | 'tree' | 'carrots';
  x: number;
  z: number;
  rotY?: number;
  width?: number;
  length?: number;
}

export interface DogData {
  id: string;
  isFastHound?: boolean;
  waypoints: Waypoint[];
}

export interface LevelData {
  index: number;
  title: string;
  subtitle: string;
  timeTargetSec: number;
  playerStart: { x: number; z: number };
  gate: { x: number; z: number; rotY?: number };
  grains: { x: number; z: number }[];
  dogs: DogData[];
  obstacles: ObstacleData[];
}

export class LevelManager {
  private static instance: LevelManager;
  private currentLevelIndex: number = 1;
  private currentLevelData: LevelData | null = null;

  public player: Player | null = null;
  public dogs: Dog[] = [];
  public grains: Grain[] = [];
  public gate: Gate | null = null;

  private levelGroup: THREE.Group = new THREE.Group();
  private grainsCollectedCount: number = 0;
  private totalGrainsCount: number = 0;

  private constructor() {
    sceneManager.scene.add(this.levelGroup);
  }

  public static getInstance(): LevelManager {
    if (!LevelManager.instance) {
      LevelManager.instance = new LevelManager();
    }
    return LevelManager.instance;
  }

  public getCurrentLevelIndex(): number {
    return this.currentLevelIndex;
  }

  public getCurrentLevelData(): LevelData | null {
    return this.currentLevelData;
  }

  public getGrainsProgress(): { collected: number; total: number } {
    return {
      collected: this.grainsCollectedCount,
      total: this.totalGrainsCount
    };
  }

  public async loadLevel(
    levelIndex: number,
    chickenSkin: string = 'classic',
    boxSkin: string = 'cardboard'
  ): Promise<void> {
    this.currentLevelIndex = levelIndex;
    const data = this.getLevelData(levelIndex);
    this.currentLevelData = data;

    // Clear old level
    this.clearLevel();

    // 1. Setup Farm Perimeter Fence & Colliders
    this.buildPerimeterBounds(26, 26);

    // 2. Build Level Obstacles (Barns, Fences, Hay bales, Trees)
    for (const obs of data.obstacles) {
      this.buildObstacle(obs);
    }

    // 3. Create Gate
    this.gate = new Gate(data.gate.x, data.gate.z, data.gate.rotY || 0);
    this.levelGroup.add(this.gate.mesh);

    // Gate static barrier collider (before open)
    physicsWorld.addStaticBox({
      x: data.gate.x,
      y: 1.0,
      z: data.gate.z,
      hx: 1.4,
      hy: 1.0,
      hz: 0.2
    });

    // 4. Create Grains
    this.grains = [];
    this.grainsCollectedCount = 0;
    this.totalGrainsCount = data.grains.length;

    for (let i = 0; i < data.grains.length; i++) {
      const gPos = data.grains[i];
      const grain = new Grain(`grain_${i}`, gPos.x, gPos.z);
      this.grains.push(grain);
      this.levelGroup.add(grain.mesh);
    }

    // 5. Create Dogs
    this.dogs = [];
    for (const d of data.dogs) {
      const dog = new Dog(d.id, d.waypoints, d.isFastHound);
      this.dogs.push(dog);
      this.levelGroup.add(dog.mesh);
    }

    // 6. Create Player
    if (this.player) {
      this.player.destroy();
    }
    this.player = new Player(data.playerStart.x, data.playerStart.z, chickenSkin, boxSkin);
    this.levelGroup.add(this.player.mesh);

    // Set camera target immediately
    sceneManager.setCameraTarget(data.playerStart.x, 0, data.playerStart.z, true);

    eventBus.emit('level:loaded', {
      levelIndex: this.currentLevelIndex,
      totalGrains: this.totalGrainsCount
    });

    eventBus.emit('audio:setBgm', { track: 'stealth' });
  }

  public collectGrain(grain: Grain): void {
    if (grain.isCollected) return;
    grain.collect();
    this.grainsCollectedCount++;

    eventBus.emit('player:grainCollected', {
      current: this.grainsCollectedCount,
      total: this.totalGrainsCount,
      grainX: grain.mesh.position.x,
      grainZ: grain.mesh.position.z
    });

    // If all grains collected -> unlock gate!
    if (this.grainsCollectedCount >= this.totalGrainsCount && this.gate) {
      this.gate.unlockAndOpen();
    }
  }

  public revivePlayer(): void {
    if (!this.player || !this.currentLevelData) return;

    // Respawn player at safe start or checkpoint
    this.player.resetPosition(this.currentLevelData.playerStart.x, this.currentLevelData.playerStart.z);
    this.player.setInvulnerable(3.0);

    // Reset all dog alerts
    for (const dog of this.dogs) {
      dog.resetToPatrol();
    }

    eventBus.emit('player:revived', {
      x: this.currentLevelData.playerStart.x,
      z: this.currentLevelData.playerStart.z
    });
  }

  private buildPerimeterBounds(sizeX: number, sizeZ: number): void {
    const halfX = sizeX / 2;
    const halfZ = sizeZ / 2;

    // 4 boundary colliders
    physicsWorld.addStaticBox({ x: 0, y: 1.0, z: -halfZ, hx: halfX, hy: 1.0, hz: 0.3 }); // North
    physicsWorld.addStaticBox({ x: 0, y: 1.0, z: halfZ, hx: halfX, hy: 1.0, hz: 0.3 });  // South
    physicsWorld.addStaticBox({ x: -halfX, y: 1.0, z: 0, hx: 0.3, hy: 1.0, hz: halfZ }); // West
    physicsWorld.addStaticBox({ x: halfX, y: 1.0, z: 0, hx: 0.3, hy: 1.0, hz: halfZ });  // East

    // Visual boundary fences
    for (let x = -halfX + 1; x < halfX; x += 2.0) {
      const f1 = ProceduralModels.createFence(2.0);
      f1.position.set(x + 1, 0, -halfZ);
      this.levelGroup.add(f1);

      const f2 = ProceduralModels.createFence(2.0);
      f2.position.set(x + 1, 0, halfZ);
      this.levelGroup.add(f2);
    }

    for (let z = -halfZ + 1; z < halfZ; z += 2.0) {
      const f1 = ProceduralModels.createFence(2.0);
      f1.rotation.y = Math.PI / 2;
      f1.position.set(-halfX, 0, z + 1);
      this.levelGroup.add(f1);

      const f2 = ProceduralModels.createFence(2.0);
      f2.rotation.y = Math.PI / 2;
      f2.position.set(halfX, 0, z + 1);
      this.levelGroup.add(f2);
    }
  }

  private buildObstacle(obs: ObstacleData): void {
    let mesh: THREE.Group;

    switch (obs.type) {
      case 'barn': {
        const w = obs.width || 4;
        const l = obs.length || 5;
        mesh = ProceduralModels.createBarn(w, l, 3.2);
        physicsWorld.addStaticBox({
          x: obs.x,
          y: 1.6,
          z: obs.z,
          hx: w / 2,
          hy: 1.6,
          hz: l / 2
        });
        break;
      }

      case 'fence': {
        const len = obs.length || 2.0;
        mesh = ProceduralModels.createFence(len);
        const rot = obs.rotY || 0;
        mesh.rotation.y = rot;

        const isRotated = Math.abs(Math.sin(rot)) > 0.5;
        physicsWorld.addStaticBox({
          x: obs.x,
          y: 0.6,
          z: obs.z,
          hx: isRotated ? 0.15 : len / 2,
          hy: 0.6,
          hz: isRotated ? len / 2 : 0.15
        });
        break;
      }

      case 'hay': {
        mesh = ProceduralModels.createHayBale(false);
        physicsWorld.addStaticBox({
          x: obs.x,
          y: 0.4,
          z: obs.z,
          hx: 0.6,
          hy: 0.4,
          hz: 0.4
        });
        break;
      }

      case 'round_hay': {
        mesh = ProceduralModels.createHayBale(true);
        physicsWorld.addStaticBox({
          x: obs.x,
          y: 0.65,
          z: obs.z,
          hx: 0.6,
          hy: 0.65,
          hz: 0.6
        });
        break;
      }

      case 'tree': {
        mesh = ProceduralModels.createTree();
        physicsWorld.addStaticBox({
          x: obs.x,
          y: 0.7,
          z: obs.z,
          hx: 0.35,
          hy: 0.7,
          hz: 0.35
        });
        break;
      }

      case 'carrots':
      default: {
        mesh = ProceduralModels.createCarrotPatch();
        break;
      }
    }

    mesh.position.set(obs.x, 0, obs.z);
    if (obs.rotY) {
      mesh.rotation.y = obs.rotY;
    }
    this.levelGroup.add(mesh);
  }

  private clearLevel(): void {
    physicsWorld.clearStaticColliders();

    for (const d of this.dogs) {
      d.dispose();
    }
    this.dogs = [];
    this.grains = [];
    this.gate = null;

    while (this.levelGroup.children.length > 0) {
      const obj = this.levelGroup.children[0];
      this.levelGroup.remove(obj);
    }
  }

  // --- 15 LEVEL LAYOUTS DEFINITION ---
  public getLevelData(level: number): LevelData {
    const safeLevel = Math.max(1, Math.min(15, level));

    const levels: Record<number, LevelData> = {
      // Level 1: Tutorial
      1: {
        index: 1,
        title: 'Уровень 1: Побег из курятника',
        subtitle: 'Обучение маскировке: спрячься под коробку!',
        timeTargetSec: 22,
        playerStart: { x: -8, z: 8 },
        gate: { x: 8, z: -8, rotY: 0 },
        grains: [
          { x: -5, z: 5 },
          { x: -2, z: 2 },
          { x: 0, z: 0 },
          { x: 4, z: -2 },
          { x: 6, z: -6 }
        ],
        dogs: [
          {
            id: 'dog_1',
            waypoints: [
              { x: 0, z: 0, waitTime: 2.0 },
              { x: 3, z: 3, waitTime: 2.0 }
            ]
          }
        ],
        obstacles: [
          { type: 'hay', x: -3, z: 0 },
          { type: 'hay', x: 3, z: -3 },
          { type: 'tree', x: -7, z: -7 },
          { type: 'carrots', x: 5, z: 5 }
        ]
      },

      // Level 2: Wooden Maze
      2: {
        index: 2,
        title: 'Уровень 2: Деревянный лабиринт',
        subtitle: 'Используй заборы для укрытия от взгляда собаки',
        timeTargetSec: 28,
        playerStart: { x: -9, z: 9 },
        gate: { x: 9, z: -9, rotY: 0 },
        grains: [
          { x: -7, z: 5 },
          { x: -4, z: 7 },
          { x: -1, z: 2 },
          { x: 2, z: 4 },
          { x: 0, z: -3 },
          { x: 5, z: -2 },
          { x: 7, z: -6 }
        ],
        dogs: [
          {
            id: 'dog_1',
            waypoints: [
              { x: -3, z: 0, waitTime: 1.5 },
              { x: 3, z: 0, waitTime: 1.5 }
            ]
          }
        ],
        obstacles: [
          { type: 'fence', x: -4, z: 2, length: 4, rotY: 0 },
          { type: 'fence', x: 4, z: -2, length: 4, rotY: 0 },
          { type: 'hay', x: 0, z: 5 },
          { type: 'hay', x: 0, z: -5 },
          { type: 'tree', x: 8, z: 8 }
        ]
      },

      // Level 3: Two Guards
      3: {
        index: 3,
        title: 'Уровень 3: Два стража',
        subtitle: 'Два патруля двигаются навстречу друг другу',
        timeTargetSec: 32,
        playerStart: { x: -10, z: 0 },
        gate: { x: 10, z: 0, rotY: Math.PI / 2 },
        grains: [
          { x: -7, z: -4 },
          { x: -7, z: 4 },
          { x: -2, z: -6 },
          { x: -2, z: 6 },
          { x: 2, z: -4 },
          { x: 2, z: 4 },
          { x: 7, z: 0 },
          { x: 8, z: -3 }
        ],
        dogs: [
          {
            id: 'dog_1',
            waypoints: [
              { x: -3, z: -4, waitTime: 1.2 },
              { x: 3, z: -4, waitTime: 1.2 }
            ]
          },
          {
            id: 'dog_2',
            waypoints: [
              { x: 3, z: 4, waitTime: 1.2 },
              { x: -3, z: 4, waitTime: 1.2 }
            ]
          }
        ],
        obstacles: [
          { type: 'round_hay', x: 0, z: 0 },
          { type: 'fence', x: 0, z: -5, length: 3, rotY: Math.PI / 2 },
          { type: 'fence', x: 0, z: 5, length: 3, rotY: Math.PI / 2 },
          { type: 'tree', x: -8, z: -8 },
          { type: 'tree', x: 8, z: 8 }
        ]
      },

      // Level 4: Barn Ambush
      4: {
        index: 4,
        title: 'Уровень 4: Амбарная засада',
        subtitle: 'Большой красный амбар блокирует обзор',
        timeTargetSec: 36,
        playerStart: { x: -10, z: -9 },
        gate: { x: 10, z: 9, rotY: 0 },
        grains: [
          { x: -7, z: -5 },
          { x: -6, z: 0 },
          { x: -4, z: 6 },
          { x: 0, z: 7 },
          { x: 5, z: 6 },
          { x: 6, z: 0 },
          { x: 6, z: -6 },
          { x: 2, z: -7 },
          { x: 8, z: 6 }
        ],
        dogs: [
          {
            id: 'dog_1',
            waypoints: [
              { x: -6, z: 4, waitTime: 1.0 },
              { x: 6, z: 4, waitTime: 1.0 }
            ]
          },
          {
            id: 'dog_2',
            waypoints: [
              { x: 6, z: -4, waitTime: 1.0 },
              { x: -6, z: -4, waitTime: 1.0 }
            ]
          }
        ],
        obstacles: [
          { type: 'barn', x: 0, z: 0, width: 6, length: 5 },
          { type: 'hay', x: -7, z: 6 },
          { type: 'hay', x: 7, z: -6 },
          { type: 'carrots', x: 0, z: -8 }
        ]
      },

      // Level 5: Boss Bulldog
      5: {
        index: 5,
        title: 'Уровень 5: Сторожевой бульдог',
        subtitle: 'Быстрый пес-гончая с расширенным конусом обзора!',
        timeTargetSec: 40,
        playerStart: { x: 0, z: 10 },
        gate: { x: 0, z: -10, rotY: 0 },
        grains: [
          { x: -6, z: 6 },
          { x: 6, z: 6 },
          { x: -7, z: 0 },
          { x: 7, z: 0 },
          { x: -5, z: -5 },
          { x: 5, z: -5 },
          { x: 0, z: 4 },
          { x: 0, z: -6 },
          { x: -3, z: 1 },
          { x: 3, z: 1 }
        ],
        dogs: [
          {
            id: 'dog_hound',
            isFastHound: true,
            waypoints: [
              { x: -5, z: 0, waitTime: 0.8 },
              { x: 0, z: 5, waitTime: 0.8 },
              { x: 5, z: 0, waitTime: 0.8 },
              { x: 0, z: -5, waitTime: 0.8 }
            ]
          },
          {
            id: 'dog_guard',
            waypoints: [
              { x: -6, z: -6, waitTime: 1.5 },
              { x: 6, z: -6, waitTime: 1.5 }
            ]
          }
        ],
        obstacles: [
          { type: 'round_hay', x: -4, z: 3 },
          { type: 'round_hay', x: 4, z: 3 },
          { type: 'round_hay', x: -4, z: -3 },
          { type: 'round_hay', x: 4, z: -3 },
          { type: 'fence', x: 0, z: 0, length: 3, rotY: 0 },
          { type: 'tree', x: -9, z: 0 },
          { type: 'tree', x: 9, z: 0 }
        ]
      },

      // Levels 6-15: Additional Complex Tactical Labyrinths
      6: {
        index: 6,
        title: 'Уровень 6: Огородные прятки',
        subtitle: 'Грядки и заборы скрывают патрулирующих псов',
        timeTargetSec: 38,
        playerStart: { x: -10, z: -10 },
        gate: { x: 10, z: 10, rotY: 0 },
        grains: [
          { x: -8, z: -4 }, { x: -5, z: -8 }, { x: -3, z: -2 },
          { x: 0, z: 0 }, { x: 3, z: 2 }, { x: 5, z: 8 },
          { x: 8, z: 4 }, { x: -2, z: 5 }, { x: 6, z: -4 }, { x: -6, z: 6 }
        ],
        dogs: [
          {
            id: 'dog_1',
            isFastHound: true,
            waypoints: [{ x: -4, z: 0, waitTime: 1.0 }, { x: 4, z: 0, waitTime: 1.0 }]
          },
          {
            id: 'dog_2',
            waypoints: [{ x: 0, z: -6, waitTime: 1.2 }, { x: 0, z: 6, waitTime: 1.2 }]
          }
        ],
        obstacles: [
          { type: 'carrots', x: -5, z: -4 },
          { type: 'carrots', x: 5, z: 4 },
          { type: 'fence', x: -3, z: 3, length: 4, rotY: Math.PI / 2 },
          { type: 'fence', x: 3, z: -3, length: 4, rotY: Math.PI / 2 },
          { type: 'hay', x: 0, z: 0 }
        ]
      },

      7: {
        index: 7,
        title: 'Уровень 7: Соломенный лабиринт',
        subtitle: 'Круглые стога сена создают слепые зоны',
        timeTargetSec: 42,
        playerStart: { x: -10, z: 0 },
        gate: { x: 10, z: 0, rotY: Math.PI / 2 },
        grains: [
          { x: -7, z: -6 }, { x: -7, z: 6 }, { x: -4, z: -2 },
          { x: -4, z: 2 }, { x: 0, z: -6 }, { x: 0, z: 6 },
          { x: 4, z: -2 }, { x: 4, z: 2 }, { x: 7, z: -6 }, { x: 7, z: 6 }, { x: 0, z: 0 }
        ],
        dogs: [
          {
            id: 'dog_1',
            waypoints: [{ x: -5, z: -5, waitTime: 1.0 }, { x: -5, z: 5, waitTime: 1.0 }]
          },
          {
            id: 'dog_2',
            waypoints: [{ x: 5, z: 5, waitTime: 1.0 }, { x: 5, z: -5, waitTime: 1.0 }]
          },
          {
            id: 'dog_3',
            waypoints: [{ x: 0, z: -3, waitTime: 1.5 }, { x: 0, z: 3, waitTime: 1.5 }]
          }
        ],
        obstacles: [
          { type: 'round_hay', x: -3, z: -3 },
          { type: 'round_hay', x: -3, z: 3 },
          { type: 'round_hay', x: 3, z: -3 },
          { type: 'round_hay', x: 3, z: 3 },
          { type: 'hay', x: -8, z: 0 },
          { type: 'hay', x: 8, z: 0 }
        ]
      },

      8: {
        index: 8,
        title: 'Уровень 8: Ночной дозор',
        subtitle: 'Пересекающиеся секторы обзора трех сторожевых псов',
        timeTargetSec: 45,
        playerStart: { x: -10, z: 10 },
        gate: { x: 10, z: -10, rotY: 0 },
        grains: [
          { x: -8, z: 6 }, { x: -5, z: 9 }, { x: -6, z: 2 },
          { x: -2, z: 5 }, { x: 0, z: 0 }, { x: 2, z: -5 },
          { x: 6, z: -2 }, { x: 5, z: -9 }, { x: 8, z: -6 }, { x: -4, z: -4 }, { x: 4, z: 4 }, { x: 0, z: 7 }
        ],
        dogs: [
          {
            id: 'dog_1',
            waypoints: [{ x: -6, z: 4, waitTime: 1.0 }, { x: 0, z: 4, waitTime: 1.0 }]
          },
          {
            id: 'dog_2',
            waypoints: [{ x: 0, z: -4, waitTime: 1.0 }, { x: 6, z: -4, waitTime: 1.0 }]
          },
          {
            id: 'dog_3',
            isFastHound: true,
            waypoints: [{ x: -2, z: -2, waitTime: 0.8 }, { x: 2, z: 2, waitTime: 0.8 }]
          }
        ],
        obstacles: [
          { type: 'barn', x: 0, z: 0, width: 4, length: 4 },
          { type: 'fence', x: -5, z: -2, length: 3, rotY: 0 },
          { type: 'fence', x: 5, z: 2, length: 3, rotY: 0 },
          { type: 'tree', x: -9, z: -9 }
        ]
      },

      9: {
        index: 9,
        title: 'Уровень 9: Двойной амбар',
        subtitle: 'Два амбара создают узкий опасный коридор',
        timeTargetSec: 48,
        playerStart: { x: -10, z: 0 },
        gate: { x: 10, z: 0, rotY: Math.PI / 2 },
        grains: [
          { x: -7, z: -7 }, { x: -7, z: 7 }, { x: -3, z: 0 },
          { x: 0, z: -6 }, { x: 0, z: 6 }, { x: 0, z: 0 },
          { x: 3, z: 0 }, { x: 7, z: -7 }, { x: 7, z: 7 }, { x: 8, z: 0 }, { x: -5, z: 3 }, { x: 5, z: -3 }
        ],
        dogs: [
          {
            id: 'dog_1',
            waypoints: [{ x: -5, z: -6, waitTime: 1.0 }, { x: 5, z: -6, waitTime: 1.0 }]
          },
          {
            id: 'dog_2',
            waypoints: [{ x: 5, z: 6, waitTime: 1.0 }, { x: -5, z: 6, waitTime: 1.0 }]
          },
          {
            id: 'dog_3',
            waypoints: [{ x: 0, z: -2, waitTime: 1.2 }, { x: 0, z: 2, waitTime: 1.2 }]
          }
        ],
        obstacles: [
          { type: 'barn', x: -4, z: 0, width: 4, length: 5 },
          { type: 'barn', x: 4, z: 0, width: 4, length: 5 },
          { type: 'hay', x: 0, z: -8 },
          { type: 'hay', x: 0, z: 8 }
        ]
      },

      10: {
        index: 10,
        title: 'Уровень 10: Скоростные гончие',
        subtitle: 'Три быстрые собаки патрулируют по кругу',
        timeTargetSec: 50,
        playerStart: { x: 0, z: 10 },
        gate: { x: 0, z: -10, rotY: 0 },
        grains: [
          { x: -7, z: 7 }, { x: 7, z: 7 }, { x: -8, z: 0 },
          { x: 8, z: 0 }, { x: -7, z: -7 }, { x: 7, z: -7 },
          { x: -3, z: 3 }, { x: 3, z: 3 }, { x: -3, z: -3 },
          { x: 3, z: -3 }, { x: 0, z: 5 }, { x: 0, z: -5 }, { x: 0, z: 0 }
        ],
        dogs: [
          {
            id: 'dog_hound_1',
            isFastHound: true,
            waypoints: [
              { x: -6, z: 6, waitTime: 0.6 },
              { x: 6, z: 6, waitTime: 0.6 },
              { x: 6, z: -6, waitTime: 0.6 },
              { x: -6, z: -6, waitTime: 0.6 }
            ]
          },
          {
            id: 'dog_hound_2',
            isFastHound: true,
            waypoints: [
              { x: 6, z: -6, waitTime: 0.6 },
              { x: -6, z: -6, waitTime: 0.6 },
              { x: -6, z: 6, waitTime: 0.6 },
              { x: 6, z: 6, waitTime: 0.6 }
            ]
          },
          {
            id: 'dog_center',
            waypoints: [
              { x: -2, z: 0, waitTime: 1.0 },
              { x: 2, z: 0, waitTime: 1.0 }
            ]
          }
        ],
        obstacles: [
          { type: 'round_hay', x: -4, z: 0 },
          { type: 'round_hay', x: 4, z: 0 },
          { type: 'round_hay', x: 0, z: -4 },
          { type: 'round_hay', x: 0, z: 4 },
          { type: 'tree', x: -8, z: 8 },
          { type: 'tree', x: 8, z: -8 }
        ]
      },

      // Levels 11-15 (Advanced Mastery)
      11: {
        index: 11,
        title: 'Уровень 11: Крепость фермера',
        subtitle: '4 патруля вокруг центрального двора',
        timeTargetSec: 55,
        playerStart: { x: -10, z: -10 },
        gate: { x: 10, z: 10, rotY: 0 },
        grains: [
          { x: -8, z: -6 }, { x: -6, z: -8 }, { x: -7, z: 0 },
          { x: 0, z: -7 }, { x: -4, z: 4 }, { x: 4, z: -4 },
          { x: 0, z: 7 }, { x: 7, z: 0 }, { x: 8, z: 6 },
          { x: 6, z: 8 }, { x: -2, z: -2 }, { x: 2, z: 2 }, { x: 0, z: 0 }, { x: 5, z: 5 }
        ],
        dogs: [
          { id: 'd1', waypoints: [{ x: -6, z: -4, waitTime: 1 }, { x: -6, z: 4, waitTime: 1 }] },
          { id: 'd2', waypoints: [{ x: 6, z: 4, waitTime: 1 }, { x: 6, z: -4, waitTime: 1 }] },
          { id: 'd3', isFastHound: true, waypoints: [{ x: -4, z: 6, waitTime: 0.8 }, { x: 4, z: 6, waitTime: 0.8 }] },
          { id: 'd4', isFastHound: true, waypoints: [{ x: 4, z: -6, waitTime: 0.8 }, { x: -4, z: -6, waitTime: 0.8 }] }
        ],
        obstacles: [
          { type: 'barn', x: 0, z: 0, width: 5, length: 5 },
          { type: 'fence', x: -5, z: 0, length: 4, rotY: Math.PI / 2 },
          { type: 'fence', x: 5, z: 0, length: 4, rotY: Math.PI / 2 }
        ]
      },

      12: {
        index: 12,
        title: 'Уровень 12: Секторный патруль',
        subtitle: 'Синхронные патрули с минимальными окнами безопасности',
        timeTargetSec: 58,
        playerStart: { x: -10, z: 0 },
        gate: { x: 10, z: 0, rotY: Math.PI / 2 },
        grains: [
          { x: -8, z: -7 }, { x: -8, z: 7 }, { x: -4, z: -5 },
          { x: -4, z: 5 }, { x: -2, z: 0 }, { x: 0, z: -6 },
          { x: 0, z: 6 }, { x: 2, z: 0 }, { x: 4, z: -5 },
          { x: 4, z: 5 }, { x: 8, z: -7 }, { x: 8, z: 7 }, { x: 6, z: 0 }, { x: -6, z: 0 }, { x: 0, z: 0 }
        ],
        dogs: [
          { id: 'd1', waypoints: [{ x: -5, z: -5, waitTime: 0.9 }, { x: 0, z: -5, waitTime: 0.9 }] },
          { id: 'd2', waypoints: [{ x: 0, z: 5, waitTime: 0.9 }, { x: -5, z: 5, waitTime: 0.9 }] },
          { id: 'd3', waypoints: [{ x: 0, z: -5, waitTime: 0.9 }, { x: 5, z: -5, waitTime: 0.9 }] },
          { id: 'd4', isFastHound: true, waypoints: [{ x: 5, z: 5, waitTime: 0.9 }, { x: 0, z: 5, waitTime: 0.9 }] }
        ],
        obstacles: [
          { type: 'hay', x: -6, z: 0 },
          { type: 'hay', x: 6, z: 0 },
          { type: 'fence', x: 0, z: 0, length: 5, rotY: Math.PI / 2 },
          { type: 'round_hay', x: -3, z: 3 },
          { type: 'round_hay', x: 3, z: -3 }
        ]
      },

      13: {
        index: 13,
        title: 'Уровень 13: Большая ферма',
        subtitle: 'Просторный лабиринт с амбарами и тюками сена',
        timeTargetSec: 62,
        playerStart: { x: -11, z: 11 },
        gate: { x: 11, z: -11, rotY: 0 },
        grains: [
          { x: -9, z: 8 }, { x: -7, z: 10 }, { x: -5, z: 6 },
          { x: -8, z: 2 }, { x: -3, z: 2 }, { x: 0, z: 5 },
          { x: 3, z: 8 }, { x: 7, z: 5 }, { x: 10, z: 2 },
          { x: -5, z: -5 }, { x: -1, z: -2 }, { x: 4, z: -3 },
          { x: 8, z: -6 }, { x: 5, z: -9 }, { x: 10, z: -8 }, { x: 0, z: 0 }
        ],
        dogs: [
          { id: 'd1', isFastHound: true, waypoints: [{ x: -6, z: 5, waitTime: 0.8 }, { x: 0, z: 5, waitTime: 0.8 }] },
          { id: 'd2', waypoints: [{ x: 5, z: 4, waitTime: 1.0 }, { x: 5, z: -4, waitTime: 1.0 }] },
          { id: 'd3', waypoints: [{ x: -5, z: -5, waitTime: 1.0 }, { x: 2, z: -5, waitTime: 1.0 }] },
          { id: 'd4', isFastHound: true, waypoints: [{ x: 0, z: -2, waitTime: 0.8 }, { x: -6, z: 0, waitTime: 0.8 }] }
        ],
        obstacles: [
          { type: 'barn', x: -4, z: -2, width: 4, length: 4 },
          { type: 'barn', x: 4, z: 2, width: 4, length: 4 },
          { type: 'hay', x: -7, z: 7 },
          { type: 'hay', x: 7, z: -7 },
          { type: 'tree', x: 0, z: 8 }
        ]
      },

      14: {
        index: 14,
        title: 'Уровень 14: Безумный курятник',
        subtitle: '5 сторожевых собак на узких тропах',
        timeTargetSec: 68,
        playerStart: { x: 0, z: 11 },
        gate: { x: 0, z: -11, rotY: 0 },
        grains: [
          { x: -8, z: 8 }, { x: 8, z: 8 }, { x: -5, z: 5 },
          { x: 5, z: 5 }, { x: -9, z: 0 }, { x: 9, z: 0 },
          { x: -6, z: -4 }, { x: 6, z: -4 }, { x: -8, z: -8 },
          { x: 8, z: -8 }, { x: -2, z: 7 }, { x: 2, z: 7 },
          { x: -2, z: -7 }, { x: 2, z: -7 }, { x: 0, z: 3 }, { x: 0, z: -3 }, { x: 0, z: 0 }
        ],
        dogs: [
          { id: 'd1', isFastHound: true, waypoints: [{ x: -6, z: 6, waitTime: 0.7 }, { x: 6, z: 6, waitTime: 0.7 }] },
          { id: 'd2', isFastHound: true, waypoints: [{ x: 6, z: -6, waitTime: 0.7 }, { x: -6, z: -6, waitTime: 0.7 }] },
          { id: 'd3', waypoints: [{ x: -7, z: 0, waitTime: 1.0 }, { x: -2, z: 0, waitTime: 1.0 }] },
          { id: 'd4', waypoints: [{ x: 7, z: 0, waitTime: 1.0 }, { x: 2, z: 0, waitTime: 1.0 }] },
          { id: 'd5', waypoints: [{ x: 0, z: 2, waitTime: 1.2 }, { x: 0, z: -2, waitTime: 1.2 }] }
        ],
        obstacles: [
          { type: 'fence', x: -4, z: 3, length: 3, rotY: 0 },
          { type: 'fence', x: 4, z: 3, length: 3, rotY: 0 },
          { type: 'fence', x: -4, z: -3, length: 3, rotY: 0 },
          { type: 'fence', x: 4, z: -3, length: 3, rotY: 0 },
          { type: 'round_hay', x: -7, z: 3 },
          { type: 'round_hay', x: 7, z: -3 }
        ]
      },

      15: {
        index: 15,
        title: 'Уровень 15: Легендарный побег',
        subtitle: 'Финальное испытание: собери 18 зерен и вырвись на свободу!',
        timeTargetSec: 75,
        playerStart: { x: -11, z: 0 },
        gate: { x: 11, z: 0, rotY: Math.PI / 2 },
        grains: [
          { x: -9, z: -7 }, { x: -9, z: 7 }, { x: -6, z: -4 },
          { x: -6, z: 4 }, { x: -4, z: -8 }, { x: -4, z: 8 },
          { x: -2, z: -2 }, { x: -2, z: 2 }, { x: 0, z: -6 },
          { x: 0, z: 6 }, { x: 2, z: -2 }, { x: 2, z: 2 },
          { x: 4, z: -8 }, { x: 4, z: 8 }, { x: 6, z: -4 },
          { x: 6, z: 4 }, { x: 9, z: -7 }, { x: 9, z: 7 }
        ],
        dogs: [
          {
            id: 'boss_hound_1',
            isFastHound: true,
            waypoints: [
              { x: -6, z: 6, waitTime: 0.6 },
              { x: 6, z: 6, waitTime: 0.6 },
              { x: 6, z: -6, waitTime: 0.6 },
              { x: -6, z: -6, waitTime: 0.6 }
            ]
          },
          {
            id: 'boss_hound_2',
            isFastHound: true,
            waypoints: [
              { x: 6, z: -6, waitTime: 0.6 },
              { x: -6, z: -6, waitTime: 0.6 },
              { x: -6, z: 6, waitTime: 0.6 },
              { x: 6, z: 6, waitTime: 0.6 }
            ]
          },
          { id: 'guard_left', waypoints: [{ x: -4, z: 0, waitTime: 1.0 }, { x: -4, z: -4, waitTime: 1.0 }] },
          { id: 'guard_right', waypoints: [{ x: 4, z: 0, waitTime: 1.0 }, { x: 4, z: 4, waitTime: 1.0 }] },
          { id: 'guard_center', waypoints: [{ x: 0, z: -3, waitTime: 1.2 }, { x: 0, z: 3, waitTime: 1.2 }] }
        ],
        obstacles: [
          { type: 'barn', x: 0, z: 0, width: 4, length: 4 },
          { type: 'round_hay', x: -7, z: 0 },
          { type: 'round_hay', x: 7, z: 0 },
          { type: 'hay', x: -3, z: 5 },
          { type: 'hay', x: 3, z: -5 },
          { type: 'tree', x: -10, z: -10 },
          { type: 'tree', x: 10, z: 10 }
        ]
      }
    };

    return levels[safeLevel] || levels[1];
  }
}

export const levelManager = LevelManager.getInstance();
