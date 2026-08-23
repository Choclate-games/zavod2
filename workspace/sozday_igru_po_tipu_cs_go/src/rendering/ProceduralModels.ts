import * as THREE from 'three';

export class ProceduralModels {
  public static createDeagleViewmodel(): THREE.Group {
    const group = new THREE.Group();

    // Gun Body / Slide
    const slideGeo = new THREE.BoxGeometry(0.06, 0.08, 0.28);
    const slideMat = new THREE.MeshStandardMaterial({
      color: 0x1A1D24,
      metalness: 0.4,
      roughness: 0.3
    });
    const slide = new THREE.Mesh(slideGeo, slideMat);
    slide.position.set(0, 0, 0);
    group.add(slide);

    // Barrel tip
    const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.08, 8);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0d0e12, metalness: 0.4, roughness: 0.2 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -0.16);
    group.add(barrel);

    // Grip / Handle
    const gripGeo = new THREE.BoxGeometry(0.05, 0.14, 0.08);
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.rotation.x = 0.25;
    grip.position.set(0, -0.09, 0.06);
    group.add(grip);

    // Trigger Guard & Trigger
    const guardGeo = new THREE.BoxGeometry(0.03, 0.05, 0.06);
    const guardMat = new THREE.MeshStandardMaterial({ color: 0x1A1D24, metalness: 0.3 });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.set(0, -0.05, -0.02);
    group.add(guard);

    // Right Hand (Grip)
    const handMat = new THREE.MeshStandardMaterial({ color: 0x2C3E50, roughness: 0.7 });
    const rHandGeo = new THREE.BoxGeometry(0.08, 0.10, 0.08);
    const rHand = new THREE.Mesh(rHandGeo, handMat);
    rHand.position.set(0.03, -0.08, 0.07);
    group.add(rHand);

    // Left Hand (Support)
    const lHandGeo = new THREE.BoxGeometry(0.08, 0.08, 0.09);
    const lHand = new THREE.Mesh(lHandGeo, handMat);
    lHand.position.set(-0.04, -0.09, 0.04);
    group.add(lHand);

    // Right Forearm
    const rArmGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.35, 8);
    const rArm = new THREE.Mesh(rArmGeo, handMat);
    rArm.rotation.x = -0.6;
    rArm.rotation.z = 0.2;
    rArm.position.set(0.12, -0.22, 0.22);
    group.add(rArm);

    // Left Forearm
    const lArmGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.35, 8);
    const lArm = new THREE.Mesh(lArmGeo, handMat);
    lArm.rotation.x = -0.7;
    lArm.rotation.z = -0.3;
    lArm.position.set(-0.14, -0.22, 0.18);
    group.add(lArm);

    // StatTrak Orange LED Counter
    const statGeo = new THREE.BoxGeometry(0.015, 0.025, 0.06);
    const statMat = new THREE.MeshStandardMaterial({
      color: 0xF39C12,
      emissive: 0xF39C12,
      emissiveIntensity: 0.6
    });
    const statTrak = new THREE.Mesh(statGeo, statMat);
    statTrak.position.set(-0.035, 0.02, 0.02);
    group.add(statTrak);

    group.position.set(0.20, -0.22, -0.45);
    return group;
  }

  public static createSoldierBot(): { root: THREE.Group; helmet: THREE.Mesh; headGroup: THREE.Group } {
    const root = new THREE.Group();

    const suitMat = new THREE.MeshStandardMaterial({ color: 0x1A1D24, roughness: 0.7 });
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x2C3E50, roughness: 0.6 });
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0x95A5A6,
      metalness: 0.4,
      roughness: 0.3
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xF39C12,
      emissive: 0xF39C12,
      emissiveIntensity: 0.4,
      roughness: 0.2
    });

    // Legs
    const lLegGeo = new THREE.BoxGeometry(0.2, 0.75, 0.22);
    const lLeg = new THREE.Mesh(lLegGeo, suitMat);
    lLeg.position.set(-0.16, 0.38, 0);
    root.add(lLeg);

    const rLegGeo = new THREE.BoxGeometry(0.2, 0.75, 0.22);
    const rLeg = new THREE.Mesh(rLegGeo, suitMat);
    rLeg.position.set(0.16, 0.38, 0);
    root.add(rLeg);

    // Torso / Body (Hitbox Multiplier 1.0)
    const torsoGeo = new THREE.BoxGeometry(0.48, 0.65, 0.30);
    const torso = new THREE.Mesh(torsoGeo, suitMat);
    torso.position.set(0, 1.05, 0);
    torso.name = 'BODY';
    root.add(torso);

    // Tactical Vest
    const vestGeo = new THREE.BoxGeometry(0.52, 0.45, 0.34);
    const vest = new THREE.Mesh(vestGeo, vestMat);
    vest.position.set(0, 1.10, 0);
    root.add(vest);

    // Arms
    const lArmGeo = new THREE.BoxGeometry(0.16, 0.60, 0.16);
    const lArm = new THREE.Mesh(lArmGeo, suitMat);
    lArm.position.set(-0.35, 1.05, 0.12);
    lArm.rotation.x = -0.4;
    root.add(lArm);

    const rArmGeo = new THREE.BoxGeometry(0.16, 0.60, 0.16);
    const rArm = new THREE.Mesh(rArmGeo, suitMat);
    rArm.position.set(0.35, 1.05, 0.12);
    rArm.rotation.x = -0.4;
    root.add(rArm);

    // Bot Weapon (Desert Eagle model)
    const botGun = ProceduralModels.createDeagleViewmodel();
    botGun.scale.set(0.8, 0.8, 0.8);
    botGun.position.set(0.20, 0.95, 0.35);
    botGun.rotation.y = Math.PI;
    root.add(botGun);

    // Head Group (Fixed at y_head_level = 1.65m)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.65, 0);
    headGroup.name = 'HEAD';

    // Head base (radius 0.11m)
    const headGeo = new THREE.SphereGeometry(0.11, 12, 12);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headGroup.add(headMesh);

    // Detachable Tactical Helmet
    const helmetGeo = new THREE.SphereGeometry(0.13, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.65);
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.set(0, 0.02, 0);

    // Visor
    const visorGeo = new THREE.BoxGeometry(0.18, 0.05, 0.08);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, -0.01, 0.10);
    helmet.add(visor);

    headGroup.add(helmet);
    root.add(headGroup);

    return { root, helmet, headGroup };
  }

  public static createRooftopEnvironment(): THREE.Group {
    const root = new THREE.Group();

    // Concrete Rooftop Slab (24m x 16m)
    const slabGeo = new THREE.BoxGeometry(24, 1.0, 16);
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x2C3E50,
      roughness: 0.85,
      metalness: 0.1
    });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.set(0, -0.5, 0);
    root.add(slab);

    // Yellow Caution Edge Strips
    const stripMat = new THREE.MeshStandardMaterial({ color: 0xF39C12, roughness: 0.5 });
    const stripN = new THREE.Mesh(new THREE.BoxGeometry(24, 0.02, 0.4), stripMat);
    stripN.position.set(0, 0.01, -7.8);
    root.add(stripN);
    const stripS = new THREE.Mesh(new THREE.BoxGeometry(24, 0.02, 0.4), stripMat);
    stripS.position.set(0, 0.01, 7.8);
    root.add(stripS);

    // Steel I-Beam Columns (1.2m width)
    const beamGeo = new THREE.BoxGeometry(1.2, 3.0, 1.2);
    const beamMat = new THREE.MeshStandardMaterial({
      color: 0x1A1D24,
      metalness: 0.4,
      roughness: 0.4
    });

    const beamPositions = [
      new THREE.Vector3(-4.5, 1.5, -2),
      new THREE.Vector3(-4.5, 1.5, 2),
      new THREE.Vector3(4.5, 1.5, -2),
      new THREE.Vector3(4.5, 1.5, 2)
    ];

    beamPositions.forEach((pos) => {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.copy(pos);
      root.add(beam);
    });

    // Center Ventilation Block
    const ventGeo = new THREE.BoxGeometry(2.4, 2.2, 1.6);
    const ventMat = new THREE.MeshStandardMaterial({
      color: 0x95A5A6,
      metalness: 0.35,
      roughness: 0.5
    });
    const vent = new THREE.Mesh(ventGeo, ventMat);
    vent.position.set(0, 1.1, 0);
    root.add(vent);

    // Light Wallbang Shield (Corrugated sheet / plywood, 0.2m thickness)
    const wallbangGeo = new THREE.BoxGeometry(3.2, 2.4, 0.2);
    const wallbangMat = new THREE.MeshStandardMaterial({
      color: 0x7F8C8D,
      metalness: 0.3,
      roughness: 0.6
    });

    const wallN = new THREE.Mesh(wallbangGeo, wallbangMat);
    wallN.position.set(0, 1.2, -4.5);
    root.add(wallN);

    const wallS = new THREE.Mesh(wallbangGeo, wallbangMat);
    wallS.position.set(0, 1.2, 4.5);
    root.add(wallS);

    // Safety Railings along the border
    const railMat = new THREE.MeshStandardMaterial({ color: 0xF39C12, metalness: 0.4 });
    const createRail = (len: number, rotY: number, px: number, pz: number) => {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 8), railMat);
      rail.rotation.z = Math.PI / 2;
      rail.rotation.y = rotY;
      rail.position.set(px, 1.0, pz);
      root.add(rail);
    };
    createRail(24, 0, 0, -8.0);
    createRail(24, 0, 0, 8.0);
    createRail(16, Math.PI / 2, -12.0, 0);
    createRail(16, Math.PI / 2, 12.0, 0);

    // City Skyline Backdrop (Distant silhouette buildings)
    const cityMat = new THREE.MeshBasicMaterial({ color: 0x151922 });
    for (let i = 0; i < 20; i++) {
      const w = 4 + Math.random() * 8;
      const h = 40 + Math.random() * 80;
      const d = 4 + Math.random() * 8;
      const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cityMat);
      const angle = (i / 20) * Math.PI * 2;
      const dist = 80 + Math.random() * 40;
      building.position.set(Math.cos(angle) * dist, h / 2 - 80, Math.sin(angle) * dist);
      root.add(building);
    }

    return root;
  }
}