import * as THREE from 'three';
import { ZombieType } from '../types/zombie';
import { ZOMBIE_CONFIGS } from '../core/Constants';

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
  damageFlashMeshes: THREE.Mesh[];
}

export class ZombieBuilder {
  public static buildZombie(type: ZombieType): ZombieMeshResult {
    const config = ZOMBIE_CONFIGS[type];
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const damageFlashMeshes: THREE.Mesh[] = [];

    const skinMat = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.8,
      metalness: 0.1,
    });

    const clothMat = new THREE.MeshStandardMaterial({
      color: type === 'RUNNER' ? 0x2b1e1a : type === 'TANK' ? 0x1f2421 : 0x3e4444,
      roughness: 0.85,
      metalness: 0.08,
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: type === 'SPITTER' ? 0x88ff00 : 0xff1744,
      emissive: type === 'SPITTER' ? 0x76ff03 : 0xff0033,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x151515,
      roughness: 0.6,
      metalness: 0.7,
    });

    // Torso
    const torsoHeight = type === 'BOSS_GOLIATH' ? 1.6 : type === 'TANK' ? 1.2 : 0.9;
    const torsoWidth = type === 'BOSS_GOLIATH' ? 1.4 : type === 'TANK' ? 1.1 : 0.65;
    const torsoDepth = type === 'BOSS_GOLIATH' ? 1.0 : type === 'TANK' ? 0.8 : 0.45;

    const torsoGeo = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth);
    const torso = new THREE.Mesh(torsoGeo, clothMat);
    torso.position.set(0, torsoHeight / 2 + 0.8, 0);
    torso.castShadow = true;
    body.add(torso);
    damageFlashMeshes.push(torso);

    let toxicBelly: THREE.Mesh | undefined;
    let bossCore: THREE.Mesh | undefined;

    if (type === 'SPITTER') {
      // Bloated glowing toxic belly
      const bellyGeo = new THREE.SphereGeometry(0.45, 12, 12);
      const bellyMat = new THREE.MeshStandardMaterial({
        color: 0x76ff03,
        roughness: 0.25,
        emissive: 0x44dd00,
        emissiveIntensity: 1.2,
      });
      toxicBelly = new THREE.Mesh(bellyGeo, bellyMat);
      toxicBelly.position.set(0, torsoHeight * 0.4 + 0.8, 0.25);
      toxicBelly.scale.set(1.1, 0.9, 1.2);
      body.add(toxicBelly);
    }

    if (type === 'TANK' || type === 'BOSS_GOLIATH') {
      // Spiked Shoulder Armor Plates
      const padGeo = new THREE.BoxGeometry(0.6, 0.3, 0.6);
      const padL = new THREE.Mesh(padGeo, darkMat);
      padL.position.set(-torsoWidth * 0.6, torsoHeight + 0.7, 0);
      const padR = new THREE.Mesh(padGeo, darkMat);
      padR.position.set(torsoWidth * 0.6, torsoHeight + 0.7, 0);
      body.add(padL, padR);
      damageFlashMeshes.push(padL, padR);
    }

    if (type === 'BOSS_GOLIATH') {
      // Glowing Molten Chest Core
      const coreGeo = new THREE.SphereGeometry(0.4, 12, 12);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xff0044,
        emissive: 0xff0033,
        emissiveIntensity: 2.0,
        roughness: 0.1,
      });
      bossCore = new THREE.Mesh(coreGeo, coreMat);
      bossCore.position.set(0, torsoHeight * 0.55 + 0.8, 0.35);
      bossCore.scale.set(1.0, 1.2, 0.7);
      body.add(bossCore);
    }

    // Head
    const headSize = type === 'BOSS_GOLIATH' ? 0.65 : type === 'TANK' ? 0.5 : 0.38;
    const headGeo = new THREE.BoxGeometry(headSize, headSize, headSize);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, torsoHeight + 0.8 + headSize / 2, 0);
    head.castShadow = true;
    body.add(head);
    damageFlashMeshes.push(head);

    if (type === 'BOSS_GOLIATH') {
      // Spiked Horn Crest with glowing tips
      const hornGeo = new THREE.ConeGeometry(0.12, 0.5, 5);
      const hornL = new THREE.Mesh(hornGeo, darkMat);
      hornL.position.set(-0.25, headSize / 2 + 0.2, 0);
      hornL.rotation.z = 0.3;
      const hornR = new THREE.Mesh(hornGeo, darkMat);
      hornR.position.set(0.25, headSize / 2 + 0.2, 0);
      hornR.rotation.z = -0.3;
      head.add(hornL, hornR);
      damageFlashMeshes.push(hornL, hornR);
    }

    // Glowing Eyes
    const eyeGeo = new THREE.BoxGeometry(headSize * 0.22, headSize * 0.14, 0.05);
    const eyesMesh = new THREE.Mesh(eyeGeo, eyeMat);
    eyesMesh.position.set(0, 0, headSize / 2 + 0.02);
    head.add(eyesMesh);

    // Arms
    const armLength = type === 'BOSS_GOLIATH' ? 1.4 : type === 'TANK' ? 1.1 : 0.8;
    const armThickness = type === 'BOSS_GOLIATH' ? 0.38 : type === 'TANK' ? 0.3 : 0.18;
    const armGeo = new THREE.BoxGeometry(armThickness, armLength, armThickness);

    const leftArm = new THREE.Group();
    leftArm.position.set(-torsoWidth / 2 - armThickness / 2, torsoHeight + 0.6, 0);
    const lArmMesh = new THREE.Mesh(armGeo, skinMat);
    lArmMesh.position.set(0, -armLength / 2, 0);
    lArmMesh.castShadow = true;
    leftArm.add(lArmMesh);
    body.add(leftArm);
    damageFlashMeshes.push(lArmMesh);

    const rightArm = new THREE.Group();
    rightArm.position.set(torsoWidth / 2 + armThickness / 2, torsoHeight + 0.6, 0);
    const rArmMesh = new THREE.Mesh(armGeo, skinMat);
    rArmMesh.position.set(0, -armLength / 2, 0);
    rArmMesh.castShadow = true;
    rightArm.add(rArmMesh);
    body.add(rightArm);
    damageFlashMeshes.push(rArmMesh);

    // Legs
    const legLength = type === 'BOSS_GOLIATH' ? 1.1 : 0.8;
    const legThickness = type === 'BOSS_GOLIATH' ? 0.35 : type === 'TANK' ? 0.28 : 0.2;
    const legGeo = new THREE.BoxGeometry(legThickness, legLength, legThickness);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-torsoWidth * 0.25, legLength, 0);
    const lLegMesh = new THREE.Mesh(legGeo, clothMat);
    lLegMesh.position.set(0, -legLength / 2, 0);
    lLegMesh.castShadow = true;
    leftLeg.add(lLegMesh);
    body.add(leftLeg);
    damageFlashMeshes.push(lLegMesh);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(torsoWidth * 0.25, legLength, 0);
    const rLegMesh = new THREE.Mesh(legGeo, clothMat);
    rLegMesh.position.set(0, -legLength / 2, 0);
    rLegMesh.castShadow = true;
    rightLeg.add(rLegMesh);
    body.add(rightLeg);
    damageFlashMeshes.push(rLegMesh);

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
      damageFlashMeshes,
    };
  }
}
