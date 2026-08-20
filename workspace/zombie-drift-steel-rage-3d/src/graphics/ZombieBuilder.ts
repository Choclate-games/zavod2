import * as THREE from 'three';
import { ZombieType, BossType } from '../types/zombie';
import { ZOMBIE_CONFIGS } from '../core/Constants';

export interface FlashMeshEntry {
  mesh: THREE.Mesh;
  originalMaterial: THREE.Material;
}

export interface ZombieMeshResult {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  eyesMesh: THREE.Mesh;
  toxicBelly?: THREE.Mesh;
  bossCore?: THREE.Mesh;
  sawBladeMesh?: THREE.Mesh;
  plasmaBladeL?: THREE.Mesh;
  plasmaBladeR?: THREE.Mesh;
  flashEntries: FlashMeshEntry[];
}

export class ZombieBuilder {
  private static geometries: Map<string, THREE.BufferGeometry> = new Map();
  private static materials: Map<string, THREE.Material> = new Map();
  public static flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

  private static getBoxGeo(w: number, h: number, d: number): THREE.BufferGeometry {
    const key = `box_${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}`;
    if (!this.geometries.has(key)) {
      this.geometries.set(key, new THREE.BoxGeometry(w, h, d));
    }
    return this.geometries.get(key)!;
  }

  private static getSphereGeo(r: number, segW = 8, segH = 8): THREE.BufferGeometry {
    const key = `sphere_${r.toFixed(2)}_${segW}_${segH}`;
    if (!this.geometries.has(key)) {
      this.geometries.set(key, new THREE.SphereGeometry(r, segW, segH));
    }
    return this.geometries.get(key)!;
  }

  private static getCylinderGeo(rt: number, rb: number, h: number, seg = 8): THREE.BufferGeometry {
    const key = `cyl_${rt.toFixed(2)}_${rb.toFixed(2)}_${h.toFixed(2)}_${seg}`;
    if (!this.geometries.has(key)) {
      this.geometries.set(key, new THREE.CylinderGeometry(rt, rb, h, seg));
    }
    return this.geometries.get(key)!;
  }

  private static getConeGeo(r: number, h: number, seg = 6): THREE.BufferGeometry {
    const key = `cone_${r.toFixed(2)}_${h.toFixed(2)}_${seg}`;
    if (!this.geometries.has(key)) {
      this.geometries.set(key, new THREE.ConeGeometry(r, h, seg));
    }
    return this.geometries.get(key)!;
  }

  private static getMaterial(key: string, createFn: () => THREE.Material): THREE.Material {
    if (!this.materials.has(key)) {
      this.materials.set(key, createFn());
    }
    return this.materials.get(key)!;
  }

