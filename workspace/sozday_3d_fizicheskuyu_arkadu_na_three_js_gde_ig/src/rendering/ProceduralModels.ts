/**
 * ProceduralModels: Procedural 3D Low-poly Geometries and Materials for Metro-Balancer.
 * Creates stylistically authentic 1980s retro metro carriage, courier character, and diverse cargo items.
 */

import * as THREE from 'three';

export class ProceduralModels {
  // Shared materials for minimal draw calls
  private static materials = {
    carriageFloor: new THREE.MeshStandardMaterial({ color: 0x543A26, roughness: 0.8, metalness: 0.1 }), // Linoleum
    carriageWall: new THREE.MeshStandardMaterial({ color: 0xD8CBB0, roughness: 0.6, metalness: 0.1 }), // Cream wall
    carriageRoof: new THREE.MeshStandardMaterial({ color: 0xC4B89D, roughness: 0.7, metalness: 0.05 }),
    seatFabric: new THREE.MeshStandardMaterial({ color: 0x963D24, roughness: 0.9, metalness: 0.0 }), // Brown-red leatherette
    chromeHandrail: new THREE.MeshStandardMaterial({ color: 0xDDE4EB, roughness: 0.2, metalness: 0.4 }), // Chrome
    windowGlass: new THREE.MeshStandardMaterial({ color: 0x111A24, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.75 }),
    lampGlow: new THREE.MeshStandardMaterial({ color: 0xFFE099, emissive: 0xFFA834, emissiveIntensity: 0.6 }),

    // Courier materials
    courierJacket: new THREE.MeshStandardMaterial({ color: 0xE5A922, roughness: 0.7, metalness: 0.1 }), // Mustard jacket
    courierPants: new THREE.MeshStandardMaterial({ color: 0x242D38, roughness: 0.8, metalness: 0.1 }), // Dark navy pants
    courierSkin: new THREE.MeshStandardMaterial({ color: 0xDEAA88, roughness: 0.6, metalness: 0.0 }),
    courierCap: new THREE.MeshStandardMaterial({ color: 0x1E242B, roughness: 0.7, metalness: 0.0 }),
    courierBoots: new THREE.MeshStandardMaterial({ color: 0x1A1412, roughness: 0.9, metalness: 0.0 }),

    // Cargo materials
    tvBody: new THREE.MeshStandardMaterial({ color: 0x6E4E37, roughness: 0.6, metalness: 0.1 }), // Wood veneer
    tvScreen: new THREE.MeshStandardMaterial({ color: 0x1F2933, roughness: 0.2, metalness: 0.3 }), // CRT glass
    tvKnobs: new THREE.MeshStandardMaterial({ color: 0xD0D7DE, roughness: 0.3, metalness: 0.4 }),

    aquariumGlass: new THREE.MeshStandardMaterial({ color: 0x8AEBFF, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.5 }),
    aquariumWater: new THREE.MeshStandardMaterial({ color: 0x1EA4FF, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.65 }),
    goldfish: new THREE.MeshStandardMaterial({ color: 0xFF6B1A, roughness: 0.4, metalness: 0.0, emissive: 0xFF4500, emissiveIntensity: 0.3 }),

    pizzaBox: new THREE.MeshStandardMaterial({ color: 0xCDB08B, roughness: 0.85, metalness: 0.0 }), // Cardboard
    pizzaStripe: new THREE.MeshStandardMaterial({ color: 0xCF3A24, roughness: 0.8, metalness: 0.0 }), // Red stripe

    woodCrate: new THREE.MeshStandardMaterial({ color: 0x8C6747, roughness: 0.9, metalness: 0.05 }),
    porcelainVase: new THREE.MeshStandardMaterial({ color: 0xE8F1F5, roughness: 0.15, metalness: 0.1 }),
    parcelPaper: new THREE.MeshStandardMaterial({ color: 0xBA9871, roughness: 0.8, metalness: 0.0 })
  };

