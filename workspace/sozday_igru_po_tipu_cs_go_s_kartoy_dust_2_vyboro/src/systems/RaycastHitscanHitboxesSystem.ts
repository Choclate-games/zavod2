import * as THREE from 'three';
import { physics, RayHit } from '../physics/PhysicsWorld';
import { particles } from '../rendering/ParticleSystem';
import { audio } from '../audio/AudioManager';
import { Bot } from '../entities/Bot';
import { Player } from '../entities/Player';

export interface HitscanResult {
  hitTarget: boolean;
  victimName?: string;
  victimTeam?: 'CT' | 'T';
  isHeadshot: boolean;
  isWallbang: boolean;
  damageDealt: number;
  killed: boolean;
}

export class RaycastHitscanHitboxesSystem {
  private static instance: RaycastHitscanHitboxesSystem;

  private constructor() {}

  public static getInstance(): RaycastHitscanHitboxesSystem {
    if (!RaycastHitscanHitboxesSystem.instance) {
      RaycastHitscanHitboxesSystem.instance = new RaycastHitscanHitboxesSystem();
    }
    return RaycastHitscanHitboxesSystem.instance;
  }

  public processShot(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    baseDamage: number,
    weaponId: string,
    attackerTeam: 'CT' | 'T',
    attackerName: string,
    player: Player,
    bots: Bot[],
    onKill: (killerName: string, killerTeam: 'CT' | 'T', victimName: string, victimTeam: 'CT' | 'T', weapon: string, isHeadshot: boolean, isWallbang: boolean) => void
  ): HitscanResult {
    let currentOrigin = origin.clone();
    let currentDamage = baseDamage;
    let isWallbang = false;
    const maxPenetrations = 2;

    for (let p = 0; p < maxPenetrations; p++) {
      // 1. Raycast against map colliders
      const mapHit = physics.raycastMap(currentOrigin, direction, 80);
      const maxDist = mapHit ? mapHit.distance : 80;

      // 2. Raycast against target entities within maxDist
      let closestEntityHit: { entity: Player | Bot; hitboxType: 'head' | 'chest' | 'stomach' | 'legs'; distance: number; hitPos: THREE.Vector3 } | null = null;
      let closestDist = maxDist;

      // Check player if attacker is bot
      if (attackerTeam !== player.team && player.isAlive) {
        const pDist = currentOrigin.distanceTo(player.position);
        if (pDist < closestDist) {
          const hit = this.checkEntityHitbox(currentOrigin, direction, player.position);
          if (hit && hit.dist < closestDist) {
            closestDist = hit.dist;
            closestEntityHit = { entity: player, hitboxType: hit.hitbox, distance: hit.dist, hitPos: hit.pos };
          }
        }
      }

      // Check bots
      for (const bot of bots) {
        if (bot.team !== attackerTeam && bot.isAlive) {
          const bDist = currentOrigin.distanceTo(bot.position);
          if (bDist < closestDist) {
            const hit = this.checkEntityHitbox(currentOrigin, direction, bot.position);
            if (hit && hit.dist < closestDist) {
              closestDist = hit.dist;
              closestEntityHit = { entity: bot, hitboxType: hit.hitbox, distance: hit.dist, hitPos: hit.pos };
            }
          }
        }
      }

      // 3. Process Entity Hit
      if (closestEntityHit) {
        particles.spawnTracer(currentOrigin, closestEntityHit.hitPos);

        const isHeadshot = closestEntityHit.hitboxType === 'head';
        let damageMultiplier = 1.0;
        if (isHeadshot) {
          damageMultiplier = weaponId === 'awp' ? 4.0 : 4.0; // 1-tap headshot
          audio.playHeadshot();
        } else if (closestEntityHit.hitboxType === 'stomach') {
          damageMultiplier = 1.25;
        } else if (closestEntityHit.hitboxType === 'legs') {
          damageMultiplier = 0.75;
        }

        const finalDamage = currentDamage * damageMultiplier;
        const killed = closestEntityHit.entity.takeDamage(finalDamage);

        const victimName = closestEntityHit.entity === player ? 'Игрок' : (closestEntityHit.entity as Bot).name;
        const victimTeam = closestEntityHit.entity.team;

        if (isWallbang) {
          audio.playWallbangHit();
        }

        if (killed) {
          onKill(attackerName, attackerTeam, victimName, victimTeam, weaponId, isHeadshot, isWallbang);
        }

        return {
          hitTarget: true,
          victimName,
          victimTeam,
          isHeadshot,
          isWallbang,
          damageDealt: finalDamage,
          killed,
        };
      }

      // 4. Process Map Hit & Wallbang penetration
      if (mapHit) {
        particles.spawnTracer(currentOrigin, mapHit.point);
        const col = mapHit.collider;

        if (col && col.isPenetrable && currentDamage > 10) {
          // Penetrable surface
          isWallbang = true;
          particles.spawnImpactSparks(mapHit.point, mapHit.normal, col.material === 'wood');

          // Damage drop
          const retention = col.material === 'wood' ? 0.6 : 0.3;
          currentDamage *= retention;

          // Advance origin past the surface thickness
          currentOrigin = mapHit.point.clone().addScaledVector(direction, col.thicknessMeters + 0.1);
        } else {
          // Hard concrete stop
          particles.spawnImpactSparks(mapHit.point, mapHit.normal, false);
          break;
        }
      } else {
        // Traveled into air
        particles.spawnTracer(currentOrigin, currentOrigin.clone().addScaledVector(direction, 60));
        break;
      }
    }

    return { hitTarget: false, isHeadshot: false, isWallbang: false, damageDealt: 0, killed: false };
  }

