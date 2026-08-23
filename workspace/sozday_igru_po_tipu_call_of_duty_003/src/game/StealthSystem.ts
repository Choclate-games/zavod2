import * as THREE from 'three';
import { BALANCE } from '../core/Constants';
import { EventBus, AlarmState } from '../core/EventBus';

export type AIBehavior = 'UNAWARE' | 'SUSPICIOUS' | 'PANIC_SPRINT' | 'INSPECTION' | 'DEAD';

export interface EnemyUnit {
  id: string;
  isVIP: boolean;
  name: string;
  position: THREE.Vector3;
  mesh: THREE.Group;
  health: number;
  maxHealth: number;
  behavior: AIBehavior;
  suspicionTimer: number; // 0 to 1.80s
  panicTimer: number; // 5.00s countdown
  inspectionTimer: number; // 8.00s
  patrolPoints: THREE.Vector3[];
  currentPatrolIdx: number;
  speed: number;
  isHeadshotKilled: boolean;
  isAccidentKilled: boolean;
}

export class StealthSystem {
  public enemies: EnemyUnit[] = [];
  public alarmState: AlarmState = 'CLEAR';
  public globalAlarmTimer = 0.0;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public spawnEnemies(): void {
    this.clear();

    // Spawn VIP 1: Base Commander
    this.createEnemy('vip_commander', true, 'Командир Гарнизона', new THREE.Vector3(-20, 0, 15), [
      new THREE.Vector3(-20, 0, 15),
      new THREE.Vector3(-10, 0, 20),
      new THREE.Vector3(-25, 0, 25)
    ]);

    // Spawn VIP 2: Chief Comms Officer
    this.createEnemy('vip_officer', true, 'Офицер Связи', new THREE.Vector3(15, 0, 20), [
      new THREE.Vector3(15, 0, 20),
      new THREE.Vector3(25, 0, 15),
      new THREE.Vector3(10, 0, 10)
    ]);

    // Spawn Guard 1: Tower Sniper
    this.createEnemy('guard_sniper_west', false, 'Контрснайпер Вышки', new THREE.Vector3(-40, 26, 10), []);

    // Spawn Guard 2: Courtyard Sentry
    this.createEnemy('guard_courtyard', false, 'Часовой Периметра', new THREE.Vector3(0, 0, 40), [
      new THREE.Vector3(0, 0, 40),
      new THREE.Vector3(20, 0, 35),
      new THREE.Vector3(-15, 0, 35)
    ]);
  }

  private createEnemy(
    id: string,
    isVIP: boolean,
    name: string,
    startPos: THREE.Vector3,
    patrolPoints: THREE.Vector3[]
  ): EnemyUnit {
    const group = new THREE.Group();
    group.position.copy(startPos);

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.8, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isVIP ? 0x9a3412 : 0x334155, // Camo colors
      roughness: 0.8
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.9;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Head (Headshot hitbox)
    const headGeo = new THREE.SphereGeometry(0.24, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.6 });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.y = 1.95;
    headMesh.castShadow = true;
    group.add(headMesh);

    // VIP distinction or helmet
    if (isVIP) {
      const beretGeo = new THREE.CylinderGeometry(0.28, 0.24, 0.1, 8);
      const beretMat = new THREE.MeshStandardMaterial({ color: 0x991b1b });
      const beret = new THREE.Mesh(beretGeo, beretMat);
      beret.position.y = 2.1;
      group.add(beret);
    }

    this.scene.add(group);

    const enemy: EnemyUnit = {
      id,
      isVIP,
      name,
      position: group.position,
      mesh: group,
      health: 100,
      maxHealth: 100,
      behavior: 'UNAWARE',
      suspicionTimer: 0,
      panicTimer: BALANCE.panic_sprint_timer, // 5.00 s
      inspectionTimer: 0,
      patrolPoints,
      currentPatrolIdx: 0,
      speed: 1.4,
      isHeadshotKilled: false,
      isAccidentKilled: false
    };

    this.enemies.push(enemy);
    return enemy;
  }

  public update(dt: number): void {
    let hasPanicking = false;
    let hasSuspicious = false;

    for (const enemy of this.enemies) {
      if (enemy.behavior === 'DEAD') continue;

      // Patrol movement
      if (enemy.behavior === 'UNAWARE' && enemy.patrolPoints.length > 0) {
        const target = enemy.patrolPoints[enemy.currentPatrolIdx];
        const dist = enemy.position.distanceTo(target);

        if (dist < 0.5) {
          enemy.currentPatrolIdx = (enemy.currentPatrolIdx + 1) % enemy.patrolPoints.length;
        } else {
          const dir = target.clone().sub(enemy.position).normalize();
          enemy.position.add(dir.multiplyScalar(enemy.speed * dt));
          enemy.mesh.lookAt(target.x, enemy.mesh.position.y, target.z);
        }
      } else if (enemy.behavior === 'PANIC_SPRINT') {
        hasPanicking = true;
        enemy.panicTimer -= dt;
        // Sprint to alarm switch at bunker
        const alarmTarget = new THREE.Vector3(0, 0, -20);
        const dir = alarmTarget.clone().sub(enemy.position).normalize();
        enemy.position.add(dir.multiplyScalar(BALANCE.panic_sprint_speed * dt)); // 5.20 m/s
        enemy.mesh.lookAt(alarmTarget.x, enemy.mesh.position.y, alarmTarget.z);

        if (enemy.panicTimer <= 0) {
          this.triggerBaseAlarm();
        }
      } else if (enemy.behavior === 'SUSPICIOUS') {
        hasSuspicious = true;
        enemy.suspicionTimer += dt;
        if (enemy.suspicionTimer >= BALANCE.suspicion_fill_time) { // 1.80 s
          enemy.behavior = 'PANIC_SPRINT';
          enemy.panicTimer = BALANCE.panic_sprint_timer; // 5.00 s
        }
      } else if (enemy.behavior === 'INSPECTION') {
        enemy.inspectionTimer -= dt;
        if (enemy.inspectionTimer <= 0) {
          enemy.behavior = 'UNAWARE';
        }
      }
    }

    if (this.alarmState !== 'TRIGGERED') {
      if (hasPanicking) {
        this.alarmState = 'PANIC';
      } else if (hasSuspicious) {
        this.alarmState = 'SUSPICIOUS';
      } else {
        this.alarmState = 'CLEAR';
      }
    }

    EventBus.emit('ALARM_STATE_CHANGED', this.alarmState);
  }

  public triggerSuspicionNear(pos: THREE.Vector3, radius: number): void {
    for (const enemy of this.enemies) {
      if (enemy.behavior === 'DEAD' || enemy.behavior === 'PANIC_SPRINT') continue;
      if (enemy.position.distanceTo(pos) <= radius) {
        enemy.behavior = 'SUSPICIOUS';
        enemy.suspicionTimer = 0;
      }
    }
  }

  public triggerInspectionNear(pos: THREE.Vector3, radius = 15.0): void {
    for (const enemy of this.enemies) {
      if (enemy.behavior === 'DEAD' || enemy.behavior === 'PANIC_SPRINT') continue;
      if (enemy.position.distanceTo(pos) <= radius) {
        enemy.behavior = 'INSPECTION';
        enemy.inspectionTimer = BALANCE.guard_inspection_duration; // 8.00 s
      }
    }
  }

  public triggerBaseAlarm(): void {
    this.alarmState = 'TRIGGERED';
    EventBus.emit('ALARM_STATE_CHANGED', 'TRIGGERED');
  }

  public clear(): void {
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.mesh);
    }
    this.enemies = [];
    this.alarmState = 'CLEAR';
  }
}
