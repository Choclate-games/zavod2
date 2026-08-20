import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

export class ShowroomMode {
  public group = new THREE.Group();

  // Model containers
  public models: { name: string; group: THREE.Object3D }[] = [];
  public currentModelIndex = 0;

  // Character limbs for walk animation
  private charParts: {
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
  } | null = null;
  public isWalking = true;
  private walkTime = 0;

  // Car wheels for spinning
  private carWheels: THREE.Mesh[] = [];

  // Coin and Crystal
  private coinMesh: THREE.Mesh;
  private crystalMesh: THREE.Mesh;

  public isWireframe = false;
  public turntableSpeed = 0.8;

  constructor(
    private parentScene: THREE.Scene,
    private audio: AudioManager
  ) {
    this.group.visible = false;
    this.parentScene.add(this.group);

    this.buildPedestal();
    this.buildAllProceduralModels();
    this.selectModel(0);
  }

  private buildPedestal(): void {
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 3.8, 0.4, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e272e, metalness: 0.8, roughness: 0.3 })
    );
    ped.position.y = -0.2;
    ped.receiveShadow = true;
    this.group.add(ped);

    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.4, 0.08, 12, 32),
      new THREE.MeshBasicMaterial({ color: 0x00cec9 })
    );
    glowRing.rotation.x = Math.PI / 2;
    this.group.add(glowRing);
  }

  private buildAllProceduralModels(): void {
    // 1. Procedural Low-Poly Car
    const car = this.createCar();
    this.group.add(car);
    this.models.push({ name: '🚗 Автомобиль', group: car });

    // 2. Procedural Character with rigged limbs
    const char = this.createCharacter();
    this.group.add(char.root);
    this.charParts = {
      leftLeg: char.leftLeg,
      rightLeg: char.rightLeg,
      leftArm: char.leftArm,
      rightArm: char.rightArm,
    };
    this.models.push({ name: '🚶 Персонаж (Walk Cycle)', group: char.root });

    // 3. Low-Poly Forest Tree
    const tree = this.createTree();
    this.group.add(tree);
    this.models.push({ name: '🌲 Дерево (Low-Poly)', group: tree });

    // 4. Wooden Crate with metal brackets
    const crate = this.createCrate();
    this.group.add(crate);
    this.models.push({ name: '📦 Ящик с окантовкой', group: crate });

    // 5. Spinning Golden Coin
    this.coinMesh = this.createCoin();
    this.group.add(this.coinMesh);
    this.models.push({ name: '💰 Золотая монета', group: this.coinMesh });

    // 6. Magic Faceted Crystal
    this.crystalMesh = this.createCrystal();
    this.group.add(this.crystalMesh);
    this.models.push({ name: '💎 Магический кристалл', group: this.crystalMesh });

    // 7. Medieval Knight
    const knight = this.createKnight();
    this.group.add(knight);
    this.models.push({ name: '🛡️ Рыцарь со щитом', group: knight });

    // 8. Industrial Barrel
    const barrel = this.createBarrel();
    this.group.add(barrel);
    this.models.push({ name: '🛢️ Бочка', group: barrel });
  }

  private createCar(): THREE.Group {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd63031, roughness: 0.25, metalness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x111625, roughness: 0.1, metalness: 0.9 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.8 });

    // Chassis body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 3.4), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    car.add(body);

    // Cabin roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 1.6), glassMat);
    roof.position.set(0, 0.95, -0.15);
    roof.castShadow = true;
    car.add(roof);

    // Headlights
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfffa65 });
    const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.05), lightMat);
    lightL.position.set(-0.55, 0.58, -1.72);
    const lightR = lightL.clone();
    lightR.position.x = 0.55;
    car.add(lightL, lightR);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 14);
    wheelGeo.rotateZ(Math.PI / 2);

    const offsets = [
      [-0.85, 0.35, -1.05],
      [0.85, 0.35, -1.05],
      [-0.85, 0.35, 1.05],
      [0.85, 0.35, 1.05],
    ];

    offsets.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, rubberMat);
      wheel.position.set(x, y, z);
      wheel.castShadow = true;
      car.add(wheel);
      this.carWheels.push(wheel);
    });

    return car;
  }

  private createCharacter(): {
    root: THREE.Group;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
  } {
    const root = new THREE.Group();
    const matClothes = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.7 });
    const matSkin = new THREE.MeshStandardMaterial({ color: 0xffcaa6, roughness: 0.6 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.5 });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.32), matClothes);
    torso.position.y = 1.15;
    torso.castShadow = true;
    root.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), matSkin);
    head.position.set(0, 1.68, 0);
    head.castShadow = true;
    root.add(head);

    // Legs with top pivot
    const legGeo = new THREE.BoxGeometry(0.18, 0.55, 0.2);
    legGeo.translate(0, -0.275, 0);

    const leftLeg = new THREE.Mesh(legGeo, matDark);
    leftLeg.position.set(-0.16, 0.82, 0);
    leftLeg.castShadow = true;
    root.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, matDark);
    rightLeg.position.set(0.16, 0.82, 0);
    rightLeg.castShadow = true;
    root.add(rightLeg);

    // Arms with shoulder pivot
    const armGeo = new THREE.BoxGeometry(0.14, 0.55, 0.16);
    armGeo.translate(0, -0.275, 0);

    const leftArm = new THREE.Mesh(armGeo, matClothes);
    leftArm.position.set(-0.36, 1.42, 0);
    leftArm.castShadow = true;
    root.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, matClothes);
    rightArm.position.set(0.36, 1.42, 0);
    rightArm.castShadow = true;
    root.add(rightArm);

    return { root, leftLeg, rightLeg, leftArm, rightArm };
  }

  private createTree(): THREE.Group {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.35, 1.8, 6),
      new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.9 })
    );
    trunk.position.y = 0.9;
    trunk.castShadow = true;
    tree.add(trunk);

    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.6, flatShading: true });
    const crown1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), leavesMat);
    crown1.position.y = 2.4;
    crown1.castShadow = true;

    const crown2 = crown1.clone();
    crown2.scale.set(0.85, 0.85, 0.85);
    crown2.position.y = 3.2;

    tree.add(crown1, crown2);
    return tree;
  }

  private createCrate(): THREE.Group {
    const crate = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.85 })
    );
    body.position.y = 0.7;
    body.castShadow = true;
    crate.add(body);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.44, 0.14, 1.44),
      new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.8 })
    );
    frame.position.y = 0.7;
    crate.add(frame);
    return crate;
  }

  private createCoin(): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(0.9, 0.9, 0.16, 24);
    geo.rotateX(Math.PI / 2);
    const coin = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.9, roughness: 0.2 })
    );
    coin.position.y = 1.4;
    coin.castShadow = true;
    return coin;
  }

  private createCrystal(): THREE.Mesh {
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1, 0),
      new THREE.MeshStandardMaterial({
        color: 0x9b59b6,
        roughness: 0.1,
        metalness: 0.3,
        transparent: true,
        opacity: 0.85,
      })
    );
    crystal.scale.set(0.8, 1.4, 0.8);
    crystal.position.y = 1.5;
    crystal.castShadow = true;
    return crystal;
  }

  private createKnight(): THREE.Group {
    const knight = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.9, roughness: 0.2 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), armorMat);
    body.position.y = 1.0;
    body.castShadow = true;

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), armorMat);
    head.position.y = 1.6;
    head.castShadow = true;

    const shield = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.6, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.4 })
    );
    shield.position.set(-0.4, 1.0, 0.2);

    knight.add(body, head, shield);
    return knight;
  }

  private createBarrel(): THREE.Group {
    const barrel = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 1.4, 16),
      new THREE.MeshStandardMaterial({ color: 0x2980b9, roughness: 0.4, metalness: 0.5 })
    );
    body.position.y = 0.7;
    body.castShadow = true;

    const rim1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.67, 0.67, 0.1, 16),
      new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.9 })
    );
    rim1.position.y = 0.35;
    const rim2 = rim1.clone();
    rim2.position.y = 1.05;

    barrel.add(body, rim1, rim2);
    return barrel;
  }

  public selectModel(index: number): void {
    this.currentModelIndex = (index + this.models.length) % this.models.length;
    this.models.forEach((m, idx) => {
      m.group.visible = idx === this.currentModelIndex;
      m.group.rotation.set(0, 0, 0);
    });
    this.audio.playButtonClick();
  }

  public toggleWireframe(): boolean {
    this.isWireframe = !this.isWireframe;
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => { m.wireframe = this.isWireframe; });
        } else if (mat) {
          mat.wireframe = this.isWireframe;
        }
      }
    });
    this.audio.playButtonClick();
    return this.isWireframe;
  }

  public update(dt: number): void {
    if (!this.group.visible) return;

    // 1. Turntable rotation of current active model
    const active = this.models[this.currentModelIndex];
    if (active) {
      active.group.rotation.y += this.turntableSpeed * dt;
    }

    // 2. Character Walk Cycle Animation
    if (this.currentModelIndex === 1 && this.charParts) {
      this.walkTime += dt;
      const swing = Math.sin(this.walkTime * 8.0) * 0.65;
      this.charParts.leftLeg.rotation.x = swing;
      this.charParts.rightLeg.rotation.x = -swing;
      this.charParts.leftArm.rotation.x = -swing * 0.75;
      this.charParts.rightArm.rotation.x = swing * 0.75;
    }

    // 3. Car wheels spinning
    if (this.currentModelIndex === 0) {
      this.carWheels.forEach((w) => {
        w.rotation.x += 4.0 * dt;
      });
    }

    // 4. Coin & Crystal Floating Bobbing
    if (this.currentModelIndex === 4 && this.coinMesh) {
      this.coinMesh.rotation.z += 2.5 * dt;
    }
    if (this.currentModelIndex === 5 && this.crystalMesh) {
      this.crystalMesh.rotation.x += 0.8 * dt;
      this.crystalMesh.rotation.z += 0.5 * dt;
      this.crystalMesh.position.y = 1.5 + Math.sin(Date.now() * 0.003) * 0.15;
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
