import * as THREE from 'three';

export interface FighterRig {
  root: THREE.Group;
  torso: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  setFlash(amount: number): void;
}

/**
 * Процедурный low-poly боец: никаких .gltf, всё генерируется кодом.
 *
 * Правило вложенных групп (CRITICAL_RULES §55): рука, которая и вращается в
 * плече, и наклоняется, — это группа внутри группы. Один Object3D с
 * Euler('XYZ') на обе степени свободы визуально скручивает конечность.
 */
export function buildFighter(suit: number, skin: number): FighterRig {
  const root = new THREE.Group();

  const suitMat = new THREE.MeshStandardMaterial({ color: suit, roughness: 0.55, metalness: 0.1 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x241c2c, roughness: 0.9 });

  const torso = new THREE.Group();
  torso.position.y = 1.05;
  root.add(torso);

  const chest = mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), suitMat);
  chest.position.y = 0.1;
  torso.add(chest);

  const head = mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skinMat);
  head.position.y = 0.66;
  torso.add(head);

  const brow = mesh(new THREE.BoxGeometry(0.36, 0.09, 0.34), darkMat);
  brow.position.set(0, 0.74, 0.01);
  torso.add(brow);

  // Плечо (группа) → предплечье (меш внутри): две степени свободы, две группы.
  const armR = limb(suitMat, skinMat);
  armR.position.set(0.42, 0.35, 0);
  torso.add(armR);

  const armL = limb(suitMat, skinMat);
  armL.position.set(-0.42, 0.35, 0);
  torso.add(armL);

  for (const side of [-1, 1]) {
    const leg = mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), darkMat);
    leg.position.set(side * 0.17, 0.36, 0);
    root.add(leg);
    const foot = mesh(new THREE.BoxGeometry(0.28, 0.14, 0.42), suitMat);
    foot.position.set(side * 0.17, 0.07, 0.06);
    root.add(foot);
  }

  const emissiveTargets = [suitMat, skinMat];
  return {
    root,
    torso,
    armL,
    armR,
    setFlash(amount: number) {
      for (const m of emissiveTargets) {
        m.emissive.setRGB(amount * 0.9, amount * 0.15, amount * 0.15);
      }
    },
  };
}

function limb(upper: THREE.Material, lower: THREE.Material): THREE.Group {
  const shoulder = new THREE.Group();
  const arm = mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), upper);
  arm.position.y = -0.25;
  shoulder.add(arm);

  const forearm = new THREE.Group();
  forearm.position.y = -0.5;
  shoulder.add(forearm);

  const hand = mesh(new THREE.BoxGeometry(0.22, 0.34, 0.22), lower);
  hand.position.y = -0.17;
  forearm.add(hand);
  return shoulder;
}

function mesh(geom: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geom, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
