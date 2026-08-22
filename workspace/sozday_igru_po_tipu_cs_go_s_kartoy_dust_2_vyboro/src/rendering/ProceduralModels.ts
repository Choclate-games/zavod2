import * as THREE from 'three';
import { SKINS_CATALOG, WeaponSkinDef } from '../ui/screens/ArsenalScreen';

export class ProceduralModels {
  private static instance: ProceduralModels;

  private constructor() {}

  public static getInstance(): ProceduralModels {
    if (!ProceduralModels.instance) {
      ProceduralModels.instance = new ProceduralModels();
    }
    return ProceduralModels.instance;
  }

  // ────────────────────────────────────────── WEAPONS

  public createWeaponModel(weaponId: 'ak47' | 'm4a4' | 'awp' | 'deagle', skinId?: string): THREE.Group {
    const group = new THREE.Group();
    const skinDef = SKINS_CATALOG.find((s) => s.id === skinId) || SKINS_CATALOG.find((s) => s.weaponId === weaponId);

    const matPrimary = new THREE.MeshStandardMaterial({
      color: skinDef?.weaponId === 'ak47' && skinDef.id === 'ak47_default' ? 0x8B4513 : skinDef?.weaponId === 'awp' ? 0x2E4F3E : 0x2B3540,
      roughness: 0.5,
      metalness: 0.4,
    });

    const matMetal = new THREE.MeshStandardMaterial({
      color: 0x1E252D,
      roughness: 0.3,
      metalness: 0.8,
    });

    if (weaponId === 'ak47') {
      // Receiver
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.45), matMetal);
      group.add(body);

