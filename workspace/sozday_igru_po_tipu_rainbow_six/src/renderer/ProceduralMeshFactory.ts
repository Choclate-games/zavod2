import * as THREE from "three";
import type { WeaponId, ShieldLevel, EnemyType, WireColor } from "../core/Types";

export class ProceduralMeshFactory {
  private static matDarkKevlar = new THREE.MeshStandardMaterial({
    color: 0x1a1e24,
    roughness: 0.7,
    metalness: 0.2,
  });

  private static matGunMetal = new THREE.MeshStandardMaterial({
    color: 0x2b3038,
    roughness: 0.4,
    metalness: 0.7,
  });

  private static matTitanium = new THREE.MeshStandardMaterial({
    color: 0x485058,
    roughness: 0.35,
    metalness: 0.6,
  });

  private static matShieldGlass = new THREE.MeshPhysicalMaterial({
    color: 0x4deeea,
    transparent: true,
    opacity: 0.5,
    roughness: 0.1,
    transmission: 0.8,
    ior: 1.45,
    thickness: 0.1,
  });

  private static matDrywall = new THREE.MeshStandardMaterial({
    color: 0x8a929a,
    roughness: 0.9,
    metalness: 0.05,
  });

  private static matDrywallInside = new THREE.MeshStandardMaterial({
    color: 0x6e7680,
    roughness: 0.95,
    metalness: 0.0,
  });

  private static matReinforcedWall = new THREE.MeshStandardMaterial({
    color: 0x3d434a,
    roughness: 0.7,
    metalness: 0.5,
  });

  private static matWoodDoor = new THREE.MeshStandardMaterial({
    color: 0x4a3222,
    roughness: 0.8,
    metalness: 0.1,
  });

  private static matEnemySkin = new THREE.MeshStandardMaterial({
    color: 0x3b444b,
    roughness: 0.8,
    metalness: 0.1,
  });

  private static matEnemyArmor = new THREE.MeshStandardMaterial({
    color: 0x1f2429,
    roughness: 0.5,
    metalness: 0.4,
  });

  private static matEnemyGoggles = new THREE.MeshBasicMaterial({
    color: 0xff1e27,
  });

  private static matLaser = new THREE.MeshBasicMaterial({
    color: 0xff1e27,
    transparent: true,
    opacity: 0.75,
  });

  private static matC4Block = new THREE.MeshStandardMaterial({
    color: 0xa89379,
    roughness: 0.9,
    metalness: 0.0,
  });

  private static matLedGreen = new THREE.MeshBasicMaterial({
    color: 0x00ff66,
  });

  private static matLedOrange = new THREE.MeshBasicMaterial({
    color: 0xff6a00,
  });

  static createBallisticShield(level: ShieldLevel): THREE.Group {
    const root = new THREE.Group();
    root.name = "BallisticShieldRoot";

    const plateGeo = new THREE.BoxGeometry(0.7, 1.25, 0.04);
    const plate = new THREE.Mesh(plateGeo, this.matTitanium);
    plate.castShadow = true;
    plate.receiveShadow = true;
    root.add(plate);

    const borderGeo = new THREE.BoxGeometry(0.74, 1.29, 0.02);
    const border = new THREE.Mesh(borderGeo, this.matDarkKevlar);
    border.position.z = -0.02;
    root.add(border);

    const glassGeo = new THREE.BoxGeometry(0.38, 0.18, 0.045);
    const glass = new THREE.Mesh(glassGeo, this.matShieldGlass);
    glass.position.set(0, 0.32, 0.005);
    glass.name = "ShieldViewportGlass";
    root.add(glass);

    const frameGeo = new THREE.BoxGeometry(0.42, 0.22, 0.05);
    const frame = new THREE.Mesh(frameGeo, this.matGunMetal);
    frame.position.set(0, 0.32, 0);
    root.add(frame);

    const handleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
    const handle = new THREE.Mesh(handleGeo, this.matDarkKevlar);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 0, -0.12);
    root.add(handle);

