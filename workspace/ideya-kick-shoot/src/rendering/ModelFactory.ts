import * as THREE from 'three';
import { EnemyType, WeaponType } from '../core/Types';

export class ModelFactory {
  // Shared materials to minimize draw calls and shader recompilations
  private static playerMat = new THREE.MeshStandardMaterial({ color: 0x1a2b4c, roughness: 0.3, metalness: 0.8 });
  private static bootMat = new THREE.MeshStandardMaterial({ color: 0xff6b00, roughness: 0.2, metalness: 0.9, emissive: 0xff4400, emissiveIntensity: 0.6 });
  private static cyanGlowMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, roughness: 0.1, emissive: 0x00f0ff, emissiveIntensity: 0.8 });

  private static gruntMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4d, roughness: 0.5, metalness: 0.5 });
  private static gruntVisorMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 0.9 });

  private static shieldMat = new THREE.MeshStandardMaterial({ color: 0x00d2ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.75, emissive: 0x0088cc, emissiveIntensity: 0.5 });
  private static berserkerMat = new THREE.MeshStandardMaterial({ color: 0x5a1836, roughness: 0.4, metalness: 0.6 });
  private static spikeMat = new THREE.MeshStandardMaterial({ color: 0xb026ff, emissive: 0xb026ff, emissiveIntensity: 0.9 });

  private static bossMat = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.2, metalness: 0.9 });
  private static bossGlowMat = new THREE.MeshStandardMaterial({ color: 0xff9900, emissive: 0xff6600, emissiveIntensity: 1.2 });

  private static barrelMat = new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.4, metalness: 0.6 });
  private static barrelHazardMat = new THREE.MeshStandardMaterial({ color: 0xfdf0d5, roughness: 0.5 });

  private static doorMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.4, metalness: 0.8 });
  private static weaponMetalMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.9 });
  private static goldOverdriveMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1, emissive: 0xffaa00, emissiveIntensity: 0.7 });

  public static createPlayerMesh(): THREE.Group {
    const root = new THREE.Group();

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.45);
    const torso = new THREE.Mesh(torsoGeo, this.playerMat);
    torso.position.y = 0.95;
    torso.castShadow = true;
    root.add(torso);

    // Cyan Reactor Core on chest
    const coreGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16);
    coreGeo.rotateX(Math.PI / 2);
    const core = new THREE.Mesh(coreGeo, this.cyanGlowMat);
    core.position.set(0, 1.05, 0.23);
    root.add(core);

    // Helmet with Visor
    const helmetGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const helmet = new THREE.Mesh(helmetGeo, this.playerMat);
    helmet.position.y = 1.6;
    helmet.castShadow = true;
    root.add(helmet);

    const visorGeo = new THREE.BoxGeometry(0.38, 0.15, 0.1);
    const visor = new THREE.Mesh(visorGeo, this.cyanGlowMat);
    visor.position.set(0, 1.6, 0.22);
    root.add(visor);

    // Spartan Kick Titanium Boots (Heavy Left & Right Legs)
    const legGeo = new THREE.BoxGeometry(0.24, 0.55, 0.24);
    const leftLeg = new THREE.Mesh(legGeo, this.playerMat);
    leftLeg.position.set(-0.2, 0.4, 0);
    root.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, this.playerMat);
    rightLeg.position.set(0.2, 0.4, 0);
    root.add(rightLeg);

    // Heavy Glowing Kick Soles
    const bootGeo = new THREE.BoxGeometry(0.28, 0.25, 0.45);
    const leftBoot = new THREE.Mesh(bootGeo, this.bootMat);
    leftBoot.position.set(-0.2, 0.12, 0.08);
    leftBoot.castShadow = true;
    root.add(leftBoot);

    const rightBoot = new THREE.Mesh(bootGeo, this.bootMat);
    rightBoot.position.set(0.2, 0.12, 0.08);
    rightBoot.castShadow = true;
    root.add(rightBoot);

    // Weapon Arm & Gun
    const gunGroup = new THREE.Group();
    gunGroup.name = 'gunGroup';
    const gunBodyGeo = new THREE.BoxGeometry(0.12, 0.16, 0.5);
    const gunBody = new THREE.Mesh(gunBodyGeo, this.weaponMetalMat);
    gunBody.position.set(0.35, 1.0, 0.35);
    gunGroup.add(gunBody);
    root.add(gunGroup);

    return root;
  }

  public static createEnemyMesh(type: EnemyType): THREE.Group {
    const root = new THREE.Group();

    switch (type) {
      case EnemyType.SHIELD_SOLDIER: {
        // Body
        const bodyGeo = new THREE.BoxGeometry(0.8, 1.1, 0.5);
        const body = new THREE.Mesh(bodyGeo, this.gruntMat);
        body.position.y = 1.0;
        body.castShadow = true;
        root.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const head = new THREE.Mesh(headGeo, this.gruntMat);
        head.position.y = 1.7;
        root.add(head);

        // Massive Riot Shield
        const shieldGeo = new THREE.BoxGeometry(1.4, 1.6, 0.1);
        const shield = new THREE.Mesh(shieldGeo, this.shieldMat);
        shield.name = 'shieldMesh';
        shield.position.set(0, 1.0, 0.45);
        root.add(shield);
        break;
      }

      case EnemyType.BERSERKER: {
        // Body
        const bodyGeo = new THREE.BoxGeometry(0.75, 1.0, 0.5);
        const body = new THREE.Mesh(bodyGeo, this.berserkerMat);
        body.position.y = 0.95;
        body.castShadow = true;
        root.add(body);

        // Spikes on shoulders
        [-0.45, 0.45].forEach((x) => {
          const spikeGeo = new THREE.ConeGeometry(0.12, 0.45, 8);
          spikeGeo.rotateZ(x > 0 ? -Math.PI / 4 : Math.PI / 4);
          const spike = new THREE.Mesh(spikeGeo, this.spikeMat);
          spike.position.set(x, 1.4, 0);
          root.add(spike);
        });

        // Visor
        const visorGeo = new THREE.BoxGeometry(0.35, 0.12, 0.1);
        const visor = new THREE.Mesh(visorGeo, this.spikeMat);
        visor.position.set(0, 1.55, 0.22);
        root.add(visor);
        break;
      }

      case EnemyType.SNIPER: {
        // Floating hover drone
        const sphereGeo = new THREE.SphereGeometry(0.45, 16, 16);
        const drone = new THREE.Mesh(sphereGeo, this.gruntMat);
        drone.position.y = 1.2;
        drone.castShadow = true;
        root.add(drone);

        const laserEyeGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.2, 12);
        laserEyeGeo.rotateX(Math.PI / 2);
        const eye = new THREE.Mesh(laserEyeGeo, this.gruntVisorMat);
        eye.position.set(0, 1.2, 0.4);
        root.add(eye);
        break;
      }

      case EnemyType.BOSS_COLOSSUS: {
        // Giant Mech Frame (Scale ~2.5x)
        const frameGeo = new THREE.BoxGeometry(2.2, 2.6, 1.4);
        const frame = new THREE.Mesh(frameGeo, this.bossMat);
        frame.position.y = 2.0;
        frame.castShadow = true;
        root.add(frame);

        // Core Reactor
        const coreGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
        coreGeo.rotateX(Math.PI / 2);
        const core = new THREE.Mesh(coreGeo, this.bossGlowMat);
        core.position.set(0, 2.2, 0.7);
        root.add(core);

        // Dual Shoulder Missile Pods
        [-1.3, 1.3].forEach((x) => {
          const podGeo = new THREE.BoxGeometry(0.8, 0.8, 1.2);
          const pod = new THREE.Mesh(podGeo, this.bossMat);
          pod.position.set(x, 3.2, 0);
          root.add(pod);

          const muzzleGeo = new THREE.BoxGeometry(0.6, 0.6, 0.1);
          const muzzle = new THREE.Mesh(muzzleGeo, this.bossGlowMat);
          muzzle.position.set(x, 3.2, 0.6);
          root.add(muzzle);
        });

        // Boss Legs
        [-0.8, 0.8].forEach((x) => {
          const bLegGeo = new THREE.BoxGeometry(0.6, 1.2, 0.6);
          const bLeg = new THREE.Mesh(bLegGeo, this.bossMat);
          bLeg.position.set(x, 0.6, 0);
          root.add(bLeg);
        });
        break;
      }

      case EnemyType.GRUNT:
      default: {
        // Standard Guard
        const bodyGeo = new THREE.BoxGeometry(0.65, 0.9, 0.4);
        const body = new THREE.Mesh(bodyGeo, this.gruntMat);
        body.position.y = 0.9;
        body.castShadow = true;
        root.add(body);

        const headGeo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
        const head = new THREE.Mesh(headGeo, this.gruntMat);
        head.position.y = 1.5;
        root.add(head);

        const visorGeo = new THREE.BoxGeometry(0.3, 0.1, 0.08);
        const visor = new THREE.Mesh(visorGeo, this.gruntVisorMat);
        visor.position.set(0, 1.5, 0.18);
        root.add(visor);
        break;
      }
    }

    return root;
  }

  public static createBarrelMesh(): THREE.Group {
    const group = new THREE.Group();

    const barrelGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.2, 16);
    const barrel = new THREE.Mesh(barrelGeo, this.barrelMat);
    barrel.position.y = 0.6;
    barrel.castShadow = true;
    group.add(barrel);

    const stripeGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.25, 16);
    const stripe = new THREE.Mesh(stripeGeo, this.barrelHazardMat);
    stripe.position.y = 0.6;
    group.add(stripe);

    return group;
  }

  public static createDoorMesh(): THREE.Group {
    const group = new THREE.Group();

    const frameGeo = new THREE.BoxGeometry(3.6, 3.2, 0.35);
    const door = new THREE.Mesh(frameGeo, this.doorMat);
    door.position.y = 1.6;
    door.castShadow = true;
    group.add(door);

    const lightGeo = new THREE.BoxGeometry(3.2, 0.1, 0.38);
    const light = new THREE.Mesh(lightGeo, this.cyanGlowMat);
    light.position.set(0, 2.8, 0);
    group.add(light);

    return group;
  }

  public static createWeaponPickupMesh(type: WeaponType): THREE.Group {
    const group = new THREE.Group();

    const gunGeo = new THREE.BoxGeometry(0.2, 0.25, 0.8);
    const mesh = new THREE.Mesh(gunGeo, this.goldOverdriveMat);
    mesh.castShadow = true;
    group.add(mesh);

    return group;
  }

  public static createShardMesh(type: 'plasma' | 'ammo' | 'health'): THREE.Mesh {
    const geo = new THREE.OctahedronGeometry(0.22);
    let mat: THREE.Material;

    if (type === 'plasma') {
      mat = this.cyanGlowMat;
    } else if (type === 'ammo') {
      mat = this.goldOverdriveMat;
    } else {
      mat = this.gruntVisorMat;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }
}