  public static buildZombie(type: ZombieType): ZombieMeshResult {
    const config = ZOMBIE_CONFIGS[type] || ZOMBIE_CONFIGS.WALKER;
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const flashEntries: FlashMeshEntry[] = [];

    // Is this any of the boss types?
    const isBoss = type.startsWith('BOSS_');

    // 1. Skin & Armor Materials
    const skinMat = this.getMaterial(`skin_${type}`, () => new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: isBoss ? 0.7 : 0.85,
      metalness: type === 'BOSS_CYBER_REAPER' || type === 'BOSS_IRON_BUTCHER' ? 0.65 : 0.1,
    }));

    const clothColor = type === 'RUNNER' ? 0x221815
      : type === 'TANK' ? 0x1f2421
      : type === 'BOSS_CYBER_REAPER' ? 0x050505
      : type === 'BOSS_INFERNO_TITAN' ? 0x1a0500
      : type === 'BOSS_CRIMSON_REAPER' ? 0x2b0008
      : type === 'BOSS_APOCALYPSE_LORD' ? 0x0a0014
      : 0x3a4042;

    const clothMat = this.getMaterial(`cloth_${type}`, () => new THREE.MeshStandardMaterial({
      color: clothColor,
      roughness: 0.9,
      metalness: 0.05,
    }));

    const boneMat = this.getMaterial('bone_decay', () => new THREE.MeshStandardMaterial({
      color: 0xd6cebe,
      roughness: 0.6,
      metalness: 0.05,
    }));

    const darkMetalMat = this.getMaterial('dark_armor_metal', () => new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.45,
      metalness: 0.85,
    }));

    const chromeSawMat = this.getMaterial('chrome_saw', () => new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      roughness: 0.1,
      metalness: 0.95,
    }));

    // Glowing Eyes & Cores
    const eyeColor = config.accentColor || 0xff0044;
    const eyeMat = this.getMaterial(`eye_${type}`, () => new THREE.MeshStandardMaterial({
      color: eyeColor,
      emissive: eyeColor,
      emissiveIntensity: isBoss ? 3.0 : 2.2,
      roughness: 0.2,
    }));

    // 2. Torso Dimensions
    let torsoWidth = 0.65;
    let torsoHeight = 0.9;
    let torsoDepth = 0.45;

    if (isBoss) {
      torsoWidth = 1.5;
      torsoHeight = 1.7;
      torsoDepth = 1.1;
    } else if (type === 'TANK') {
      torsoWidth = 1.15;
      torsoHeight = 1.25;
      torsoDepth = 0.85;
    } else if (type === 'RUNNER') {
      torsoWidth = 0.55;
      torsoHeight = 0.85;
      torsoDepth = 0.4;
    }

    const torsoGeo = this.getBoxGeo(torsoWidth, torsoHeight, torsoDepth);
    const torso = new THREE.Mesh(torsoGeo, clothMat);
    torso.position.set(0, torsoHeight / 2 + 0.8, 0);
    torso.castShadow = isBoss || type === 'TANK';
    body.add(torso);
    flashEntries.push({ mesh: torso, originalMaterial: clothMat });

    // Decorative details based on enemy type
    let toxicBelly: THREE.Mesh | undefined;
    let bossCore: THREE.Mesh | undefined;
    let sawBladeMesh: THREE.Mesh | undefined;
    let plasmaBladeL: THREE.Mesh | undefined;
    let plasmaBladeR: THREE.Mesh | undefined;

    // ═════════════════════════════════════════════════════════════════════════
    // SPECIAL ENEMY & BOSS ACCESSORIES
    // ═════════════════════════════════════════════════════════════════════════
    if (type === 'WALKER') {
      // Exposed Ribs on Chest
      for (let r = 0; r < 3; r++) {
        const rib = new THREE.Mesh(this.getBoxGeo(0.48, 0.05, 0.08), boneMat);
        rib.position.set(0, 0.15 - r * 0.14, 0.23);
        torso.add(rib);
      }
      // Spine Vertebrae on Back
      for (let s = 0; s < 4; s++) {
        const vert = new THREE.Mesh(this.getBoxGeo(0.12, 0.08, 0.12), boneMat);
        vert.position.set(0, 0.25 - s * 0.16, -0.24);
        torso.add(vert);
      }
    } else if (type === 'RUNNER') {
      // Feral Spine Ridge & Shredded Leather Vest Straps
      for (let s = 0; s < 5; s++) {
        const spike = new THREE.Mesh(this.getConeGeo(0.05, 0.15, 4), boneMat);
        spike.rotation.x = -Math.PI / 2;
        spike.position.set(0, 0.3 - s * 0.14, -0.22);
        torso.add(spike);
      }
    } else if (type === 'SPITTER' || type === 'BOSS_TOXIC_BEHEMOTH') {
      // Massive Glowing Toxic Acid Sac
      const bellyR = type === 'BOSS_TOXIC_BEHEMOTH' ? 0.75 : 0.45;
      const bellyGeo = this.getSphereGeo(bellyR, 8, 8);
      const bellyMat = this.getMaterial('spitter_belly_glow', () => new THREE.MeshStandardMaterial({
        color: 0x76ff03,
        roughness: 0.2,
        emissive: 0x44dd00,
        emissiveIntensity: 1.6,
      }));
      toxicBelly = new THREE.Mesh(bellyGeo, bellyMat);
      toxicBelly.position.set(0, torsoHeight * 0.4 + 0.8, torsoDepth * 0.55);
      toxicBelly.scale.set(1.15, 0.95, 1.25);
      body.add(toxicBelly);

      // Back Acid Pustules
      for (let p = 0; p < 4; p++) {
        const pustule = new THREE.Mesh(this.getSphereGeo(0.15, 6, 6), bellyMat);
        pustule.position.set((p % 2 === 0 ? -1 : 1) * 0.2, 0.2 - Math.floor(p / 2) * 0.25, -torsoDepth * 0.52);
        torso.add(pustule);
      }
    } else if (type === 'TANK') {
      // Heavy Bolted Scrap Shoulder Pauldrons & Spiked Breastplate
      const padGeo = this.getBoxGeo(0.65, 0.35, 0.65);
      const padL = new THREE.Mesh(padGeo, darkMetalMat);
      padL.position.set(-torsoWidth * 0.62, torsoHeight + 0.75, 0);
      const padR = new THREE.Mesh(padGeo, darkMetalMat);
      padR.position.set(torsoWidth * 0.62, torsoHeight + 0.75, 0);
      body.add(padL, padR);
      flashEntries.push({ mesh: padL, originalMaterial: darkMetalMat }, { mesh: padR, originalMaterial: darkMetalMat });

      // Breastplate Spikes
      for (let sp = -0.3; sp <= 0.3; sp += 0.3) {
        const spike = new THREE.Mesh(this.getConeGeo(0.08, 0.35, 5), chromeSawMat);
        spike.rotation.x = Math.PI / 2;
        spike.position.set(sp, 0.1, torsoDepth * 0.52);
        torso.add(spike);
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // UNIQUE BOSS MODELS
    // ═════════════════════════════════════════════════════════════════════════
    if (isBoss) {
      // Glowing Core in Chest
      const coreR = 0.45;
      const coreGeo = this.getSphereGeo(coreR, 8, 8);
      const coreMat = this.getMaterial(`core_${type}`, () => new THREE.MeshStandardMaterial({
        color: config.accentColor,
        emissive: config.accentColor,
        emissiveIntensity: 2.5,
        roughness: 0.1,
      }));
      bossCore = new THREE.Mesh(coreGeo, coreMat);
      bossCore.position.set(0, torsoHeight * 0.55 + 0.8, torsoDepth * 0.52);
      bossCore.scale.set(1.0, 1.2, 0.75);
      body.add(bossCore);

      // Heavy Boss Shoulder Pauldrons
      const bPadGeo = this.getBoxGeo(0.85, 0.45, 0.85);
      const bPadL = new THREE.Mesh(bPadGeo, darkMetalMat);
      bPadL.position.set(-torsoWidth * 0.65, torsoHeight + 0.75, 0);
      const bPadR = new THREE.Mesh(bPadGeo, darkMetalMat);
      bPadR.position.set(torsoWidth * 0.65, torsoHeight + 0.75, 0);
      body.add(bPadL, bPadR);
      flashEntries.push({ mesh: bPadL, originalMaterial: darkMetalMat }, { mesh: bPadR, originalMaterial: darkMetalMat });

      if (type === 'BOSS_IRON_BUTCHER') {
        // Dual Industrial Exhaust Stacks on Back
        const exL = new THREE.Mesh(this.getCylinderGeo(0.12, 0.12, 1.2, 8), darkMetalMat);
        exL.position.set(-0.5, 0.6, -0.6);
        const exR = new THREE.Mesh(this.getCylinderGeo(0.12, 0.12, 1.2, 8), darkMetalMat);
        exR.position.set(0.5, 0.6, -0.6);
        torso.add(exL, exR);

        // Giant Circular Sawblade on Right Arm
        const sawGeo = this.getCylinderGeo(0.9, 0.9, 0.08, 16);
        sawBladeMesh = new THREE.Mesh(sawGeo, chromeSawMat);
        sawBladeMesh.rotation.z = Math.PI / 2;
      } else if (type === 'BOSS_CYBER_REAPER') {
        // Dual Plasma Arm Blades
        const bladeMat = this.getMaterial('plasma_blade_mat', () => new THREE.MeshStandardMaterial({
          color: 0x00f0ff,
          emissive: 0x00f0ff,
          emissiveIntensity: 2.8,
          roughness: 0.1,
        }));
        const bladeGeo = this.getBoxGeo(0.06, 1.6, 0.22);
        plasmaBladeL = new THREE.Mesh(bladeGeo, bladeMat);
        plasmaBladeL.position.set(-0.15, -0.8, 0.2);
        plasmaBladeR = new THREE.Mesh(bladeGeo, bladeMat);
        plasmaBladeR.position.set(0.15, -0.8, 0.2);
      } else if (type === 'BOSS_INFERNO_TITAN' || type === 'BOSS_ASHEN_OVERLORD') {
        // Flaming Magma Rocks on Shoulders
        const magmaMat = this.getMaterial('magma_rock_mat', () => new THREE.MeshStandardMaterial({
          color: 0xff3300,
          emissive: 0xff4500,
          emissiveIntensity: 2.2,
          roughness: 0.4,
        }));
        const rockL = new THREE.Mesh(this.getBoxGeo(0.5, 0.5, 0.5), magmaMat);
        rockL.position.set(0, 0.35, 0);
        bPadL.add(rockL);
        const rockR = new THREE.Mesh(this.getBoxGeo(0.5, 0.5, 0.5), magmaMat);
        rockR.position.set(0, 0.35, 0);
        bPadR.add(rockR);
      } else if (type === 'BOSS_RADIOACTIVE_COLOSSUS') {
        // Glowing Uranium Crystals on Back
        const uranMat = this.getMaterial('uran_crystal_mat', () => new THREE.MeshStandardMaterial({
          color: 0x39ff14,
          emissive: 0x39ff14,
          emissiveIntensity: 2.4,
          roughness: 0.2,
        }));
        for (let u = 0; u < 4; u++) {
          const crystal = new THREE.Mesh(this.getConeGeo(0.18, 0.9, 6), uranMat);
          crystal.rotation.x = -Math.PI / 3;
          crystal.position.set((u % 2 === 0 ? -1 : 1) * 0.35, 0.3 - Math.floor(u / 2) * 0.4, -0.6);
          torso.add(crystal);
        }
      } else if (type === 'BOSS_APOCALYPSE_LORD') {
        // Void Cleaver Spikes & Dark Shoulder Horns
        const voidMat = this.getMaterial('void_dark_mat', () => new THREE.MeshStandardMaterial({
          color: 0x9d4edd,
          emissive: 0x7b2cbf,
          emissiveIntensity: 2.6,
          roughness: 0.2,
        }));
        const vHornL = new THREE.Mesh(this.getConeGeo(0.2, 0.9, 6), voidMat);
        vHornL.rotation.z = 0.5;
        bPadL.add(vHornL);
        const vHornR = new THREE.Mesh(this.getConeGeo(0.2, 0.9, 6), voidMat);
        vHornR.rotation.z = -0.5;
        bPadR.add(vHornR);
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // HEAD & FACIAL FEATURES
    // ═════════════════════════════════════════════════════════════════════════
    const headSize = isBoss ? 0.75 : type === 'TANK' ? 0.54 : 0.4;
    const headGeo = this.getBoxGeo(headSize, headSize * 1.05, headSize);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, torsoHeight + 0.8 + headSize / 2, 0);
    body.add(head);
    flashEntries.push({ mesh: head, originalMaterial: skinMat });

    // Lower Snarling Jaw with Teeth
    const jawGeo = this.getBoxGeo(headSize * 0.9, headSize * 0.28, headSize * 0.7);
    const jaw = new THREE.Mesh(jawGeo, skinMat);
    jaw.position.set(0, -headSize * 0.38, headSize * 0.2);
    head.add(jaw);

    // Teeth along Jaw
    const teethCount = isBoss ? 5 : 4;
    for (let t = 0; t < teethCount; t++) {
      const tooth = new THREE.Mesh(this.getConeGeo(0.02, 0.08, 4), boneMat);
      tooth.position.set(((t - (teethCount - 1) / 2) * headSize * 0.16), headSize * 0.14, headSize * 0.32);
      jaw.add(tooth);
    }

    // Horns / Helmets / Crowns
    if (type === 'BOSS_APOCALYPSE_LORD') {
      // Multi-Spiked Apocalypse Crown
      for (let c = -2; c <= 2; c++) {
        const crownSpike = new THREE.Mesh(this.getConeGeo(0.08, 0.45 + Math.abs(c) * 0.15, 5), darkMetalMat);
        crownSpike.position.set(c * 0.16, headSize / 2 + 0.25, 0.1);
        crownSpike.rotation.z = -c * 0.15;
        head.add(crownSpike);
      }
    } else if (isBoss || type === 'TANK') {
      const hornL = new THREE.Mesh(this.getConeGeo(0.12, 0.6, 5), darkMetalMat);
      hornL.position.set(-headSize * 0.45, headSize / 2 + 0.25, 0);
      hornL.rotation.z = 0.4;
      const hornR = new THREE.Mesh(this.getConeGeo(0.12, 0.6, 5), darkMetalMat);
      hornR.position.set(headSize * 0.45, headSize / 2 + 0.25, 0);
      hornR.rotation.z = -0.4;
      head.add(hornL, hornR);
      flashEntries.push({ mesh: hornL, originalMaterial: darkMetalMat }, { mesh: hornR, originalMaterial: darkMetalMat });
    }

    // Glowing Eyes
    const eyeGeo = this.getBoxGeo(headSize * 0.25, headSize * 0.14, 0.06);
    const eyesMesh = new THREE.Mesh(eyeGeo, eyeMat);
    eyesMesh.position.set(0, headSize * 0.12, headSize / 2 + 0.02);
    head.add(eyesMesh);

    // ═════════════════════════════════════════════════════════════════════════
    // ARMS & WEAPONS
    // ═════════════════════════════════════════════════════════════════════════
    const armLength = isBoss ? 1.5 : type === 'TANK' ? 1.15 : 0.85;
    const armThickness = isBoss ? 0.42 : type === 'TANK' ? 0.32 : 0.2;
    const armGeo = this.getBoxGeo(armThickness, armLength, armThickness);

    const leftArm = new THREE.Group();
    leftArm.position.set(-torsoWidth / 2 - armThickness / 2, torsoHeight + 0.65, 0);
    const lArmMesh = new THREE.Mesh(armGeo, skinMat);
    lArmMesh.position.set(0, -armLength / 2, 0);
    leftArm.add(lArmMesh);
    body.add(leftArm);
    flashEntries.push({ mesh: lArmMesh, originalMaterial: skinMat });

    const rightArm = new THREE.Group();
    rightArm.position.set(torsoWidth / 2 + armThickness / 2, torsoHeight + 0.65, 0);
    const rArmMesh = new THREE.Mesh(armGeo, skinMat);
    rArmMesh.position.set(0, -armLength / 2, 0);
    rightArm.add(rArmMesh);
    body.add(rightArm);
    flashEntries.push({ mesh: rArmMesh, originalMaterial: skinMat });

    // Attach Specialized Arm Weapons
    if (sawBladeMesh) {
      sawBladeMesh.position.set(0, -armLength - 0.2, 0);
      rightArm.add(sawBladeMesh);
    }
    if (plasmaBladeL && plasmaBladeR) {
      leftArm.add(plasmaBladeL);
      rightArm.add(plasmaBladeR);
    }

    // Heavy Spiked Fist on Tank
    if (type === 'TANK') {
      const fist = new THREE.Mesh(this.getBoxGeo(0.42, 0.42, 0.42), darkMetalMat);
      fist.position.set(0, -armLength / 2 - 0.15, 0);
      rightArm.add(fist);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // LEGS
    // ═════════════════════════════════════════════════════════════════════════
    const legLength = isBoss ? 1.25 : type === 'TANK' ? 0.95 : 0.85;
    const legThickness = isBoss ? 0.4 : type === 'TANK' ? 0.3 : 0.22;
    const legGeo = this.getBoxGeo(legThickness, legLength, legThickness);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-torsoWidth * 0.28, legLength, 0);
    const lLegMesh = new THREE.Mesh(legGeo, clothMat);
    lLegMesh.position.set(0, -legLength / 2, 0);
    leftLeg.add(lLegMesh);
    body.add(leftLeg);
    flashEntries.push({ mesh: lLegMesh, originalMaterial: clothMat });

    const rightLeg = new THREE.Group();
    rightLeg.position.set(torsoWidth * 0.28, legLength, 0);
    const rLegMesh = new THREE.Mesh(legGeo, clothMat);
    rLegMesh.position.set(0, -legLength / 2, 0);
    rightLeg.add(rLegMesh);
    body.add(rightLeg);
    flashEntries.push({ mesh: rLegMesh, originalMaterial: clothMat });

    // Scale root
    root.scale.set(config.scale, config.scale, config.scale);

    return {
      root,
      body,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      eyesMesh,
      toxicBelly,
      bossCore,
      sawBladeMesh,
      plasmaBladeL,
      plasmaBladeR,
      flashEntries,
    };
  }
}