  /**
   * Builds the 1980s Retro Metro Subway Carriage Interior.
   */
  public static createMetroCarriage(): THREE.Group {
    const carriage = new THREE.Group();
    carriage.name = 'metro_carriage';

    // 1. Floor (1.8m corridor width, 8m long)
    const floorGeo = new THREE.BoxGeometry(2.4, 0.1, 8.0);
    const floorMesh = new THREE.Mesh(floorGeo, this.materials.carriageFloor);
    floorMesh.position.set(0, -0.05, 0);
    floorMesh.receiveShadow = true;
    carriage.add(floorMesh);

    // 2. Ceiling (Height ~2.6m)
    const roofGeo = new THREE.BoxGeometry(2.4, 0.1, 8.0);
    const roofMesh = new THREE.Mesh(roofGeo, this.materials.carriageRoof);
    roofMesh.position.set(0, 2.7, 0);
    carriage.add(roofMesh);

    // 3. Left and Right Walls with Window Cutouts
    [-1.2, 1.2].forEach((xPos) => {
      // Lower wall under windows
      const lowerWallGeo = new THREE.BoxGeometry(0.1, 0.9, 8.0);
      const lowerWall = new THREE.Mesh(lowerWallGeo, this.materials.carriageWall);
      lowerWall.position.set(xPos, 0.45, 0);
      carriage.add(lowerWall);

      // Upper wall above windows
      const upperWallGeo = new THREE.BoxGeometry(0.1, 0.6, 8.0);
      const upperWall = new THREE.Mesh(upperWallGeo, this.materials.carriageWall);
      upperWall.position.set(xPos, 2.4, 0);
      carriage.add(upperWall);

      // Windows (3 windows on each side)
      for (let z = -2.5; z <= 2.5; z += 2.5) {
        const windowGeo = new THREE.BoxGeometry(0.08, 1.1, 1.8);
        const windowMesh = new THREE.Mesh(windowGeo, this.materials.windowGlass);
        windowMesh.position.set(xPos, 1.5, z);
        carriage.add(windowMesh);
      }

      // Passenger Seats along walls
      for (let z = -2.5; z <= 2.5; z += 2.5) {
        const seatGeo = new THREE.BoxGeometry(0.45, 0.4, 1.6);
        const seatMesh = new THREE.Mesh(seatGeo, this.materials.seatFabric);
        seatMesh.position.set(xPos > 0 ? xPos - 0.3 : xPos + 0.3, 0.2, z);
        carriage.add(seatMesh);
      }
    });

    // 4. Chrome Handrails (Central ceiling rail and vertical poles)
    const topRailGeo = new THREE.CylinderGeometry(0.025, 0.025, 7.6, 8);
    const topRail = new THREE.Mesh(topRailGeo, this.materials.chromeHandrail);
    topRail.rotation.x = Math.PI / 2;
    topRail.position.set(0, 2.4, 0);
    carriage.add(topRail);

    // Vertical poles
    [-2.0, 0, 2.0].forEach((zPos) => {
      const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 2.7, 8);
      const poleLeft = new THREE.Mesh(poleGeo, this.materials.chromeHandrail);
      poleLeft.position.set(-0.7, 1.35, zPos);
      carriage.add(poleLeft);

      const poleRight = new THREE.Mesh(poleGeo, this.materials.chromeHandrail);
      poleRight.position.set(0.7, 1.35, zPos);
      carriage.add(poleRight);
    });

    // 5. Ceiling Light Fixtures (Lamps)
    [-2.2, 0, 2.2].forEach((zPos) => {
      const lampGeo = new THREE.BoxGeometry(0.3, 0.06, 0.9);
      const lampMesh = new THREE.Mesh(lampGeo, this.materials.lampGlow);
      lampMesh.position.set(0, 2.62, zPos);
      carriage.add(lampMesh);
    });

