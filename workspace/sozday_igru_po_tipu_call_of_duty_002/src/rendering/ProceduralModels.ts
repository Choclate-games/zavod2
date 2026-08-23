import * as THREE from 'three';

export class ProceduralModels {
  private static sharedMaterials: Map<string, THREE.Material> = new Map();

  private static getMaterial(color: string | number, roughness: number = 0.5, metalness: number = 0.2): THREE.MeshStandardMaterial {
    const key = `${color}_${roughness}_${metalness}`;
    if (!this.sharedMaterials.has(key)) {
      this.sharedMaterials.set(
        key,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          roughness,
          metalness
        })
      );
    }
    return this.sharedMaterials.get(key) as THREE.MeshStandardMaterial;
  }

  /**
   * Builds procedural 3D model for all 12 ladder weapons
   */
  public static createWeaponModel(weaponId: string): THREE.Group {
    const root = new THREE.Group();
    root.name = `weapon_${weaponId}`;

    const darkMetal = this.getMaterial(0x1a1f26, 0.35, 0.4);
    const gunMetal = this.getMaterial(0x2d3748, 0.4, 0.3);
    const goldMat = this.getMaterial(0xffd700, 0.25, 0.4);
    const woodMat = this.getMaterial(0x8b4513, 0.7, 0.05);
    const oliveMat = this.getMaterial(0x3e4a36, 0.6, 0.1);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x00e676 });
    const reticleMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });

    switch (weaponId) {
      case 'p99': {
        // Frame
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.14), darkMetal);
        frame.position.set(0, 0, 0);
        root.add(frame);

        // Slide
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.045, 0.18), gunMetal);
        slide.position.set(0, 0.05, -0.02);
        root.add(slide);

        // Grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.12, 0.055), darkMetal);
        grip.position.set(0, -0.08, 0.04);
        grip.rotation.x = -0.25;
        root.add(grip);

        // Reflex sight
        const sight = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.025, 0.035), darkMetal);
        sight.position.set(0, 0.08, 0.02);
        root.add(sight);

        const dot = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.006), reticleMat);
        dot.position.set(0, 0.08, 0.015);
        root.add(dot);
        break;
      }

      case 'magnum': {
        // Heavy frame & cylinder
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.08, 0.12), gunMetal);
        root.add(frame);

        const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.065, 8), darkMetal);
        cylinder.rotation.x = Math.PI / 2;
        cylinder.position.set(0, 0.01, 0.01);
        root.add(cylinder);

        // Long heavy 8-inch barrel
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.22), gunMetal);
        barrel.position.set(0, 0.03, -0.15);
        root.add(barrel);

        // Wood grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.13, 0.06), woodMat);
        grip.position.set(0, -0.09, 0.05);
        grip.rotation.x = -0.3;
        root.add(grip);
        break;
      }

      case 'spas12': {
        // Shotgun receiver
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.085, 0.28), darkMetal);
        root.add(receiver);

        // Barrel & Mag tube
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 8), gunMetal);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.025, -0.28);
        root.add(barrel);

        const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.38, 8), darkMetal);
        magTube.rotation.x = Math.PI / 2;
        magTube.position.set(0, -0.015, -0.26);
        root.add(magTube);

        // Pump handle
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 0.14), woodMat);
        pump.position.set(0, -0.015, -0.22);
        root.add(pump);

        // Folding stock
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.2), darkMetal);
        stock.position.set(0, 0.02, 0.22);
        root.add(stock);
        break;
      }

      case 'aa12': {
        // Blocky automatic shotgun body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.45), darkMetal);
        root.add(body);

        // Drum magazine
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), darkMetal);
        drum.rotation.z = Math.PI / 2;
        drum.position.set(0, -0.1, -0.02);
        root.add(drum);

        // Heavy barrel
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.25, 8), gunMetal);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.02, -0.32);
        root.add(barrel);
        break;
      }

      case 'mp5': {
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.28), darkMetal);
        root.add(receiver);

        const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.16), darkMetal);
        handguard.position.set(0, -0.005, -0.16);
        root.add(handguard);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 8), gunMetal);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.015, -0.28);
        root.add(barrel);

        const curvedMag = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.15, 0.045), gunMetal);
        curvedMag.position.set(0, -0.11, -0.04);
        curvedMag.rotation.x = 0.2;
        root.add(curvedMag);

        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.12, 0.05), darkMetal);
        grip.position.set(0, -0.08, 0.08);
        grip.rotation.x = -0.3;
        root.add(grip);
        break;
      }

      case 'p90': {
        const stockBody = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.16, 0.42), darkMetal);
        root.add(stockBody);

        const topMag = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.025, 0.25), this.getMaterial(0x4a5568, 0.2, 0.1));
        topMag.position.set(0, 0.09, -0.05);
        root.add(topMag);

        const thumbhole = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.1), darkMetal);
        thumbhole.position.set(0, -0.02, 0.08);
        root.add(thumbhole);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8), gunMetal);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.03, -0.24);
        root.add(barrel);
        break;
      }

      case 'm4a1': {
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.095, 0.26), darkMetal);
        root.add(receiver);

        const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.22), darkMetal);
        handguard.position.set(0, 0.01, -0.22);
        root.add(handguard);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.24, 8), gunMetal);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.015, -0.38);
        root.add(barrel);

        const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.065), gunMetal);
        magazine.position.set(0, -0.11, -0.06);
        magazine.rotation.x = 0.15;
        root.add(magazine);

        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.18), darkMetal);
        stock.position.set(0, -0.01, 0.22);
        root.add(stock);

        // Optic sight
        const optic = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.04, 0.1), gunMetal);
        optic.position.set(0, 0.075, -0.02);
        root.add(optic);
        break;
      }

      case 'ak47': {
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.09, 0.28), gunMetal);
        root.add(receiver);

        const woodStock = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.1, 0.22), woodMat);
        woodStock.position.set(0, -0.02, 0.24);
        woodStock.rotation.x = -0.1;
        root.add(woodStock);

        const woodGuard = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.065, 0.18), woodMat);
        woodGuard.position.set(0, 0.01, -0.21);
        root.add(woodGuard);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.28, 8), darkMetal);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.02, -0.38);
        root.add(barrel);

        const curvedMag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.18, 0.07), woodMat);
        curvedMag.position.set(0, -0.12, -0.05);
        curvedMag.rotation.x = 0.35;
        root.add(curvedMag);
        break;
      }

      case 'saw': {
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.12, 0.38), oliveMat);
        root.add(receiver);

        const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.12), oliveMat);
        ammoBox.position.set(0, -0.13, -0.02);
        root.add(ammoBox);

        const heavyBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), darkMetal);
        heavyBarrel.rotation.x = Math.PI / 2;
        heavyBarrel.position.set(0, 0.02, -0.42);
        root.add(heavyBarrel);
        break;
      }

      case 'dmr14': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.36), oliveMat);
        root.add(body);

        const longBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.45, 8), darkMetal);
        longBarrel.rotation.x = Math.PI / 2;
        longBarrel.position.set(0, 0.02, -0.45);
        root.add(longBarrel);

        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 10), darkMetal);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.075, -0.04);
        root.add(scope);
        break;
      }

      case 'awp': {
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.11, 0.45), oliveMat);
        root.add(chassis);

        const heavyBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.65, 8), darkMetal);
        heavyBarrel.rotation.x = Math.PI / 2;
        heavyBarrel.position.set(0, 0.03, -0.58);
        root.add(heavyBarrel);

        // Muzzle brake
        const brake = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.07), darkMetal);
        brake.position.set(0, 0.03, -0.92);
        root.add(brake);

        // Large high-power sniper optic
        const optic = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.28, 12), darkMetal);
        optic.rotation.x = Math.PI / 2;
        optic.position.set(0, 0.095, -0.05);
        root.add(optic);
        break;
      }

      case 'rpg7': {
        // Golden RPG Launcher Tube
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.65, 10), goldMat);
        tube.rotation.x = Math.PI / 2;
        root.add(tube);

        // Warhead cone
        const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 10), goldMat);
        warhead.rotation.x = -Math.PI / 2;
        warhead.position.set(0, 0, -0.42);
        root.add(warhead);

        const exhaust = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 10), goldMat);
        exhaust.rotation.x = Math.PI / 2;
        exhaust.position.set(0, 0, 0.38);
        root.add(exhaust);

        const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.06), darkMetal);
        trigger.position.set(0, -0.08, -0.05);
        root.add(trigger);
        break;
      }
    }

    return root;
  }

  /**
   * Creates first-person hands holding weapon
   */
  public static createFirstPersonArms(): THREE.Group {
    const arms = new THREE.Group();
    arms.name = 'fps_arms';

    const gloveMat = this.getMaterial(0x1a202c, 0.8, 0.05);
    const sleeveMat = this.getMaterial(0x2d3748, 0.9, 0.0);

    // Right Arm & Glove
    const rightArm = new THREE.Group();
    const rSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.32), sleeveMat);
    rSleeve.position.set(0.18, -0.15, 0.2);
    rSleeve.rotation.set(0.2, -0.1, 0.1);
    rightArm.add(rSleeve);

    const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.12), gloveMat);
    rGlove.position.set(0.16, -0.08, 0.05);
    rightArm.add(rGlove);
    arms.add(rightArm);

    // Left Arm & Glove (support hand)
    const leftArm = new THREE.Group();
    const lSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.35), sleeveMat);
    lSleeve.position.set(-0.2, -0.18, 0.15);
    lSleeve.rotation.set(0.4, 0.3, -0.2);
    leftArm.add(lSleeve);

    const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.12), gloveMat);
    lGlove.position.set(-0.1, -0.06, -0.12);
    lGlove.rotation.set(0.2, 0.4, 0);
    leftArm.add(lGlove);
    arms.add(leftArm);

    return arms;
  }

  /**
   * Creates 3D enemy soldier model with helmet, vest, and distinct hitboxes
   */
  public static createEnemyCharacter(camoColor: number = 0xb91c1c): THREE.Group {
    const character = new THREE.Group();
    character.name = 'enemy_character';

    const uniformMat = this.getMaterial(0x374151, 0.8, 0.05);
    const vestMat = this.getMaterial(0x1f2937, 0.7, 0.1);
    const camoMat = this.getMaterial(camoColor, 0.6, 0.1);
    const skinMat = this.getMaterial(0xd4a373, 0.8, 0.0);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    // 1. Head & Helmet (Head hitbox: y = 1.45 to 1.80)
    const headGroup = new THREE.Group();
    headGroup.name = 'head_hitbox';
    headGroup.position.set(0, 1.58, 0);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), skinMat);
    headGroup.add(headMesh);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), camoMat);
    helmet.position.set(0, 0.04, 0);
    headGroup.add(helmet);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.08), visorMat);
    visor.position.set(0, 0.02, 0.12);
    headGroup.add(visor);
    character.add(headGroup);

    // 2. Torso with tactical vest (Torso hitbox: y = 0.85 to 1.45)
    const torsoGroup = new THREE.Group();
    torsoGroup.name = 'torso_hitbox';
    torsoGroup.position.set(0, 1.15, 0);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.55, 0.24), uniformMat);
    torsoGroup.add(torso);

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.45, 0.28), vestMat);
    vest.position.set(0, 0.03, 0);
    torsoGroup.add(vest);
    character.add(torsoGroup);

    // 3. Legs & Boots (Legs hitbox: y = 0 to 0.85)
    const legsGroup = new THREE.Group();
    legsGroup.name = 'legs_hitbox';
    legsGroup.position.set(0, 0.42, 0);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.16), uniformMat);
    leftLeg.position.set(-0.11, 0, 0);
    legsGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.16), uniformMat);
    rightLeg.position.set(0.11, 0, 0);
    legsGroup.add(rightLeg);
    character.add(legsGroup);

    // Weapon in hands
    const weaponHolder = new THREE.Group();
    weaponHolder.position.set(0.18, 1.15, 0.35);
    const botWeapon = this.createWeaponModel('ak47');
    botWeapon.scale.set(0.7, 0.7, 0.7);
    weaponHolder.add(botWeapon);
    character.add(weaponHolder);

    return character;
  }
}