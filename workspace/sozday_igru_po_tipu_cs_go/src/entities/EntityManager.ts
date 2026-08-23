import * as THREE from 'three';
import { Player } from './Player';
import { ProceduralModels } from '../rendering/ProceduralModels';

export class BotEnemy {
  public root: THREE.Group;
  public helmet: THREE.Mesh;
  public headGroup: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, -6);
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public yaw: number = Math.PI;
  public health: number = 100;
  public isAlive: boolean = true;
  public hasHelmet: boolean = true;

  constructor() {
    const soldier = ProceduralModels.createSoldierBot();
    this.root = soldier.root;
    this.helmet = soldier.helmet;
    this.headGroup = soldier.headGroup;
    this.root.position.copy(this.position);
  }

  public reset(spawnPos: THREE.Vector3, spawnYaw: number): void {
    this.position.copy(spawnPos);
    this.yaw = spawnYaw;
    this.health = 100;
    this.isAlive = true;
    this.hasHelmet = true;
    this.helmet.visible = true;
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
    this.velocity.set(0, 0, 0);
  }

  public knockoffHelmet(): void {
    if (this.hasHelmet) {
      this.hasHelmet = false;
      this.helmet.visible = false;
    }
  }

  public update(dt: number): void {
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
  }
}

export class EntityManager {
  private static instance: EntityManager;
  public player: Player;
  public bot: BotEnemy;

  public static get(): EntityManager {
    if (!EntityManager.instance) {
      EntityManager.instance = new EntityManager();
    }
    return EntityManager.instance;
  }

  constructor() {
    this.player = new Player();
    this.bot = new BotEnemy();
  }

  public update(dt: number): void {
    this.player.update(dt);
    this.bot.update(dt);
  }
}