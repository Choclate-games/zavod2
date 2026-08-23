import * as THREE from 'three';
import { GAME_BALANCE } from '../config/balance';
import { physicsWorld } from '../physics/PhysicsWorld';
import { sceneManager } from '../rendering/SceneManager';
import { ProceduralModels } from '../rendering/ProceduralModels';
import { particleSystem } from '../rendering/ParticleSystem';
import { audioManager } from '../audio/AudioManager';

export type EnemyState = 'PATROL' | 'HUNT' | 'ATTACK' | 'COVER' | 'SLIDE' | 'DEAD';

export class Enemy {
  public id: string;
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public health: number = 100;
  public isAlive: boolean = true;
  public state: EnemyState = 'PATROL';

  public mesh: THREE.Group;
  private patrolTarget: THREE.Vector3 = new THREE.Vector3();
  private reactionTimer: number = 0;
  private shootCooldown: number = 0;
  private respawnTimer: number = 0;
  private deathFallAngle: number = 0;

  // Stencil / Outline material for UAV Overlord wallhack
  private highlightMesh: THREE.Mesh | null = null;

  constructor(id: string, camoColor: number = 0x991b1b) {
    this.id = id;
    this.mesh = ProceduralModels.createEnemyCharacter(camoColor);
    sceneManager.scene.add(this.mesh);

    // Outline sphere for UAV wallhack
    const highlightGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.8, 8);
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0xff1744,
      wireframe: true,
      transparent: true,
      opacity: GAME_BALANCE.wallhack_outline_alpha
    });
    this.highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    this.highlightMesh.position.set(0, 0.9, 0);
    this.highlightMesh.visible = false;
    this.mesh.add(this.highlightMesh);
  }

  public spawn(pos: THREE.Vector3): void {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.health = 100;
    this.isAlive = true;
    this.state = 'PATROL';
    this.mesh.visible = true;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
    this.pickNewPatrolTarget();
    this.reactionTimer = GAME_BALANCE.bot_reaction_delay_min + Math.random() * (GAME_BALANCE.bot_reaction_delay_max - GAME_BALANCE.bot_reaction_delay_min);
  }

  public pickNewPatrolTarget(): void {
    this.patrolTarget.set(
      (Math.random() - 0.5) * 45,
      0,
      (Math.random() - 0.5) * 45
    );
  }

  public checkHit(rayOrigin: THREE.Vector3, rayDir: THREE.Vector3, maxDist: number): { hit: boolean; distance: number; isHeadshot: boolean } {
    if (!this.isAlive) return { hit: false, distance: maxDist, isHeadshot: false };

    // Bounding cylinders/spheres test
    const toCenter = new THREE.Vector3().subVectors(this.position.clone().setY(this.position.y + 0.9), rayOrigin);
    const proj = toCenter.dot(rayDir);
    if (proj < 0 || proj > maxDist) return { hit: false, distance: maxDist, isHeadshot: false };

    const closestPoint = rayOrigin.clone().addScaledVector(rayDir, proj);
    const distToAxis = closestPoint.distanceTo(this.position.clone().setY(closestPoint.y));

    if (distToAxis < 0.45 && closestPoint.y >= this.position.y && closestPoint.y <= this.position.y + 1.85) {
      const hitHeight = closestPoint.y - this.position.y;
      const isHeadshot = hitHeight >= 1.45; // Head zone: 1.45m to 1.85m
      return { hit: true, distance: proj, isHeadshot };
    }

    return { hit: false, distance: maxDist, isHeadshot: false };
  }

  public takeDamage(amount: number, isHeadshot: boolean): boolean {
    if (!this.isAlive) return false;
    this.health -= amount;

    if (this.health <= 0) {
      this.isAlive = false;
      this.state = 'DEAD';
      this.respawnTimer = GAME_BALANCE.respawn_delay; // 1.0s respawn delay
      this.deathFallAngle = 0;
      return true; // Killed
    }
    return false;
  }

  public onHearGunshot(soundPos: THREE.Vector3): void {
    if (!this.isAlive) return;
    if (this.position.distanceTo(soundPos) <= GAME_BALANCE.bot_hearing_radius) {
      this.patrolTarget.copy(soundPos);
      this.state = 'HUNT';
    }
  }

  public update(playerPos: THREE.Vector3, isUavActive: boolean, dt: number, onShootPlayer: (damage: number) => void): void {
    // UAV Highlight visibility
    if (this.highlightMesh) {
      this.highlightMesh.visible = isUavActive && this.isAlive;
    }

    if (!this.isAlive) {
      // Death animation & respawn timer
      this.respawnTimer -= dt;
      if (this.deathFallAngle < Math.PI / 2) {
        this.deathFallAngle += dt * 8.0;
        this.mesh.rotation.x = this.deathFallAngle;
        this.mesh.position.y = Math.max(0.1, this.position.y - (this.deathFallAngle / (Math.PI / 2)) * 0.4);
      }
      return;
    }

    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const distToPlayer = this.position.distanceTo(playerPos);
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.position).setY(0);

    // Line of sight raycast
    const eyePos = this.position.clone().setY(this.position.y + 1.5);
    const dirToPlayer = new THREE.Vector3().subVectors(playerPos.clone().setY(playerPos.y + 1.5), eyePos).normalize();
    const hit = physicsWorld.raycast(eyePos, dirToPlayer, distToPlayer);
    const hasLineOfSight = !hit.hit || hit.distance >= distToPlayer - 0.5;

    // FSM State transitions
    if (hasLineOfSight && distToPlayer < 35) {
      this.state = distToPlayer < 12 ? 'ATTACK' : 'HUNT';
    } else if (this.state === 'ATTACK') {
      this.state = 'HUNT';
    }

    switch (this.state) {
      case 'PATROL': {
        const toTarget = new THREE.Vector3().subVectors(this.patrolTarget, this.position).setY(0);
        if (toTarget.lengthSq() < 2.0) {
          this.pickNewPatrolTarget();
        } else {
          toTarget.normalize();
          this.velocity.x = toTarget.x * 3.5;
          this.velocity.z = toTarget.z * 3.5;
          this.mesh.rotation.y = Math.atan2(toTarget.x, toTarget.z);
        }
        break;
      }

      case 'HUNT': {
        toPlayer.normalize();
        this.velocity.x = toPlayer.x * 5.5;
        this.velocity.z = toPlayer.z * 5.5;
        this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
        break;
      }

      case 'ATTACK': {
        toPlayer.normalize();
        this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

        // Strafe jiggle to dodge shots
        const strafeDir = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
        const strafeSpeed = (Math.sin(performance.now() * 0.005) > 0 ? 1 : -1) * GAME_BALANCE.bot_strafe_speed;
        this.velocity.x = strafeDir.x * strafeSpeed;
        this.velocity.z = strafeDir.z * strafeSpeed;

        if (this.reactionTimer > 0) {
          this.reactionTimer -= dt;
        } else if (this.shootCooldown <= 0 && hasLineOfSight) {
          this.shootCooldown = 0.25 + Math.random() * 0.35;
          audioManager.playShoot('ak47');
          particleSystem.emitMuzzleFlash(eyePos.clone().addScaledVector(dirToPlayer, 0.6), dirToPlayer);

          // Shoot player with inaccuracy
          const accuracy = Math.max(0.2, 0.7 - distToPlayer * 0.02);
          if (Math.random() < accuracy) {
            onShootPlayer(12 + Math.floor(Math.random() * 8));
          }
        }
        break;
      }
    }

    // Physics step
    physicsWorld.moveCharacter(this.position, this.velocity, 0.4, 1.8, dt);
    this.mesh.position.copy(this.position);
  }
}