    if (level >= 2) {
      const strobeGeo = new THREE.BoxGeometry(0.12, 0.06, 0.05);
      const strobe = new THREE.Mesh(strobeGeo, this.matLedOrange);
      strobe.position.set(0, 0.58, 0.02);
      strobe.name = "ShieldStrobeLight";
      root.add(strobe);
    }

    if (level >= 3) {
      const stripeGeo = new THREE.BoxGeometry(0.66, 0.08, 0.042);
      const stripe1 = new THREE.Mesh(stripeGeo, this.matDarkKevlar);
      stripe1.position.set(0, -0.25, 0.005);
      const stripe2 = new THREE.Mesh(stripeGeo, this.matDarkKevlar);
      stripe2.position.set(0, -0.45, 0.005);
      root.add(stripe1, stripe2);
    }

    return root;
  }

  static createWeaponMesh(weaponId: WeaponId): THREE.Group {
    const root = new THREE.Group();
    root.name = `Weapon_${weaponId}`;

    if (weaponId === "pistol_p9") {
      const slideGeo = new THREE.BoxGeometry(0.045, 0.06, 0.22);
      const slide = new THREE.Mesh(slideGeo, this.matGunMetal);
      slide.position.set(0, 0.03, 0.04);
      slide.castShadow = true;
      root.add(slide);

      const gripGeo = new THREE.BoxGeometry(0.04, 0.12, 0.065);
      const grip = new THREE.Mesh(gripGeo, this.matDarkKevlar);
      grip.position.set(0, -0.05, -0.03);
      grip.rotation.x = -0.22;
      root.add(grip);

      const muzzleNode = new THREE.Object3D();
      muzzleNode.name = "MuzzleNode";
      muzzleNode.position.set(0, 0.03, 0.16);
      root.add(muzzleNode);
    } else if (weaponId === "smg_mp5") {
      const bodyGeo = new THREE.BoxGeometry(0.055, 0.08, 0.32);
      const body = new THREE.Mesh(bodyGeo, this.matGunMetal);
      body.position.set(0, 0.02, 0.02);
      body.castShadow = true;
      root.add(body);

      const barrelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.18, 12);
      const barrel = new THREE.Mesh(barrelGeo, this.matDarkKevlar);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, 0.26);
      root.add(barrel);

      const magGeo = new THREE.BoxGeometry(0.035, 0.18, 0.05);
      const mag = new THREE.Mesh(magGeo, this.matGunMetal);
      mag.position.set(0, -0.09, 0.08);
      mag.rotation.x = 0.25;
      root.add(mag);

      const gripGeo = new THREE.BoxGeometry(0.042, 0.13, 0.06);
      const grip = new THREE.Mesh(gripGeo, this.matDarkKevlar);
      grip.position.set(0, -0.06, -0.08);
      grip.rotation.x = -0.2;
      root.add(grip);

      const sightGeo = new THREE.BoxGeometry(0.04, 0.05, 0.08);
      const sight = new THREE.Mesh(sightGeo, this.matDarkKevlar);
      sight.position.set(0, 0.085, 0.02);
      root.add(sight);

      const muzzleNode = new THREE.Object3D();
      muzzleNode.name = "MuzzleNode";
      muzzleNode.position.set(0, 0.02, 0.36);
      root.add(muzzleNode);
    } else if (weaponId === "shotgun_m870") {
      const barrelGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.45, 10);
      const barrel = new THREE.Mesh(barrelGeo, this.matGunMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.03, 0.18);
      barrel.castShadow = true;
      root.add(barrel);

      const tubeGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.4, 10);
      const tube = new THREE.Mesh(tubeGeo, this.matGunMetal);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0, -0.015, 0.16);
      root.add(tube);

      const pumpGeo = new THREE.BoxGeometry(0.065, 0.065, 0.16);
      const pump = new THREE.Mesh(pumpGeo, this.matDarkKevlar);
      pump.position.set(0, -0.015, 0.18);
      root.add(pump);

      const gripGeo = new THREE.BoxGeometry(0.045, 0.14, 0.12);
      const grip = new THREE.Mesh(gripGeo, this.matDarkKevlar);
      grip.position.set(0, -0.06, -0.12);
      grip.rotation.x = -0.35;
      root.add(grip);

      const muzzleNode = new THREE.Object3D();
      muzzleNode.name = "MuzzleNode";
      muzzleNode.position.set(0, 0.03, 0.42);
      root.add(muzzleNode);
    } else if (weaponId === "revolver_rhino") {
      const frameGeo = new THREE.BoxGeometry(0.05, 0.09, 0.2);
      const frame = new THREE.Mesh(frameGeo, this.matGunMetal);
      frame.position.set(0, 0.02, 0.04);
      frame.castShadow = true;
      root.add(frame);

      const cylGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.07, 8);
      const cyl = new THREE.Mesh(cylGeo, this.matDarkKevlar);
      cyl.rotation.z = Math.PI / 2;
      cyl.position.set(0, 0.02, -0.02);
      root.add(cyl);

      const gripGeo = new THREE.BoxGeometry(0.045, 0.14, 0.07);
      const grip = new THREE.Mesh(gripGeo, this.matDarkKevlar);
      grip.position.set(0, -0.07, -0.08);
      grip.rotation.x = -0.28;
      root.add(grip);

      const muzzleNode = new THREE.Object3D();
      muzzleNode.name = "MuzzleNode";
      muzzleNode.position.set(0, -0.005, 0.18);
      root.add(muzzleNode);
    }

    return root;
  }

  static createDestructibleWallMesh(
    width: number,
    height: number,
    depth: number,
    isReinforced: boolean,
    isDoor: boolean
  ): { intactMesh: THREE.Group; fracturedMesh: THREE.Group; debrisPieces: { hx: number; hy: number; hz: number; mesh: THREE.Mesh }[] } {
    const intactMesh = new THREE.Group();
    const fracturedMesh = new THREE.Group();
    const debrisPieces: { hx: number; hy: number; hz: number; mesh: THREE.Mesh }[] = [];

    const wallMat = isDoor ? this.matWoodDoor : isReinforced ? this.matReinforcedWall : this.matDrywall;

    const solidGeo = new THREE.BoxGeometry(width, height, depth);
    const solid = new THREE.Mesh(solidGeo, wallMat);
    solid.castShadow = true;
    solid.receiveShadow = true;
    intactMesh.add(solid);

    const markerGeo = new THREE.BoxGeometry(0.4, 0.4, depth + 0.01);
    const marker = new THREE.Mesh(markerGeo, isReinforced ? this.matLedOrange : this.matLedGreen);
    intactMesh.add(marker);

    const holeWidth = width * 0.58;
    const holeHeight = height * 0.72;
    const sideW = (width - holeWidth) / 2;
    const topH = (height - holeHeight) / 2;

    const leftCol = new THREE.Mesh(new THREE.BoxGeometry(sideW, height, depth), wallMat);
    leftCol.position.x = -width / 2 + sideW / 2;
    fracturedMesh.add(leftCol);

    const rightCol = new THREE.Mesh(new THREE.BoxGeometry(sideW, height, depth), wallMat);
    rightCol.position.x = width / 2 - sideW / 2;
    fracturedMesh.add(rightCol);

    const topHead = new THREE.Mesh(new THREE.BoxGeometry(holeWidth, topH, depth), wallMat);
    topHead.position.y = height / 2 - topH / 2;
    fracturedMesh.add(topHead);

    const botSill = new THREE.Mesh(new THREE.BoxGeometry(holeWidth, topH, depth), wallMat);
    botSill.position.y = -height / 2 + topH / 2;
    fracturedMesh.add(botSill);

    fracturedMesh.visible = false;

    const fragmentCount = 28;
    const rows = 7;
    const cols = 4;
    const pieceW = holeWidth / cols;
    const pieceH = holeHeight / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (debrisPieces.length >= fragmentCount) break;
        const jitterX = 0.8 + Math.random() * 0.4;
        const jitterY = 0.8 + Math.random() * 0.4;
        const hx = (pieceW * 0.5 * jitterX);
        const hy = (pieceH * 0.5 * jitterY);
        const hz = (depth * 0.5 * (0.8 + Math.random() * 0.4));

        const geo = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2);
        const dMesh = new THREE.Mesh(geo, this.matDrywallInside);
        dMesh.castShadow = true;
        dMesh.receiveShadow = true;
        dMesh.visible = false;

        debrisPieces.push({ hx, hy, hz, mesh: dMesh });
      }
    }

    return { intactMesh, fracturedMesh, debrisPieces };
  }

  static createEnemyMesh(type: EnemyType, hasArmor: boolean): { root: THREE.Group; headNode: THREE.Group; chestNode: THREE.Group; weaponNode: THREE.Group } {
    const root = new THREE.Group();
    root.name = `Enemy_${type}`;

    const legGeo = new THREE.BoxGeometry(0.16, 0.75, 0.18);
    const leftLeg = new THREE.Mesh(legGeo, this.matDarkKevlar);
    leftLeg.position.set(-0.12, 0.38, 0);
    leftLeg.castShadow = true;
    const rightLeg = new THREE.Mesh(legGeo, this.matDarkKevlar);
    rightLeg.position.set(0.12, 0.38, 0);
    rightLeg.castShadow = true;
    root.add(leftLeg, rightLeg);

    const chestNode = new THREE.Group();
    chestNode.position.set(0, 1.1, 0);
    root.add(chestNode);

    const torsoGeo = new THREE.BoxGeometry(0.42, 0.65, 0.26);
    const torso = new THREE.Mesh(torsoGeo, hasArmor ? this.matEnemyArmor : this.matEnemySkin);
    torso.castShadow = true;
    chestNode.add(torso);

    if (hasArmor) {
      const plateGeo = new THREE.BoxGeometry(0.36, 0.45, 0.3);
      const plate = new THREE.Mesh(plateGeo, this.matDarkKevlar);
      plate.position.set(0, 0.02, 0.02);
      chestNode.add(plate);
    }

    const armGeo = new THREE.BoxGeometry(0.12, 0.55, 0.12);
    const leftArm = new THREE.Mesh(armGeo, this.matEnemySkin);
    leftArm.position.set(-0.28, 0.05, 0.18);
    leftArm.rotation.x = -0.7;
    const rightArm = new THREE.Mesh(armGeo, this.matEnemySkin);
    rightArm.position.set(0.28, 0.05, 0.18);
    rightArm.rotation.x = -0.7;
    chestNode.add(leftArm, rightArm);

    const weaponNode = new THREE.Group();
    weaponNode.position.set(0.1, -0.05, 0.42);
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.5), this.matGunMetal);
    gunBody.castShadow = true;
    weaponNode.add(gunBody);

    const laserBeamGeo = new THREE.CylinderGeometry(0.008, 0.008, 12, 6);
    const laserBeam = new THREE.Mesh(laserBeamGeo, this.matLaser);
    laserBeam.rotation.x = Math.PI / 2;
    laserBeam.position.set(0, 0.02, 6.2);
    laserBeam.name = "EnemyLaserBeam";
    weaponNode.add(laserBeam);

    chestNode.add(weaponNode);

    const headNode = new THREE.Group();
    headNode.position.set(0, 1.55, 0);
    headNode.name = "EnemyHeadNode";
    root.add(headNode);

    const headGeo = new THREE.SphereGeometry(0.15, 12, 10);
    const head = new THREE.Mesh(headGeo, this.matDarkKevlar);
    head.castShadow = true;
    headNode.add(head);

    const gogglesGeo = new THREE.BoxGeometry(0.18, 0.06, 0.08);
    const goggles = new THREE.Mesh(gogglesGeo, this.matEnemyGoggles);
    goggles.position.set(0, 0.02, 0.13);
    headNode.add(goggles);

    if (type === "syndicate_heavy") {
      const helmetGeo = new THREE.CylinderGeometry(0.18, 0.17, 0.14, 12);
      const helmet = new THREE.Mesh(helmetGeo, this.matTitanium);
      helmet.position.set(0, 0.08, 0);
      headNode.add(helmet);
    }

    return { root, headNode, chestNode, weaponNode };
  }

  static createC4ChargeMesh(): THREE.Group {
    const root = new THREE.Group();
    root.name = "C4Charge";

    const blockGeo = new THREE.BoxGeometry(0.24, 0.12, 0.05);
    const block = new THREE.Mesh(blockGeo, this.matC4Block);
    root.add(block);

    const packGeo = new THREE.BoxGeometry(0.08, 0.05, 0.04);
    const pack = new THREE.Mesh(packGeo, this.matDarkKevlar);
    pack.position.set(0, 0, 0.035);
    root.add(pack);

    const ledGeo = new THREE.SphereGeometry(0.015, 8, 8);
    const led = new THREE.Mesh(ledGeo, this.matLedGreen);
    led.position.set(0.025, 0, 0.055);
    led.name = "C4StatusLED";
    root.add(led);

    return root;
  }

  static createBombMesh(_targetWire: WireColor): { root: THREE.Group; wireMeshes: Map<WireColor, THREE.Mesh>; timerDisplay: THREE.Mesh } {
    const root = new THREE.Group();
    root.name = "BombTerminal";

    const caseGeo = new THREE.BoxGeometry(0.55, 0.35, 0.42);
    const box = new THREE.Mesh(caseGeo, this.matDarkKevlar);
    box.castShadow = true;
    box.receiveShadow = true;
    root.add(box);

    const c4_1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.34), this.matC4Block);
    c4_1.position.set(-0.13, 0.12, 0);
    const c4_2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.34), this.matC4Block);
    c4_2.position.set(0.13, 0.12, 0);
    root.add(c4_1, c4_2);

    const board = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.22), this.matGunMetal);
    board.position.set(0, 0.18, 0);
    root.add(board);

    const display = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.08), this.matEnemyGoggles);
    display.position.set(0, 0.21, -0.04);
    display.name = "BombTimerDisplay";
    root.add(display);

    const wireMeshes = new Map<WireColor, THREE.Mesh>();

    const colors: { color: WireColor; hex: number; x: number }[] = [
      { color: "red", hex: 0xff1e27, x: -0.07 },
      { color: "blue", hex: 0x4deeea, x: 0.0 },
      { color: "yellow", hex: 0xff6a00, x: 0.07 },
    ];

    colors.forEach(({ color, hex, x }) => {
      const wireMat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.4, metalness: 0.3 });
      const wireGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8);
      const wire = new THREE.Mesh(wireGeo, wireMat);
      wire.rotation.x = Math.PI / 2;
      wire.position.set(x, 0.21, 0.04);
      wire.name = `BombWire_${color}`;
      root.add(wire);
      wireMeshes.set(color, wire);
    });

    return { root, wireMeshes, timerDisplay: display };
  }

  static createTripmineMesh(beamLength: number, dir: "x" | "z"): { root: THREE.Group; beamMesh: THREE.Mesh } {
    const root = new THREE.Group();
    root.name = "TripmineTrap";

    const baseGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.12, 10);
    const base = new THREE.Mesh(baseGeo, this.matDarkKevlar);
    base.rotation.z = dir === "x" ? Math.PI / 2 : 0;
    base.rotation.x = dir === "z" ? Math.PI / 2 : 0;
    root.add(base);

    const beamGeo = new THREE.CylinderGeometry(0.006, 0.006, beamLength, 6);
    const beam = new THREE.Mesh(beamGeo, this.matLaser);

    if (dir === "x") {
      beam.rotation.z = Math.PI / 2;
      beam.position.x = beamLength / 2;
    } else {
      beam.rotation.x = Math.PI / 2;
      beam.position.z = beamLength / 2;
    }

    beam.name = "TripmineLaserBeam";
    root.add(beam);

    return { root, beamMesh: beam };
  }
}