      // Wooden Stock
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.28), matPrimary);
      stock.position.set(0, -0.02, 0.32);
      group.add(stock);

      // Wooden Handguard
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.22), matPrimary);
      handguard.position.set(0, 0.01, -0.28);
      group.add(handguard);

      // Barrel & Gas Tube
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 8), matMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.48);
      group.add(barrel);

      // Curved Magazine
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.1), matMetal);
      mag.position.set(0, -0.14, -0.06);
      mag.rotation.x = 0.3;
      group.add(mag);

      // Grip
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), matPrimary);
      grip.position.set(0, -0.11, 0.12);
      grip.rotation.x = -0.35;
      group.add(grip);
    } else if (weaponId === 'm4a4') {
      // Receiver
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.48), matMetal);
      group.add(body);

      // Tactical Stock
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.25), matPrimary);
      stock.position.set(0, 0, 0.3);
      group.add(stock);

      // Quad Rail Barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.38, 8), matMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.01, -0.42);
      group.add(barrel);

      // Straight Magazine
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.08), matMetal);
      mag.position.set(0, -0.13, -0.08);
      group.add(mag);

      // Grip
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.06), matMetal);
      grip.position.set(0, -0.11, 0.1);
      grip.rotation.x = -0.3;
      group.add(grip);
    } else if (weaponId === 'awp') {
      // Long Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.65), matPrimary);
      group.add(body);

      // Sniper Barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.6, 8), matMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.58);
      group.add(barrel);

      // Heavy Muzzle Brake
      const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), matMetal);
      muzzle.position.set(0, 0.02, -0.9);
      group.add(muzzle);

      // Optical Scope
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.35, 8), matMetal);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.12, -0.05);
      group.add(scope);

      // Grip & Stock
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.15, 0.35), matPrimary);
      stock.position.set(0, -0.03, 0.45);
      group.add(stock);
    } else {
      // Desert Eagle
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.28), matMetal);
      slide.position.set(0, 0.04, -0.02);
      group.add(slide);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14, 0.09), matPrimary);
      grip.position.set(0, -0.06, 0.06);
      grip.rotation.x = -0.25;
      group.add(grip);
    }

    return group;
  }

  // ────────────────────────────────────────── C4 BOMB

  public createC4Model(): THREE.Group {
    const group = new THREE.Group();

    // Explosive brick
    const matBrick = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
    const brick = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.24), matBrick);
    brick.castShadow = true;
    group.add(brick);

    // Keypad and LED display panel
    const matPanel = new THREE.MeshBasicMaterial({ color: 0x1E252D });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.12), matPanel);
    panel.position.set(0, 0.075, 0.02);
    group.add(panel);

    // Blinking red LED
    const matLed = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), matLed);
    led.position.set(-0.06, 0.09, 0.02);
    led.name = 'c4_led';
    group.add(led);

    // Bundled wires
    const matWireR = new THREE.MeshBasicMaterial({ color: 0xCC2222 });
    const matWireB = new THREE.MeshBasicMaterial({ color: 0x2244CC });
    const matWireY = new THREE.MeshBasicMaterial({ color: 0xCCCC22 });

    const wire1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 4), matWireR);
    wire1.rotation.z = Math.PI / 2;
    wire1.position.set(0, 0.075, -0.05);
    group.add(wire1);

    const wire2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 4), matWireB);
    wire2.rotation.z = Math.PI / 2;
    wire2.position.set(0, 0.075, -0.07);
    group.add(wire2);

    const wire3 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 4), matWireY);
    wire3.rotation.z = Math.PI / 2;
    wire3.position.set(0, 0.075, -0.09);
    group.add(wire3);

    return group;
  }

  // ────────────────────────────────────────── CHARACTERS (CT & T)

  public createCharacterModel(team: 'CT' | 'T'): THREE.Group {
    const group = new THREE.Group();

    const colorUniform = team === 'CT' ? 0x2B3D52 : 0x8C7355;
    const colorVest = team === 'CT' ? 0x1A2530 : 0x4A3C28;
    const colorSkin = 0xD2A679;

    const matUniform = new THREE.MeshLambertMaterial({ color: colorUniform });
    const matVest = new THREE.MeshLambertMaterial({ color: colorVest });
    const matSkin = new THREE.MeshLambertMaterial({ color: colorSkin });
    const matHelmet = new THREE.MeshLambertMaterial({ color: team === 'CT' ? 0x182026 : 0x3A3020 });

    // 1. Head Hitbox (Radius 0.18m)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.62, 0);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), matSkin);
    headMesh.castShadow = true;
    headMesh.userData = { hitboxType: 'head', entityGroup: group };
    headGroup.add(headMesh);

    // Helmet / Balaclava
    const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), matHelmet);
    helmetMesh.position.set(0, 0.04, 0);
    helmetMesh.userData = { hitboxType: 'head', entityGroup: group };
    headGroup.add(helmetMesh);

    group.add(headGroup);

    // 2. Chest Hitbox (0.45m x 0.45m x 0.3m)
    const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.42, 0.28), matVest);
    chestMesh.position.set(0, 1.25, 0);
    chestMesh.castShadow = true;
    chestMesh.userData = { hitboxType: 'chest', entityGroup: group };
    group.add(chestMesh);

    // 3. Stomach Hitbox (0.38m x 0.25m x 0.24m)
    const stomachMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.24), matUniform);
    stomachMesh.position.set(0, 0.95, 0);
    stomachMesh.castShadow = true;
    stomachMesh.userData = { hitboxType: 'stomach', entityGroup: group };
    group.add(stomachMesh);

    // 4. Arms (Left & Right)
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.12), matUniform);
    leftArm.position.set(-0.28, 1.2, 0.1);
    leftArm.rotation.x = 0.5;
    leftArm.userData = { hitboxType: 'chest', entityGroup: group };
    group.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.12), matUniform);
    rightArm.position.set(0.28, 1.2, 0.1);
    rightArm.rotation.x = 0.5;
    rightArm.userData = { hitboxType: 'chest', entityGroup: group };
    group.add(rightArm);

    // 5. Legs (Left & Right)
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.16), matUniform);
    leftLeg.position.set(-0.12, 0.42, 0);
    leftLeg.castShadow = true;
    leftLeg.userData = { hitboxType: 'legs', entityGroup: group };
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.16), matUniform);
    rightLeg.position.set(0.12, 0.42, 0);
    rightLeg.castShadow = true;
    rightLeg.userData = { hitboxType: 'legs', entityGroup: group };
    group.add(rightLeg);

    // Weapon attached to soldier hands
    const weaponModel = this.createWeaponModel(team === 'CT' ? 'm4a4' : 'ak47');
    weaponModel.scale.setScalar(0.85);
    weaponModel.position.set(0.15, 1.15, -0.32);
    group.add(weaponModel);

    return group;
  }
}

export const proceduralModels = ProceduralModels.getInstance();