  private checkEntityHitbox(origin: THREE.Vector3, dir: THREE.Vector3, entityPos: THREE.Vector3): { dist: number; hitbox: 'head' | 'chest' | 'stomach' | 'legs'; pos: THREE.Vector3 } | null {
    const ray = new THREE.Ray(origin, dir.clone().normalize());

    // Head Sphere (center at y + 1.62, radius 0.22)
    const headCenter = new THREE.Vector3(entityPos.x, entityPos.y + 1.62, entityPos.z);
    const headSphere = new THREE.Sphere(headCenter, 0.22);
    const headHitPos = new THREE.Vector3();
    if (ray.intersectSphere(headSphere, headHitPos)) {
      return { dist: origin.distanceTo(headHitPos), hitbox: 'head', pos: headHitPos };
    }

    // Body Box (Chest + Stomach: y + 0.9 to 1.5, size 0.5 x 0.6 x 0.4)
    const bodyBox = new THREE.Box3(
      new THREE.Vector3(entityPos.x - 0.26, entityPos.y + 0.8, entityPos.z - 0.22),
      new THREE.Vector3(entityPos.x + 0.26, entityPos.y + 1.48, entityPos.z + 0.22)
    );
    const bodyHitPos = new THREE.Vector3();
    if (ray.intersectBox(bodyBox, bodyHitPos)) {
      const isChest = bodyHitPos.y > entityPos.y + 1.15;
      return { dist: origin.distanceTo(bodyHitPos), hitbox: isChest ? 'chest' : 'stomach', pos: bodyHitPos };
    }

    // Legs Box (y + 0 to 0.8)
    const legsBox = new THREE.Box3(
      new THREE.Vector3(entityPos.x - 0.22, entityPos.y, entityPos.z - 0.22),
      new THREE.Vector3(entityPos.x + 0.22, entityPos.y + 0.8, entityPos.z + 0.22)
    );
    const legsHitPos = new THREE.Vector3();
    if (ray.intersectBox(legsBox, legsHitPos)) {
      return { dist: origin.distanceTo(legsHitPos), hitbox: 'legs', pos: legsHitPos };
    }

    return null;
  }
}

export const hitscanSystem = RaycastHitscanHitboxesSystem.getInstance();
