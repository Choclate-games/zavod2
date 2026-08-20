import * as THREE from 'three';
import { EnemyType, WeaponType } from '../types';

export class ProceduralModels {
  // Shared materials to optimize draw calls and avoid allocations
  private static bootLeatherMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, roughness: 0.8, metalness: 0.1 });
  private static bootSteelMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.3, metalness: 0.8 });
  private static bootAccentMat = new THREE.MeshStandardMaterial({ color: 0xe07a5f, roughness: 0.5, metalness: 0.4 });
  private static soleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.0 });

  private static gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.4, metalness: 0.8 });
  private static gunAccentMat = new THREE.MeshStandardMaterial({ color: 0xf2cc8f, roughness: 0.3, metalness: 0.6 });
  private static woodGripMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7, metalness: 0.0 });

  private static enemyBodyMat = new THREE.MeshStandardMaterial({ color: 0x3d405b, roughness: 0.6, metalness: 0.2 });
  private static enemyArmorMat = new THREE.MeshStandardMaterial({ color: 0xe07a5f, roughness: 0.4, metalness: 0.5 });
  private static enemyEyeMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff1111, roughness: 0.2 });
  private static shieldMat = new THREE.MeshStandardMaterial({ color: 0x4c9f70, roughness: 0.3, metalness: 0.7 });

  private static barrelRedMat = new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.5, metalness: 0.3 });
  private static barrelStripeMat = new THREE.MeshStandardMaterial({ color: 0xfca311, roughness: 0.4, metalness: 0.2 });

  private static doorWoodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8, metalness: 0.1 });
  private static doorMetalMat = new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.4, metalness: 0.8 });

  /** Creates the FPS kicker boot rig attached to the player's viewmodel */
  public static createPlayerBootMesh(): THREE.Group {
    const group = new THREE.Group();

    // Shin/Leg
    const legGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.65, 8);
    const legMesh = new THREE.Mesh(legGeo, this.bootLeatherMat);
    legMesh.position.set(0, 0.4, 0);
    legMesh.rotation.x = 0.2;
    group.add(legMesh);

    // Shin Guard Armor Plate
    const plateGeo = new THREE.BoxGeometry(0.16, 0.45, 0.08);
    const plateMesh = new THREE.Mesh(plateGeo, this.bootAccentMat);
    plateMesh.position.set(0, 0.42, 0.1);
    plateMesh.rotation.x = 0.2;
    group.add(plateMesh);

    // Boot Foot / Main Body
    const footGeo = new THREE.BoxGeometry(0.2, 0.16, 0.4);
    const footMesh = new THREE.Mesh(footGeo, this.bootLeatherMat);
    footMesh.position.set(0, 0.08, 0.12);
    group.add(footMesh);

    // Steel Toe Cap
    const toeGeo = new THREE.BoxGeometry(0.22, 0.14, 0.14);
    const toeMesh = new THREE.Mesh(toeGeo, this.bootSteelMat);
    toeMesh.position.set(0, 0.07, 0.27);
    group.add(toeMesh);

    // Heavy Tread Sole
    const soleGeo = new THREE.BoxGeometry(0.24, 0.06, 0.44);
    const soleMesh = new THREE.Mesh(soleGeo, this.soleMat);
    soleMesh.position.set(0, -0.02, 0.12);
    group.add(soleMesh);

    // Gold Buckles
    for (let y of [0.25, 0.4, 0.55]) {
      const buckleGeo = new THREE.BoxGeometry(0.18, 0.04, 0.06);
      const buckle = new THREE.Mesh(buckleGeo, this.bootSteelMat);
      buckle.position.set(0, y, 0.12);
      group.add(buckle);
    }

    group.castShadow = true;
    return group;
  }

  /** Creates first-person weapon model held in hands */
  public static createWeaponViewmodel(type: WeaponType): THREE.Group {
    const group = new THREE.Group();

    if (type === 'SHOTGUN') {
      // Twin-barrel Shotgun
      const barrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 8), this.gunMetalMat);
      barrel1.rotation.x = Math.PI / 2;
      barrel1.position.set(-0.04, 0, 0.4);
      group.add(barrel1);

      const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 8), this.gunMetalMat);
      barrel2.rotation.x = Math.PI / 2;
      barrel2.position.set(0.04, 0, 0.4);
      group.add(barrel2);

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.35), this.gunMetalMat);
      body.position.set(0, -0.02, 0.05);
      group.add(body);

      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.4), this.woodGripMat);
      stock.position.set(0, -0.06, -0.28);
      group.add(stock);

      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.25), this.woodGripMat);
      pump.position.set(0, -0.04, 0.35);
      group.add(pump);
    } else if (type === 'SMG') {
      // Tactical Submachine Gun
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.45), this.gunMetalMat);
      group.add(receiver);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8), this.gunMetalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, 0.35);
      group.add(barrel);

      const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.08), this.gunAccentMat);
      magazine.position.set(0, -0.16, 0.1);
      group.add(magazine);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.08), this.bootLeatherMat);
      grip.position.set(0, -0.12, -0.12);
      grip.rotation.x = -0.2;
      group.add(grip);
    } else {
      // PISTOL / Heavy Revolver
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.38), this.gunMetalMat);
      barrel.position.set(0, 0.04, 0.2);
      group.add(barrel);

      const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), this.gunAccentMat);
      cylinder.rotation.x = Math.PI / 2;
      cylinder.position.set(0, 0.03, 0.02);
      group.add(cylinder);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.09), this.woodGripMat);
      grip.position.set(0, -0.1, -0.08);
      grip.rotation.x = -0.25;
      group.add(grip);
    }

    return group;
  }

  /** Creates World Drops & Airborne Flying Weapons with Golden aura */
  public static createWeaponWorldMesh(type: WeaponType): THREE.Group {
    const group = this.createWeaponViewmodel(type);
    group.scale.set(1.2, 1.2, 1.2);

    // Glowing Golden Ring / Aura
    const ringGeo = new THREE.TorusGeometry(0.45, 0.03, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.name = 'glowRing';
    group.add(ring);

    return group;
  }

  /** Creates stylised low-poly enemies */
  public static createEnemyMesh(type: EnemyType): THREE.Group {
    const group = new THREE.Group();

    if (type === 'BOSS_MECH') {
      // 3.5m Heavy Mech Titan
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.2), this.enemyArmorMat);
      torso.position.set(0, 2.2, 0);
      group.add(torso);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), this.enemyEyeMat);
      eye.position.set(0, 2.3, 0.6);
      group.add(eye);

      // Cannons
      const cannonL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.8, 8), this.gunMetalMat);
      cannonL.rotation.x = Math.PI / 2;
      cannonL.position.set(-1.1, 2.2, 0.6);
      group.add(cannonL);

      const cannonR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.8, 8), this.gunMetalMat);
      cannonR.rotation.x = Math.PI / 2;
      cannonR.position.set(1.1, 2.2, 0.6);
      group.add(cannonR);

      // Legs
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.5, 0.55), this.enemyBodyMat);
      legL.position.set(-0.6, 0.75, 0);
      group.add(legL);

      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.5, 0.55), this.enemyBodyMat);
      legR.position.set(0.6, 0.75, 0);
      group.add(legR);
    } else {
      // Humanoid silhouette (Grunt, Gunner, Shielder, Kamikaze)
      // Torso
      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.75, 0.35),
        type === 'KAMIKAZE' ? this.barrelRedMat : this.enemyBodyMat
      );
      torso.position.set(0, 1.25, 0);
      group.add(torso);

      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.35), this.enemyArmorMat);
      head.position.set(0, 1.85, 0);
      group.add(head);

      // Eyes / Visor
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.1), this.enemyEyeMat);
      visor.position.set(0, 1.88, 0.16);
      group.add(visor);

      // Legs
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.25), this.bootLeatherMat);
      legL.position.set(-0.18, 0.42, 0);
      group.add(legL);

      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.25), this.bootLeatherMat);
      legR.position.set(0.18, 0.42, 0);
      group.add(legR);

      if (type === 'SHIELDER') {
        // Large Riot Shield
        const shield = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.3, 0.1), this.shieldMat);
        shield.position.set(0.35, 1.25, 0.45);
        shield.name = 'riotShield';
        group.add(shield);
      } else if (type === 'GUNNER') {
        // Gun in hands
        const gun = this.createWeaponViewmodel('SMG');
        gun.scale.set(0.8, 0.8, 0.8);
        gun.position.set(0.3, 1.2, 0.35);
        gun.name = 'heldGun';
        group.add(gun);
      } else if (type === 'KAMIKAZE') {
        // Bomb Canister
        const bomb = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 8), this.barrelStripeMat);
        bomb.position.set(0, 1.25, 0.22);
        group.add(bomb);
      }
    }

    group.castShadow = true;
    return group;
  }

  /** Breachable Tactical Door */
  public static createDoorMesh(): THREE.Group {
    const group = new THREE.Group();

    // Door Slab
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.2, 0.18), this.doorWoodMat);
    slab.position.set(0, 1.6, 0);
    slab.castShadow = true;
    group.add(slab);

    // Metal Cross Bracing & Bolts
    const brace1 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.22), this.doorMetalMat);
    brace1.position.set(0, 0.8, 0);
    group.add(brace1);

    const brace2 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.22), this.doorMetalMat);
    brace2.position.set(0, 2.4, 0);
    group.add(brace2);

    // Handle
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.12), this.gunAccentMat);
    handle.position.set(0.75, 1.5, 0.12);
    group.add(handle);

    return group;
  }

  /** Explosive Red Barrel */
  public static createExplosiveBarrelMesh(): THREE.Group {
    const group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 12), this.barrelRedMat);
    body.position.set(0, 0.6, 0);
    body.castShadow = true;
    group.add(body);

    const ring1 = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 12), this.barrelStripeMat);
    ring1.position.set(0, 0.35, 0);
    group.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 12), this.barrelStripeMat);
    ring2.position.set(0, 0.85, 0);
    group.add(ring2);

    return group;
  }
}
