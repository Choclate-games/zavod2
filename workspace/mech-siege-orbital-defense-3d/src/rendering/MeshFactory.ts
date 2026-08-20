// src/rendering/MeshFactory.ts
// Procedural high-tech 3D geometries and materials (Industrial Realism: Steel & Soot)

import * as THREE from 'three';

export class MeshFactory {
  // Shared materials for memory efficiency
  public static materials = {
    metalDark: new THREE.MeshStandardMaterial({
      color: 0x1f2630,
      roughness: 0.5,
      metalness: 0.8,
    }),
    metalSteel: new THREE.MeshStandardMaterial({
      color: 0x5a6978,
      roughness: 0.4,
      metalness: 0.7,
    }),
    metalArmor: new THREE.MeshStandardMaterial({
      color: 0x3b4856,
      roughness: 0.6,
      metalness: 0.6,
    }),
    cautionStripe: new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      roughness: 0.5,
      metalness: 0.3,
    }),
    enemyChitin: new THREE.MeshStandardMaterial({
      color: 0x2b1820,
      roughness: 0.7,
      metalness: 0.2,
    }),
    enemyArmor: new THREE.MeshStandardMaterial({
      color: 0x591e26,
      roughness: 0.5,
      metalness: 0.6,
    }),
    glowCyan: new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
    }),
    glowOrange: new THREE.MeshBasicMaterial({
      color: 0xff7700,
    }),
    glowRed: new THREE.MeshBasicMaterial({
      color: 0xff1e1e,
    }),
    glowGreen: new THREE.MeshBasicMaterial({
      color: 0x00ff66,
    }),
    forcefield: new THREE.MeshBasicMaterial({
      color: 0x00b4d8,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  };

  /**
   * Builds player's Combat Mech with independent torso rotation rig
   */
  public static createPlayerMech(): {
    root: THREE.Group;
    torso: THREE.Group;
    leftGun: THREE.Mesh;
    rightGun: THREE.Mesh;
    thrusterGlow: THREE.Mesh;
  } {
    const root = new THREE.Group();

    // Chassis / Legs base
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.6), MeshFactory.materials.metalDark);
    hips.position.y = 0.6;
    root.add(hips);

    // Left & Right legs
    const legGeo = new THREE.BoxGeometry(0.3, 0.7, 0.4);
    const footGeo = new THREE.BoxGeometry(0.4, 0.2, 0.6);

    const leftLeg = new THREE.Mesh(legGeo, MeshFactory.materials.metalSteel);
    leftLeg.position.set(-0.45, 0.35, 0);
    const leftFoot = new THREE.Mesh(footGeo, MeshFactory.materials.metalDark);
    leftFoot.position.set(-0.45, 0.1, 0.1);
    root.add(leftLeg, leftFoot);

    const rightLeg = new THREE.Mesh(legGeo, MeshFactory.materials.metalSteel);
    rightLeg.position.set(0.45, 0.35, 0);
    const rightFoot = new THREE.Mesh(footGeo, MeshFactory.materials.metalDark);
    rightFoot.position.set(0.45, 0.1, 0.1);
    root.add(rightLeg, rightFoot);

    // Torso Group (independent rotation)
    const torso = new THREE.Group();
    torso.position.y = 0.9;

    // Main cockpit / armored chest
    const chestGeo = new THREE.BoxGeometry(1.1, 0.9, 0.9);
    const chest = new THREE.Mesh(chestGeo, MeshFactory.materials.metalArmor);
    chest.position.y = 0.4;
    chest.castShadow = true;
    torso.add(chest);

    // Visor / Cockpit glow
    const visorGeo = new THREE.BoxGeometry(0.7, 0.2, 0.15);
    const visor = new THREE.Mesh(visorGeo, MeshFactory.materials.glowCyan);
    visor.position.set(0, 0.55, 0.46);
    torso.add(visor);

    // Reactor Core on back
    const reactorGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8);
    const reactor = new THREE.Mesh(reactorGeo, MeshFactory.materials.glowOrange);
    reactor.rotation.x = Math.PI / 2;
    reactor.position.set(0, 0.4, -0.48);
    torso.add(reactor);

    // Thruster nozzles
    const thrusterGeo = new THREE.CylinderGeometry(0.12, 0.18, 0.3, 8);
    const thrusterLeft = new THREE.Mesh(thrusterGeo, MeshFactory.materials.metalDark);
    thrusterLeft.position.set(-0.35, 0.25, -0.5);
    thrusterLeft.rotation.x = -Math.PI / 6;
    const thrusterRight = thrusterLeft.clone();
    thrusterRight.position.x = 0.35;
    torso.add(thrusterLeft, thrusterRight);

    const thrusterGlowGeo = new THREE.ConeGeometry(0.12, 0.4, 8);
    const thrusterGlow = new THREE.Mesh(thrusterGlowGeo, MeshFactory.materials.glowCyan);
    thrusterGlow.position.set(0, 0.25, -0.65);
    thrusterGlow.rotation.x = -Math.PI / 2;
    torso.add(thrusterGlow);

    // Weapon Arms (Autocannons / Lasers)
    const gunGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.0, 8);
    gunGeo.rotateX(Math.PI / 2);

    const leftGun = new THREE.Mesh(gunGeo, MeshFactory.materials.metalSteel);
    leftGun.position.set(-0.75, 0.35, 0.4);
    leftGun.castShadow = true;

    const rightGun = new THREE.Mesh(gunGeo, MeshFactory.materials.metalSteel);
    rightGun.position.set(0.75, 0.35, 0.4);
    rightGun.castShadow = true;

    // Shoulder Pauldrons
    const shoulderGeo = new THREE.BoxGeometry(0.35, 0.35, 0.5);
    const shoulderLeft = new THREE.Mesh(shoulderGeo, MeshFactory.materials.cautionStripe);
    shoulderLeft.position.set(-0.75, 0.65, 0);
    const shoulderRight = new THREE.Mesh(shoulderGeo, MeshFactory.materials.cautionStripe);
    shoulderRight.position.set(0.75, 0.65, 0);

    torso.add(leftGun, rightGun, shoulderLeft, shoulderRight);
    root.add(torso);

    return { root, torso, leftGun, rightGun, thrusterGlow };
  }

  /**
   * Central Orbital Base Reactor Core
   */
  public static createBaseCore(): {
    root: THREE.Group;
    rings: THREE.Mesh[];
    shieldDome: THREE.Mesh;
    coreSphere: THREE.Mesh;
  } {
    const root = new THREE.Group();

    // Base foundation
    const foundationGeo = new THREE.CylinderGeometry(3.5, 4.2, 0.8, 16);
    const foundation = new THREE.Mesh(foundationGeo, MeshFactory.materials.metalDark);
    foundation.position.y = 0.4;
    foundation.receiveShadow = true;
    root.add(foundation);

    // 4 Support Pylons
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const pylonGeo = new THREE.BoxGeometry(0.8, 2.8, 0.8);
      const pylon = new THREE.Mesh(pylonGeo, MeshFactory.materials.metalSteel);
      pylon.position.set(Math.cos(angle) * 2.8, 1.4, Math.sin(angle) * 2.8);
      pylon.castShadow = true;
      root.add(pylon);
    }

    // Glowing Core Reactor Sphere
    const coreGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const coreSphere = new THREE.Mesh(coreGeo, MeshFactory.materials.glowCyan);
    coreSphere.position.y = 2.0;
    root.add(coreSphere);

    // Rotating Energy Containment Rings
    const rings: THREE.Mesh[] = [];
    const ring1Geo = new THREE.TorusGeometry(1.8, 0.08, 8, 24);
    const ring1 = new THREE.Mesh(ring1Geo, MeshFactory.materials.glowOrange);
    ring1.position.y = 2.0;
    root.add(ring1);
    rings.push(ring1);

    const ring2Geo = new THREE.TorusGeometry(2.2, 0.08, 8, 24);
    const ring2 = new THREE.Mesh(ring2Geo, MeshFactory.materials.glowCyan);
    ring2.position.y = 2.0;
    root.add(ring2);
    rings.push(ring2);

    // Translucent Forcefield Dome
    const domeGeo = new THREE.SphereGeometry(4.8, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const shieldDome = new THREE.Mesh(domeGeo, MeshFactory.materials.forcefield);
    shieldDome.position.y = 0;
    root.add(shieldDome);

    return { root, rings, shieldDome, coreSphere };
  }

  /**
   * Enemy Types: Swarmer, Spitter, Breacher, Boss
   */
  public static createEnemyMesh(type: 'swarmer' | 'spitter' | 'breacher' | 'boss'): THREE.Group {
    const group = new THREE.Group();

    if (type === 'swarmer') {
      // Fast skittering bug-bot
      const bodyGeo = new THREE.SphereGeometry(0.5, 8, 8);
      const body = new THREE.Mesh(bodyGeo, MeshFactory.materials.enemyChitin);
      body.position.y = 0.5;
      body.scale.set(0.9, 0.6, 1.2);
      body.castShadow = true;

      const eyeGeo = new THREE.SphereGeometry(0.12, 6, 6);
      const eye = new THREE.Mesh(eyeGeo, MeshFactory.materials.glowRed);
      eye.position.set(0, 0.6, 0.5);

      group.add(body, eye);
    } else if (type === 'spitter') {
      // Tall tripod walker
      const bodyGeo = new THREE.ConeGeometry(0.6, 1.2, 6);
      const body = new THREE.Mesh(bodyGeo, MeshFactory.materials.enemyChitin);
      body.position.y = 1.0;
      body.rotation.x = Math.PI;

      const cannonGeo = new THREE.CylinderGeometry(0.15, 0.25, 0.8, 6);
      cannonGeo.rotateX(Math.PI / 2);
      const cannon = new THREE.Mesh(cannonGeo, MeshFactory.materials.glowGreen);
      cannon.position.set(0, 1.2, 0.4);

      group.add(body, cannon);
    } else if (type === 'breacher') {
      // Armored heavy ramming tank
      const bodyGeo = new THREE.BoxGeometry(1.4, 0.9, 1.8);
      const body = new THREE.Mesh(bodyGeo, MeshFactory.materials.enemyArmor);
      body.position.y = 0.6;
      body.castShadow = true;

      // Heavy front plow shield
      const shieldGeo = new THREE.BoxGeometry(1.6, 0.8, 0.3);
      const shield = new THREE.Mesh(shieldGeo, MeshFactory.materials.metalDark);
      shield.position.set(0, 0.5, 0.95);

      const eyeGeo = new THREE.BoxGeometry(0.8, 0.15, 0.1);
      const eye = new THREE.Mesh(eyeGeo, MeshFactory.materials.glowOrange);
      eye.position.set(0, 0.7, 0.96);

      group.add(body, shield, eye);
    } else if (type === 'boss') {
      // Massive Titan Destroyer Boss
      const bodyGeo = new THREE.BoxGeometry(3.2, 2.0, 3.6);
      const body = new THREE.Mesh(bodyGeo, MeshFactory.materials.enemyArmor);
      body.position.y = 2.0;
      body.castShadow = true;

      const headGeo = new THREE.BoxGeometry(1.6, 1.0, 1.8);
      const head = new THREE.Mesh(headGeo, MeshFactory.materials.metalDark);
      head.position.set(0, 3.2, 0.8);

      const visorGeo = new THREE.BoxGeometry(1.2, 0.25, 0.1);
      const visor = new THREE.Mesh(visorGeo, MeshFactory.materials.glowRed);
      visor.position.set(0, 3.2, 1.75);

      // Heavy Cannons Left and Right
      const cannonGeo = new THREE.CylinderGeometry(0.3, 0.4, 2.4, 8);
      cannonGeo.rotateX(Math.PI / 2);
      const leftCannon = new THREE.Mesh(cannonGeo, MeshFactory.materials.metalSteel);
      leftCannon.position.set(-2.0, 2.2, 1.2);
      const rightCannon = leftCannon.clone();
      rightCannon.position.x = 2.0;

      group.add(body, head, visor, leftCannon, rightCannon);
    }

    return group;
  }

  /**
   * Defense Turrets (Gatling, Tesla, Shield, Repair)
   */
  public static createTurretMesh(type: string): { root: THREE.Group; head: THREE.Group } {
    const root = new THREE.Group();
    const head = new THREE.Group();
    head.position.y = 0.8;

    // Base Tripod
    const baseGeo = new THREE.CylinderGeometry(0.6, 0.9, 0.4, 8);
    const base = new THREE.Mesh(baseGeo, MeshFactory.materials.metalDark);
    base.position.y = 0.2;
    base.castShadow = true;
    root.add(base);

    if (type === 'gatling') {
      const mountGeo = new THREE.BoxGeometry(0.6, 0.5, 0.6);
      const mount = new THREE.Mesh(mountGeo, MeshFactory.materials.metalSteel);
      mount.position.y = 0.2;

      const barrelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.9, 8);
      barrelGeo.rotateX(Math.PI / 2);
      const b1 = new THREE.Mesh(barrelGeo, MeshFactory.materials.metalArmor);
      b1.position.set(-0.15, 0.2, 0.45);
      const b2 = new THREE.Mesh(barrelGeo, MeshFactory.materials.metalArmor);
      b2.position.set(0.15, 0.2, 0.45);

      head.add(mount, b1, b2);
    } else if (type === 'tesla') {
      const pylonGeo = new THREE.CylinderGeometry(0.15, 0.3, 1.2, 8);
      const pylon = new THREE.Mesh(pylonGeo, MeshFactory.materials.metalSteel);
      pylon.position.y = 0.6;

      const orbGeo = new THREE.SphereGeometry(0.35, 12, 12);
      const orb = new THREE.Mesh(orbGeo, MeshFactory.materials.glowCyan);
      orb.position.y = 1.3;

      head.add(pylon, orb);
    } else if (type === 'shield') {
      const generatorGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
      const generator = new THREE.Mesh(generatorGeo, MeshFactory.materials.cautionStripe);
      generator.position.y = 0.4;

      const emitterGeo = new THREE.TorusGeometry(0.4, 0.08, 8, 16);
      emitterGeo.rotateX(Math.PI / 2);
      const emitter = new THREE.Mesh(emitterGeo, MeshFactory.materials.glowCyan);
      emitter.position.y = 0.9;

      head.add(generator, emitter);
    } else {
      // Repair Drone Hub
      const hubGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.6, 8);
      const hub = new THREE.Mesh(hubGeo, MeshFactory.materials.metalSteel);
      hub.position.y = 0.3;

      const crossGeo = new THREE.BoxGeometry(0.4, 0.4, 0.1);
      const cross = new THREE.Mesh(crossGeo, MeshFactory.materials.glowGreen);
      cross.position.set(0, 0.8, 0);

      head.add(hub, cross);
    }

    root.add(head);
    return { root, head };
  }

  /**
   * Scrap Resource Item Drop (Gears)
   */
  public static createScrapMesh(): THREE.Mesh {
    const geo = new THREE.TorusGeometry(0.25, 0.08, 6, 12);
    const mesh = new THREE.Mesh(geo, MeshFactory.materials.cautionStripe);
    mesh.position.y = 0.3;
    return mesh;
  }

  /**
   * Arena Ground and Environment Grid
   */
  public static createArenaEnvironment(): THREE.Group {
    const env = new THREE.Group();

    // Main dark metal floor
    const floorGeo = new THREE.PlaneGeometry(64, 64, 32, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x121720,
      roughness: 0.8,
      metalness: 0.3,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    env.add(floor);

    // Glowing grid lines
    const gridHelper = new THREE.GridHelper(64, 32, 0xff8c00, 0x1f2c3d);
    gridHelper.position.y = 0.02;
    env.add(gridHelper);

    // Landing Ring & Markings
    const ringGeo = new THREE.RingGeometry(12, 12.3, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff8c00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    env.add(ring);

    return env;
  }
}
