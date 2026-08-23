import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { EntityManager } from '../entities/EntityManager';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { AudioManager } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';

export interface ShotResult {
  hit: boolean;
  hitTarget: 'head' | 'body' | 'wall' | 'none';
  damage: number;
  isHeadshot: boolean;
  isWallbang: boolean;
  hitPosition: THREE.Vector3;
}

export class RaycastBvhBallisticsEngineSystem {
  public static readonly R_HEAD_HITBOX = 0.11; // Head hitbox radius (m)
  public static readonly DMG_HEADSHOT = 140; // Desert Eagle Headshot damage (HP)
  public static readonly DMG_BODY = 35; // Desert Eagle Body damage (HP)
  public static readonly P_HELMET_IMPULSE = 18.5; // Helmet detachment physics impulse (kg*m/s)
  public static readonly K_WALLBANG = 0.65; // Wallbang penetration coefficient (65% damage)
  public static readonly D_MAX_PENETRATION = 0.20; // Max penetrable wall thickness (m)
  public static readonly T_SLOWMO = 0.35; // Triumph slow-mo duration (s)

  public static fireRaycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    spreadDeg: number,
    isPlayerShooter: boolean
  ): ShotResult {
    // Apply spread perturbation
    const spreadRad = THREE.MathUtils.degToRad(spreadDeg);
    const perturbedDir = direction.clone();
    if (spreadRad > 0.001) {
      const u = (Math.random() - 0.5) * 2;
      const v = (Math.random() - 0.5) * 2;
      perturbedDir.x += u * Math.sin(spreadRad);
      perturbedDir.y += v * Math.sin(spreadRad);
      perturbedDir.normalize();
    }

    const ray = new THREE.Ray(origin, perturbedDir);
    const maxDistance = 60.0;
    let endPos = origin.clone().addScaledVector(perturbedDir, maxDistance);
    let wallPenetrated = false;
    let damageMultiplier = 1.0;

    // 1. Check obstacles in PhysicsWorld
    for (const col of PhysicsWorld.get().colliders) {
      const intersectPoint = new THREE.Vector3();
      if (ray.intersectBox(col.box, intersectPoint)) {
        const dist = origin.distanceTo(intersectPoint);
        if (dist < origin.distanceTo(endPos)) {
          if (col.isPenetrable) {
            wallPenetrated = true;
            damageMultiplier = col.penetrationRatio || RaycastBvhBallisticsEngineSystem.K_WALLBANG;
          } else {
            endPos.copy(intersectPoint);
          }
        }
      }
    }

    const entities = EntityManager.get();
    const target = isPlayerShooter ? entities.bot : entities.player;

    if (!target.isAlive) {
      ParticleSystem.get().spawnTracer(origin, endPos);
      return { hit: false, hitTarget: 'none', damage: 0, isHeadshot: false, isWallbang: false, hitPosition: endPos };
    }

    // 2. Head Hitbox Check (Sphere r = 0.11 at y_head_level = 1.65)
    const headCenter = target.position.clone().setY(1.65);
    const headSphere = new THREE.Sphere(headCenter, RaycastBvhBallisticsEngineSystem.R_HEAD_HITBOX);
    const headHitPoint = new THREE.Vector3();

    if (ray.intersectSphere(headSphere, headHitPoint)) {
      const headDist = origin.distanceTo(headHitPoint);
      if (headDist < origin.distanceTo(endPos)) {
        endPos.copy(headHitPoint);
        const finalDmg = Math.floor(RaycastBvhBallisticsEngineSystem.DMG_HEADSHOT * damageMultiplier);
        
        // Spawn sparks & launch flying helmet
        ParticleSystem.get().spawnSparks(headHitPoint, 25);
        ParticleSystem.get().spawnFlyingHelmet(headHitPoint, RaycastBvhBallisticsEngineSystem.P_HELMET_IMPULSE);
        ParticleSystem.get().spawnTracer(origin, endPos);

        AudioManager.get().playHelmetClink();

        if (isPlayerShooter) {
          entities.bot.knockoffHelmet();
          entities.bot.health -= finalDmg;
          if (entities.bot.health <= 0) {
            entities.bot.isAlive = false;
          }
        } else {
          entities.player.health -= finalDmg;
          if (entities.player.health <= 0) {
            entities.player.isAlive = false;
          }
        }

        EventBus.get().emit('HEADSHOT_TRIGGERED', {
          position: { x: headHitPoint.x, y: headHitPoint.y, z: headHitPoint.z },
          impulse: RaycastBvhBallisticsEngineSystem.P_HELMET_IMPULSE
        });

        return {
          hit: true,
          hitTarget: 'head',
          damage: finalDmg,
          isHeadshot: true,
          isWallbang: wallPenetrated,
          hitPosition: headHitPoint
        };
      }
    }

    // 3. Body Hitbox Check (AABB 0.48 x 0.70 x 0.30)
    const bodyBox = new THREE.Box3(
      new THREE.Vector3(target.position.x - 0.24, target.position.y + 0.6, target.position.z - 0.2),
      new THREE.Vector3(target.position.x + 0.24, target.position.y + 1.4, target.position.z + 0.2)
    );
    const bodyHitPoint = new THREE.Vector3();

    if (ray.intersectBox(bodyBox, bodyHitPoint)) {
      const bodyDist = origin.distanceTo(bodyHitPoint);
      if (bodyDist < origin.distanceTo(endPos)) {
        endPos.copy(bodyHitPoint);
        const finalDmg = Math.floor(RaycastBvhBallisticsEngineSystem.DMG_BODY * damageMultiplier);

        ParticleSystem.get().spawnTracer(origin, endPos);

        if (isPlayerShooter) {
          entities.bot.health -= finalDmg;
          if (entities.bot.health <= 0) {
            entities.bot.isAlive = false;
          }
        } else {
          entities.player.health -= finalDmg;
          if (entities.player.health <= 0) {
            entities.player.isAlive = false;
          }
        }

        return {
          hit: true,
          hitTarget: 'body',
          damage: finalDmg,
          isHeadshot: false,
          isWallbang: wallPenetrated,
          hitPosition: bodyHitPoint
        };
      }
    }

    // Missed or hit wall
    ParticleSystem.get().spawnTracer(origin, endPos);
    return {
      hit: false,
      hitTarget: 'wall',
      damage: 0,
      isHeadshot: false,
      isWallbang: wallPenetrated,
      hitPosition: endPos
    };
  }
}