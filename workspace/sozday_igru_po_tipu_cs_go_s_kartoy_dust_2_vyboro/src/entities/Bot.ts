import * as THREE from 'three';
import { proceduralModels } from '../rendering/ProceduralModels';
import { physics } from '../physics/PhysicsWorld';
import { audio } from '../audio/AudioManager';
import { particles } from '../rendering/ParticleSystem';

export type BotState = 'HOLD_ANGLE' | 'PEEK_CORNER' | 'ENGAGE_COMBAT' | 'DEFUSE_BOMB' | 'COVER_PLANT' | 'PATROL';

export class Bot {
  public readonly id: string;
  public readonly name: string;
  public readonly team: 'CT' | 'T';
  public readonly mesh: THREE.Group;

  public position = new THREE.Vector3();
  public targetPosition = new THREE.Vector3();
  public aimTarget = new THREE.Vector3();
  public velocity = new THREE.Vector3();

  public health = 100;
  public armor = 100;
  public isAlive = true;
  public state: BotState = 'HOLD_ANGLE';

  // Combat & AI parameters
  public reactionTime = 0.28; // seconds
  public targetAcquiredTimer = 0;
  public currentEnemy: { position: THREE.Vector3; isAlive: boolean; id: string } | null = null;

  public fireRate = 8; // shots / sec
  public timeSinceLastShot = 0;
  public isDefusing = false;

  private stateTimer = 0;
  private patrolWaypoints: THREE.Vector3[] = [];
  private waypointIndex = 0;

  constructor(id: string, name: string, team: 'CT' | 'T') {
    this.id = id;
    this.name = name;
    this.team = team;
    this.mesh = proceduralModels.createCharacterModel(team);
    this.mesh.userData = { botId: id, bot: this };
  }

  public reset(spawnPos: THREE.Vector3, waypoints: THREE.Vector3[] = []): void {
    this.position.copy(spawnPos);
    this.velocity.set(0, 0, 0);
    this.health = 100;
    this.armor = 100;
    this.isAlive = true;
    this.isDefusing = false;
    this.currentEnemy = null;
    this.targetAcquiredTimer = 0;
    this.state = this.team === 'CT' ? 'DEFUSE_BOMB' : 'HOLD_ANGLE';
    this.stateTimer = 0;
    this.patrolWaypoints = waypoints;
    this.waypointIndex = 0;

    this.mesh.position.copy(this.position);
    this.mesh.visible = true;
  }

  public update(
    dt: number,
    enemies: Array<{ id: string; position: THREE.Vector3; isAlive: boolean; isPlayer?: boolean }>,
    c4Position: THREE.Vector3 | null,
    onShootRaycast: (origin: THREE.Vector3, dir: THREE.Vector3, damage: number, weaponId: string, attackerBot: Bot) => void
  ): void {
    if (!this.isAlive) return;

    this.timeSinceLastShot += dt;
    this.stateTimer += dt;

    // 1. Perception: Check line of sight to nearest enemy
    const visibleEnemy = this.findVisibleEnemy(enemies);

    if (visibleEnemy) {
      if (this.currentEnemy?.id !== visibleEnemy.id) {
        this.currentEnemy = visibleEnemy;
        this.targetAcquiredTimer = 0;
      }
      this.targetAcquiredTimer += dt;
      this.state = 'ENGAGE_COMBAT';
    } else {
      this.currentEnemy = null;
      this.targetAcquiredTimer = 0;
    }

    // 2. State Machine Logic
    if (this.state === 'ENGAGE_COMBAT' && this.currentEnemy && this.currentEnemy.isAlive) {
      // Aim and Counter-Strafe Shoot
      this.aimTarget.copy(this.currentEnemy.position).add(new THREE.Vector3(0, 1.5, 0));
      this.faceTarget(this.aimTarget);

      // Stop moving to counter-strafe accurately
      this.velocity.set(0, 0, 0);

      // Fire after reaction time
      if (this.targetAcquiredTimer >= this.reactionTime && this.timeSinceLastShot >= 1 / this.fireRate) {
        this.shoot(onShootRaycast);
      }
    } else if (this.state === 'DEFUSE_BOMB' && c4Position && this.team === 'CT') {
      // Navigate towards C4
      const distToC4 = this.position.distanceTo(c4Position);
      if (distToC4 > 2.0) {
        this.moveTowards(c4Position, dt, 4.5);
      } else {
        // Start defusing C4
        this.velocity.set(0, 0, 0);
        this.isDefusing = true;
        this.aimTarget.copy(c4Position);
        this.faceTarget(this.aimTarget);
      }
    } else {
      // Patrol or Hold Angle
      if (this.patrolWaypoints.length > 0) {
        const wp = this.patrolWaypoints[this.waypointIndex];
        if (this.position.distanceTo(wp) < 1.5) {
          this.waypointIndex = (this.waypointIndex + 1) % this.patrolWaypoints.length;
        } else {
          this.moveTowards(wp, dt, 3.8);
        }
      }
    }

    // Apply movement
    const nextPos = new THREE.Vector3(
      this.position.x + this.velocity.x * dt,
      this.position.y,
      this.position.z + this.velocity.z * dt
    );
    this.position.copy(physics.resolveMovement(this.position, nextPos));
    this.mesh.position.copy(this.position);
  }

