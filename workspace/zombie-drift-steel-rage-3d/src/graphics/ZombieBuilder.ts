import * as THREE from 'three';
import { ZombieType } from '../types/zombie';
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

  private static getConeGeo(r: number, h: number, seg = 5): THREE.BufferGeometry {
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
    const config = ZOMBIE_CONFIGS[type];
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const flashEntries: FlashMeshEntry[] = [];

    const skinMat = this.getMaterial(`skin_${type}`, () => new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.8,
      metalness: 0.1,
    }));

    const clothColor = type === 'RUNNER' ? 0x2b1e1a : type === 'TANK' ? 0x1f2421 : 0x3e4444;
    const clothMat = this.getMaterial(`cloth_${type}`, () => new THREE.MeshStandardMaterial({
      color: clothColor,
      roughness: 0.85,
      metalness: 0.08,
    }));

    const eyeColor = type === 'SPITTER' ? 0x88ff00 : 0xff1744;
    const eyeEmissive = type === 'SPITTER' ? 0x76ff03 : 0xff0033;
    const eyeMat = this.getMaterial(`eye_${type}`, () => new THREE.MeshStandardMaterial({
      color: eyeColor,
      emissive: eyeEmissive,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    }));

    const darkMat = this.getMaterial('dark_metal', () => new THREE.MeshStandardMaterial({
      color: 0x151515,
      roughness: 0.6,
      metalness: 0.7,
    }));

    // Torso
    const torsoHeight = type === 'BOSS_GOLIATH' ? 1.6 : type === 'TANK' ? 1.2 : 0.9;
    const torsoWidth = type === 'BOSS_GOLIATH' ? 1.4 : type === 'TANK' ? 1.1 : 0.65;
    const torsoDepth = type === 'BOSS_GOLIATH' ? 1.0 : type === 'TANK' ? 0.8 : 0.45;

    const torsoGeo = this.getBoxGeo(torsoWidth, torsoHeight, torsoDepth);
    const torso = new THREE.Mesh(torsoGeo, clothMat);
    torso.position.set(0, torsoHeight / 2 + 0.8, 0);
    torso.castShadow = type === 'BOSS_GOLIATH' || type === 'TANK';
    body.add(torso);
    flashEntries.push({ mesh: torso, originalMaterial: clothMat });

    let toxicBelly: THREE.Mesh | undefined;
    let bossCore: THREE.Mesh | undefined;

    if (type === 'SPITTER') {
      const bellyGeo = this.getSphereGeo(0.45, 8, 8);
      const bellyMat = this.getMaterial('spitter_belly', () => new THREE.MeshStandardMaterial({
        color: 0x76ff03,
        roughness: 0.25,
        emissive: 0x44dd00,
        emissiveIntensity: 1.2,
      }));
      toxicBelly = new THREE.Mesh(bellyGeo, bellyMat);
      toxicBelly.position.set(0, torsoHeight * 0.4 + 0.8, 0.25);
      toxicBelly.scale.set(1.1, 0.9, 1.2);
      body.add(toxicBelly);
    }

    if (type === 'TANK' || type === 'BOSS_GOLIATH') {
      const padGeo = this.getBoxGeo(0.6, 0.3, 0.6);
      const padL = new THREE.Mesh(padGeo, darkMat);
      padL.position.set(-torsoWidth * 0.6, torsoHeight + 0.7, 0);
      const padR = new THREE.Mesh(padGeo, darkMat);
      padR.position.set(torsoWidth * 0.6, torsoHeight + 0.7, 0);
      body.add(padL, padR);
      flashEntries.push({ mesh: padL, originalMaterial: darkMat }, { mesh: padR, originalMaterial: darkMat });
    }

    if (type === 'BOSS_GOLIATH') {
      const coreGeo = this.getSphereGeo(0.4, 8, 8);
      const coreMat = this.getMaterial('boss_core', () => new THREE.MeshStandardMaterial({
        color: 0xff0044,
        emissive: 0xff0033,
        emissiveIntensity: 2.0,
        roughness: 0.1,
      }));
      bossCore = new THREE.Mesh(coreGeo, coreMat);
      bossCore.position.set(0, torsoHeight * 0.55 + 0.8, 0.35);
      bossCore.scale.set(1.0, 1.2, 0.7);
      body.add(bossCore);
    }

    // Head
    const headSize = type === 'BOSS_GOLIATH' ? 0.65 : type === 'TANK' ? 0.5 : 0.38;
    const headGeo = this.getBoxGeo(headSize, headSize, headSize);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, torsoHeight + 0.8 + headSize / 2, 0);
    body.add(head);
    flashEntries.push({ mesh: head, originalMaterial: skinMat });

    if (type === 'BOSS_GOLIATH') {
      const hornGeo = this.getConeGeo(0.12, 0.5, 5);
      const hornL = new THREE.Mesh(hornGeo, darkMat);
      hornL.position.set(-0.25, headSize / 2 + 0.2, 0);
      hornL.rotation.z = 0.3;
      const hornR = new THREE.Mesh(hornGeo, darkMat);
      hornR.position.set(0.25, headSize / 2 + 0.2, 0);
      hornR.rotation.z = -0.3;
      head.add(hornL, hornR);
      flashEntries.push({ mesh: hornL, originalMaterial: darkMat }, { mesh: hornR, originalMaterial: darkMat });
    }

    // Glowing Eyes
    const eyeGeo = this.getBoxGeo(headSize * 0.22, headSize * 0.14, 0.05);
    const eyesMesh = new THREE.Mesh(eyeGeo, eyeMat);
    eyesMesh.position.set(0, 0, headSize / 2 + 0.02);
    head.add(eyesMesh);

    // Arms
    const armLength = type === 'BOSS_GOLIATH' ? 1.4 : type === 'TANK' ? 1.1 : 0.8;
    const armThickness = type === 'BOSS_GOLIATH' ? 0.38 : type === 'TANK' ? 0.3 : 0.18;
    const armGeo = this.getBoxGeo(armThickness, armLength, armThickness);

    const leftArm = new THREE.Group();
    leftArm.position.set(-torsoWidth / 2 - armThickness / 2, torsoHeight + 0.6, 0);
    const lArmMesh = new THREE.Mesh(armGeo, skinMat);
    lArmMesh.position.set(0, -armLength / 2, 0);
    leftArm.add(lArmMesh);
    body.add(leftArm);
    flashEntries.push({ mesh: lArmMesh, originalMaterial: skinMat });

    const rightArm = new THREE.Group();
    rightArm.position.set(torsoWidth / 2 + armThickness / 2, torsoHeight + 0.6, 0);
    const rArmMesh = new THREE.Mesh(armGeo, skinMat);
    rArmMesh.position.set(0, -armLength / 2, 0);
    rightArm.add(rArmMesh);
    body.add(rightArm);
    flashEntries.push({ mesh: rArmMesh, originalMaterial: skinMat });

    // Legs
    const legLength = type === 'BOSS_GOLIATH' ? 1.1 : 0.8;
    const legThickness = type === 'BOSS_GOLIATH' ? 0.35 : type === 'TANK' ? 0.28 : 0.2;
    const legGeo = this.getBoxGeo(legThickness, legLength, legThickness);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-torsoWidth * 0.25, legLength, 0);
    const lLegMesh = new THREE.Mesh(legGeo, clothMat);
    lLegMesh.position.set(0, -legLength / 2, 0);
    leftLeg.add(lLegMesh);
    body.add(leftLeg);
    flashEntries.push({ mesh: lLegMesh, originalMaterial: clothMat });

    const rightLeg = new THREE.Group();
    rightLeg.position.set(torsoWidth * 0.25, legLength, 0);
    const rLegMesh = new THREE.Mesh(legGeo, clothMat);
    rLegMesh.position.set(0, -legLength / 2, 0);
    rightLeg.add(rLegMesh);
    body.add(rightLeg);
    flashEntries.push({ mesh: rLegMesh, originalMaterial: clothMat });

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
      flashEntries,
    };
  }
}