    return carriage;
  }

  /**
   * Builds the Courier 3D character.
   */
  public static createCourier(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'courier_root';

    // Pelvis / Hips
    const hips = new THREE.Group();
    hips.name = 'hips';
    hips.position.set(0, 0.55, 0);
    root.add(hips);

    // Torso (Jacket)
    const torsoGeo = new THREE.BoxGeometry(0.36, 0.45, 0.24);
    const torsoMesh = new THREE.Mesh(torsoGeo, this.materials.courierJacket);
    torsoMesh.position.set(0, 0.22, 0);
    hips.add(torsoMesh);

    // Head & Cap
    const headGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const headMesh = new THREE.Mesh(headGeo, this.materials.courierSkin);
    headMesh.position.set(0, 0.54, 0.02);
    hips.add(headMesh);

    const capGeo = new THREE.BoxGeometry(0.2, 0.06, 0.24);
    const capMesh = new THREE.Mesh(capGeo, this.materials.courierCap);
    capMesh.position.set(0, 0.64, 0.04);
    hips.add(capMesh);

    // Left Leg
    const legGeo = new THREE.BoxGeometry(0.12, 0.5, 0.14);
    const leftLeg = new THREE.Mesh(legGeo, this.materials.courierPants);
    leftLeg.name = 'left_leg';
    leftLeg.position.set(-0.12, -0.28, 0);
    hips.add(leftLeg);

    const bootGeo = new THREE.BoxGeometry(0.13, 0.1, 0.22);
    const leftBoot = new THREE.Mesh(bootGeo, this.materials.courierBoots);
    leftBoot.position.set(-0.12, -0.5, 0.04);
    hips.add(leftBoot);

    // Right Leg
    const rightLeg = new THREE.Mesh(legGeo, this.materials.courierPants);
    rightLeg.name = 'right_leg';
    rightLeg.position.set(0.12, -0.28, 0);
    hips.add(rightLeg);

    const rightBoot = new THREE.Mesh(bootGeo, this.materials.courierBoots);
    rightBoot.position.set(0.12, -0.5, 0.04);
    hips.add(rightBoot);

    // Left Arm (holding stack)
    const armGeo = new THREE.BoxGeometry(0.08, 0.36, 0.08);
    const leftArm = new THREE.Mesh(armGeo, this.materials.courierJacket);
    leftArm.name = 'left_arm';
    leftArm.position.set(-0.24, 0.24, 0.12);
    leftArm.rotation.x = Math.PI / 4;
    hips.add(leftArm);

    // Right Arm (holding / gripping)
    const rightArm = new THREE.Mesh(armGeo, this.materials.courierJacket);
    rightArm.name = 'right_arm';
    rightArm.position.set(0.24, 0.24, 0.12);
    rightArm.rotation.x = Math.PI / 4;
    hips.add(rightArm);

    return root;
  }

  /**
   * Builds 3D mesh for Vintage CRT Television.
   */
  public static createTvMesh(w: number, h: number, d: number): THREE.Group {
    const group = new THREE.Group();

    // Wood body
    const bodyGeo = new THREE.BoxGeometry(w, h, d);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.materials.tvBody);
    group.add(bodyMesh);

    // Screen
    const screenGeo = new THREE.BoxGeometry(w * 0.65, h * 0.75, 0.02);
    const screenMesh = new THREE.Mesh(screenGeo, this.materials.tvScreen);
    screenMesh.position.set(-w * 0.12, 0, d * 0.5 + 0.01);
    group.add(screenMesh);

    // Control knobs panel
    const knobGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12);
    const knob1 = new THREE.Mesh(knobGeo, this.materials.tvKnobs);
    knob1.rotation.x = Math.PI / 2;
    knob1.position.set(w * 0.32, h * 0.2, d * 0.5 + 0.01);
    group.add(knob1);

    const knob2 = new THREE.Mesh(knobGeo, this.materials.tvKnobs);
    knob2.rotation.x = Math.PI / 2;
    knob2.position.set(w * 0.32, -h * 0.1, d * 0.5 + 0.01);
    group.add(knob2);

    return group;
  }

  /**
   * Builds 3D mesh for Glass Aquarium with Water & Goldfish.
   */
  public static createAquariumMesh(w: number, h: number, d: number): THREE.Group {
    const group = new THREE.Group();

    // Glass Tank
    const tankGeo = new THREE.BoxGeometry(w, h, d);
    const tankMesh = new THREE.Mesh(tankGeo, this.materials.aquariumGlass);
    group.add(tankMesh);

    // Water block inside
    const waterGeo = new THREE.BoxGeometry(w * 0.92, h * 0.78, d * 0.92);
    const waterMesh = new THREE.Mesh(waterGeo, this.materials.aquariumWater);
    waterMesh.name = 'aquarium_water';
    waterMesh.position.set(0, -h * 0.06, 0);
    group.add(waterMesh);

    // Goldfish
    const fishGeo = new THREE.ConeGeometry(0.03, 0.08, 6);
    const fishMesh = new THREE.Mesh(fishGeo, this.materials.goldfish);
    fishMesh.name = 'goldfish';
    fishMesh.rotation.z = Math.PI / 2;
    fishMesh.position.set(0, 0, 0);
    group.add(fishMesh);

    return group;
  }

  /**
   * Builds 3D mesh for Pizza Boxes Stack.
   */
  public static createPizzaStackMesh(w: number, h: number, d: number): THREE.Group {
    const group = new THREE.Group();
    const boxCount = 4;
    const singleH = h / boxCount;

    for (let i = 0; i < boxCount; i++) {
      const boxGeo = new THREE.BoxGeometry(w, singleH * 0.9, d);
      const boxMesh = new THREE.Mesh(boxGeo, this.materials.pizzaBox);
      boxMesh.position.set(0, -h * 0.5 + (i + 0.5) * singleH, 0);
      group.add(boxMesh);

      // Red label stripe
      const stripeGeo = new THREE.BoxGeometry(w * 0.4, singleH * 0.92, d * 0.4);
      const stripeMesh = new THREE.Mesh(stripeGeo, this.materials.pizzaStripe);
      stripeMesh.position.copy(boxMesh.position);
      group.add(stripeMesh);
    }

    return group;
  }

  /**
   * Builds 3D mesh for Wooden Crate.
   */
  public static createCrateMesh(w: number, h: number, d: number): THREE.Group {
    const group = new THREE.Group();
    const crateGeo = new THREE.BoxGeometry(w, h, d);
    const crateMesh = new THREE.Mesh(crateGeo, this.materials.woodCrate);
    group.add(crateMesh);
    return group;
  }

  /**
   * Builds 3D mesh for Antique Porcelain Vase.
   */
  public static createVaseMesh(w: number, h: number, d: number): THREE.Group {
    const group = new THREE.Group();
    const vaseGeo = new THREE.CylinderGeometry(w * 0.35, w * 0.5, h, 12);
    const vaseMesh = new THREE.Mesh(vaseGeo, this.materials.porcelainVase);
    group.add(vaseMesh);
    return group;
  }

  /**
   * Builds 3D mesh for Express Parcels.
   */
  public static createParcelMesh(w: number, h: number, d: number): THREE.Group {
    const group = new THREE.Group();
    const parcelGeo = new THREE.BoxGeometry(w, h, d);
    const parcelMesh = new THREE.Mesh(parcelGeo, this.materials.parcelPaper);
    group.add(parcelMesh);
    return group;
  }
}