  private findVisibleEnemy(enemies: Array<{ id: string; position: THREE.Vector3; isAlive: boolean }>): { id: string; position: THREE.Vector3; isAlive: boolean } | null {
    const eyePos = new THREE.Vector3(this.position.x, this.position.y + 1.6, this.position.z);

    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;

      const dist = eyePos.distanceTo(enemy.position);
      if (dist > 35) continue;

      // Check smoke obstruction
      if (physics.isLineOfSightBlockedBySmoke(eyePos, enemy.position)) {
        continue;
      }

      // Check wall obstruction
      const dir = new THREE.Vector3().subVectors(enemy.position, eyePos).normalize();
      const hit = physics.raycastMap(eyePos, dir, dist);
      if (!hit || hit.distance >= dist - 0.5) {
        return enemy;
      }
    }
    return null;
  }

  private moveTowards(target: THREE.Vector3, dt: number, speed: number): void {
    const dir = new THREE.Vector3(target.x - this.position.x, 0, target.z - this.position.z);
    const dist = dir.length();
    if (dist > 0.1) {
      dir.normalize();
      this.velocity.x = dir.x * speed;
      this.velocity.z = dir.z * speed;
      this.faceTarget(target);
    }
  }

  private faceTarget(target: THREE.Vector3): void {
    const angle = Math.atan2(target.x - this.position.x, target.z - this.position.z);
    this.mesh.rotation.y = angle;
  }

  private shoot(onShootRaycast: (origin: THREE.Vector3, dir: THREE.Vector3, damage: number, weaponId: string, attackerBot: Bot) => void): void {
    this.timeSinceLastShot = 0;
    const weaponId = this.team === 'CT' ? 'm4a4' : 'ak47';
    audio.playGunshot(weaponId);

    const eyePos = new THREE.Vector3(this.position.x, this.position.y + 1.5, this.position.z);
    particles.spawnMuzzleFlash(eyePos);

    // Inaccuracy spread based on MMR
    const spread = 0.035;
    const dir = new THREE.Vector3().subVectors(this.aimTarget, eyePos).normalize();
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();

    onShootRaycast(eyePos, dir, weaponId === 'ak47' ? 36 : 33, weaponId, this);
  }

  public takeDamage(dmg: number): boolean {
    if (!this.isAlive) return false;

    if (this.armor > 0) {
      this.armor = Math.max(0, this.armor - dmg * 0.5);
      this.health -= dmg * 0.5;
    } else {
      this.health -= dmg;
    }

    audio.playHit();

    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.mesh.visible = false;
      return true; // Dead
    }
    return false;
  }
}
