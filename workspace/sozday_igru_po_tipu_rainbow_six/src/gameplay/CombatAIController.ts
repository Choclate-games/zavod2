import * as THREE from "three";
import { EventBus } from "../core/EventBus";
import { VFXPool } from "../renderer/VFXPool";
import { ProceduralMeshFactory } from "./../renderer/ProceduralMeshFactory";
import { ShieldController } from "./ShieldController";
import type { EnemySpawnData, EnemyState } from "../core/Types";

export interface ActiveEnemy {
  data: EnemySpawnData;
  meshRoot: THREE.Group;
  headNode: THREE.Group;
  chestNode: THREE.Group;
  weaponNode: THREE.Group;
  laserBeam: THREE.Mesh | null;
  state: EnemyState;
  hp: number;
  maxHp: number;
  hasArmor: boolean;
  stunTimer: number;
  aimTimer: number;
  fireCooldown: number;
  deathTimer: number;
}

export class CombatAIController {
  private eventBus: EventBus;
  private scene: THREE.Scene;
  private vfx: VFXPool;
  private shieldController: ShieldController;

  public enemies: ActiveEnemy[] = [];

  constructor(
    eventBus: EventBus,
    scene: THREE.Scene,
    vfx: VFXPool,
    shieldController: ShieldController
  ) {
    this.eventBus = eventBus;
    this.scene = scene;
    this.vfx = vfx;
    this.shieldController = shieldController;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.eventBus.on("breach:detonated", (payload) => {
      const blastPos = payload.position;
      const radius = payload.explosive.blastRadius;
      const stunDur = payload.explosive.stunDuration;

      this.enemies.forEach((enemy) => {
        if (enemy.state === "neutralized") return;

        const enemyPos = enemy.meshRoot.position;
        const dx = enemyPos.x - blastPos.x;
        const dz = enemyPos.z - blastPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= radius) {
          // Lethal blast kill
          this.killEnemy(enemy, false, true);
        } else if (dist <= radius + 2.5) {
          // Concussion Stun
          enemy.state = "stunned";
          enemy.stunTimer = Math.max(1.5, stunDur * (1.0 - (dist - radius) / 2.5));
          if (enemy.laserBeam) enemy.laserBeam.visible = false;
        } else {
          // Alerted
          enemy.state = "alerted";
          enemy.aimTimer = 0.8;
        }
      });
    });
  }

  spawnEnemies(spawnList: EnemySpawnData[]): void {
    this.cleanup();

    spawnList.forEach((data) => {
      const { root, headNode, chestNode, weaponNode } = ProceduralMeshFactory.createEnemyMesh(
        data.type,
        data.hasArmor
      );

      root.position.set(data.x, data.y, data.z);
      root.rotation.y = data.rotY;
      this.scene.add(root);

      const laser = (weaponNode.getObjectByName("EnemyLaserBeam") as THREE.Mesh) || null;

      this.enemies.push({
        data,
        meshRoot: root,
        headNode,
        chestNode,
        weaponNode,
        laserBeam: laser,
        state: "guarding",
        hp: data.hasArmor ? 120 : 80,
        maxHp: data.hasArmor ? 120 : 80,
        hasArmor: data.hasArmor,
        stunTimer: 0,
        aimTimer: 0.9,
        fireCooldown: 0.3,
        deathTimer: 0,
      });
    });
  }

  update(
    scaledDt: number,
    realDt: number,
    playerPos: THREE.Vector3,
    isLeaning: boolean,
    isShieldHold: boolean
  ): void {
    this.enemies.forEach((enemy) => {
      if (enemy.state === "neutralized") {
        // Death collapse animation
        if (enemy.deathTimer < 1.0) {
          enemy.deathTimer += realDt * 2.5;
          enemy.meshRoot.rotation.x = Math.min(Math.PI / 2, enemy.meshRoot.rotation.x + realDt * 3.5);
          enemy.meshRoot.position.y = Math.max(0.15, enemy.meshRoot.position.y - realDt * 1.5);
        }
        return;
      }

      if (enemy.state === "stunned") {
        enemy.stunTimer -= scaledDt;
        // Stun wobble
        enemy.meshRoot.rotation.z = Math.sin(enemy.stunTimer * 12) * 0.15;
        if (enemy.stunTimer <= 0) {
          enemy.state = "alerted";
          enemy.meshRoot.rotation.z = 0;
          enemy.aimTimer = 0.6;
        }
        return;
      }

      // Rotate enemy chest/gun towards player
      const enemyWorldPos = enemy.meshRoot.position;
      const toPlayer = new THREE.Vector3().subVectors(playerPos, enemyWorldPos).setY(0).normalize();
      const targetAngle = Math.atan2(toPlayer.x, toPlayer.z);

      enemy.meshRoot.rotation.y += (targetAngle - enemy.meshRoot.rotation.y) * Math.min(1.0, 6.0 * scaledDt);

      if (enemy.state === "alerted" || enemy.state === "shooting") {
        if (enemy.laserBeam) enemy.laserBeam.visible = true;

        if (enemy.aimTimer > 0) {
          enemy.aimTimer -= scaledDt;
        } else {
          // Open fire on player
          enemy.state = "shooting";
          enemy.fireCooldown -= scaledDt;

          if (enemy.fireCooldown <= 0) {
            enemy.fireCooldown = 0.35 + Math.random() * 0.4;
            this.enemyFireAtPlayer(enemy, playerPos, isLeaning, isShieldHold);
          }
        }
      }
    });
  }

  private enemyFireAtPlayer(
    enemy: ActiveEnemy,
    playerPos: THREE.Vector3,
    isLeaning: boolean,
    isShieldHold: boolean
  ): void {
    const muzzlePos = new THREE.Vector3();
    enemy.weaponNode.getWorldPosition(muzzlePos);

    // Target player chest/head
    const target = playerPos.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.15,
      (Math.random() - 0.5) * 0.15,
      (Math.random() - 0.5) * 0.15
    ));

    // Spawn tracer & muzzle flash
    this.vfx.spawnTracer(muzzlePos, target);
    this.vfx.triggerMuzzleFlash(muzzlePos);

    // Process bullet impact on shield or player
    const isShieldArea = !isLeaning || isShieldHold || Math.random() < 0.65;
    const bulletDamage = enemy.hasArmor ? 30 : 20;

    const result = this.shieldController.processIncomingBullet(
      bulletDamage,
      isLeaning,
      { x: target.x, y: target.y, z: target.z },
      isShieldArea
    );

    if (result.blocked) {
      this.vfx.spawnSparks(
        { x: target.x, y: target.y, z: target.z },
        { x: 0, y: 0, z: -1 },
        8
      );
    } else {
      // Player damaged
      this.vfx.spawnBloodSparks({ x: target.x, y: target.y, z: target.z });
      this.eventBus.emit("player:damaged", {
        damage: result.damageDealt,
        currentHp: 100,
        sourcePosition: { x: enemy.meshRoot.position.x, y: enemy.meshRoot.position.y, z: enemy.meshRoot.position.z },
      });
    }
  }

  checkRaycastHit(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    damage: number,
    _headshotMult: number
  ): { hit: boolean; enemyId?: string; killed?: boolean; isHeadshot?: boolean } {
    const ray = new THREE.Ray(origin, dir);

    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (enemy.state === "neutralized") continue;

      // 1. Check Head Sphere Hitbox (y ~ 1.55)
      const headWorldPos = new THREE.Vector3();
      enemy.headNode.getWorldPosition(headWorldPos);
      const headSphere = new THREE.Sphere(headWorldPos, 0.2);

      if (ray.intersectsSphere(headSphere)) {
        // INSTANT HEADSHOT KILL!
        this.vfx.spawnBloodSparks(headWorldPos);
        this.killEnemy(enemy, true, false);
        return { hit: true, enemyId: enemy.data.id, killed: true, isHeadshot: true };
      }

      // 2. Check Torso Box Hitbox
      const chestWorldPos = new THREE.Vector3();
      enemy.chestNode.getWorldPosition(chestWorldPos);
      const chestBox = new THREE.Box3().setFromCenterAndSize(
        chestWorldPos,
        new THREE.Vector3(0.5, 1.2, 0.4)
      );

      if (ray.intersectsBox(chestBox)) {
        this.vfx.spawnBloodSparks(chestWorldPos);
        enemy.hp -= damage;
        const killed = enemy.hp <= 0;

        if (killed) {
          this.killEnemy(enemy, false, false);
        } else {
          enemy.state = "alerted";
        }

        this.eventBus.emit("enemy:hit", {
          enemyId: enemy.data.id,
          damage,
          isHeadshot: false,
          position: { x: chestWorldPos.x, y: chestWorldPos.y, z: chestWorldPos.z },
          killed,
        });

        return { hit: true, enemyId: enemy.data.id, killed, isHeadshot: false };
      }
    }

    return { hit: false };
  }

  private killEnemy(enemy: ActiveEnemy, isHeadshot: boolean, isBreachKill: boolean): void {
    if (enemy.state === "neutralized") return;
    enemy.state = "neutralized";
    enemy.hp = 0;
    if (enemy.laserBeam) enemy.laserBeam.visible = false;

    this.eventBus.emit("enemy:killed", {
      enemyId: enemy.data.id,
      isHeadshot,
      isBreachKill,
    });
  }

  areAllEnemiesNeutralized(): boolean {
    return this.enemies.length > 0 && this.enemies.every((e) => e.state === "neutralized");
  }

  cleanup(): void {
    this.enemies.forEach((e) => {
      this.scene.remove(e.meshRoot);
    });
    this.enemies = [];
  }
}
