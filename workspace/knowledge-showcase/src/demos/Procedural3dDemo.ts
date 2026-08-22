import * as THREE from 'three';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import { computeWalkAngles, type LimbRotations } from '../game/proceduralMesh';

export class ProceduralMeshFactory {
  public static materials = {
    carRed: new THREE.MeshStandardMaterial({ color: 0xd63031, roughness: 0.25, metalness: 0.6 }),
    carBlue: new THREE.MeshStandardMaterial({ color: 0x0984e3, roughness: 0.25, metalness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x111625, roughness: 0.1, metalness: 0.9 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.8 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xffcaa6, roughness: 0.6 }),
    clothesGreen: new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.7 }),
    clothesOrange: new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.7 }),
    clothesPurple: new THREE.MeshStandardMaterial({ color: 0x8e44ad, roughness: 0.7 }),
    metalDark: new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.4, metalness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.85 }),
    leaves: new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.6, flatShading: true }),
    gold: new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.2, metalness: 0.9 }),
    crystal: new THREE.MeshStandardMaterial({ color: 0x9b59b6, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 }),
  };

  public static createCar(colorMaterial = ProceduralMeshFactory.materials.carRed): THREE.Group {
    const car = new THREE.Group();

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 3.4), colorMaterial);
    body.position.y = 0.4;
    body.castShadow = true;
    car.add(body);

    // Roof / Cabin
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 1.6), ProceduralMeshFactory.materials.glass);
    roof.position.set(0, 0.78, -0.15);
    roof.castShadow = true;
    car.add(roof);

    // Headlights
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfffa65 });
    const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.05), lightMat);
    lightL.position.set(-0.55, 0.45, -1.72);
    const lightR = lightL.clone();
    lightR.position.x = 0.55;
    car.add(lightL, lightR);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 14);
    wheelGeo.rotateZ(Math.PI / 2);

    const offsets = [
      [-0.85, 0.32, -1.05],
      [0.85, 0.32, -1.05],
      [-0.85, 0.32, 1.05],
      [0.85, 0.32, 1.05],
    ];

    offsets.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, ProceduralMeshFactory.materials.rubber);
      wheel.position.set(x, y, z);
      wheel.castShadow = true;
      car.add(wheel);
    });

    return car;
  }

  public static createCharacter(clothesMat = ProceduralMeshFactory.materials.clothesGreen): {
    root: THREE.Group;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
  } {
    const root = new THREE.Group();

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.32), clothesMat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    root.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), ProceduralMeshFactory.materials.skin);
    head.position.set(0, 1.55, 0);
    head.castShadow = true;
    root.add(head);

    // Legs with top pivot offset
    const legGeo = new THREE.BoxGeometry(0.18, 0.55, 0.2);
    legGeo.translate(0, -0.275, 0);

    const leftLeg = new THREE.Mesh(legGeo, ProceduralMeshFactory.materials.metalDark);
    leftLeg.position.set(-0.16, 0.72, 0);
    leftLeg.castShadow = true;
    root.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, ProceduralMeshFactory.materials.metalDark);
    rightLeg.position.set(0.16, 0.72, 0);
    rightLeg.castShadow = true;
    root.add(rightLeg);

    // Arms with top pivot offset
    const armGeo = new THREE.BoxGeometry(0.14, 0.55, 0.16);
    armGeo.translate(0, -0.275, 0);

    const leftArm = new THREE.Mesh(armGeo, clothesMat);
    leftArm.position.set(-0.36, 1.32, 0);
    leftArm.castShadow = true;
    root.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, clothesMat);
    rightArm.position.set(0.36, 1.32, 0);
    rightArm.castShadow = true;
    root.add(rightArm);

    return { root, leftLeg, rightLeg, leftArm, rightArm };
  }

  public static createTree(): THREE.Group {
    const tree = new THREE.Group();

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 1.8, 6),
      ProceduralMeshFactory.materials.wood,
    );
    trunk.position.y = 0.9;
    trunk.castShadow = true;
    tree.add(trunk);

    const crownGeo1 = new THREE.IcosahedronGeometry(1.2, 0);
    const crown1 = new THREE.Mesh(crownGeo1, ProceduralMeshFactory.materials.leaves);
    crown1.position.y = 2.4;
    crown1.castShadow = true;

    const crown2 = crown1.clone();
    crown2.scale.set(0.85, 0.85, 0.85);
    crown2.position.y = 3.2;

    tree.add(crown1, crown2);
    return tree;
  }

  public static createCrate(size = 1.0): THREE.Group {
    const crate = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), ProceduralMeshFactory.materials.wood);
    body.position.y = size / 2;
    body.castShadow = true;
    crate.add(body);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(size * 1.02, size * 0.1, size * 1.02),
      ProceduralMeshFactory.materials.metalDark,
    );
    frame.position.y = size / 2;
    crate.add(frame);

    return crate;
  }

  public static createCoin(radius = 0.4): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(radius, radius, 0.08, 16);
    geo.rotateX(Math.PI / 2);
    const coin = new THREE.Mesh(geo, ProceduralMeshFactory.materials.gold);
    coin.castShadow = true;
    return coin;
  }

  public static createCrystal(): THREE.Group {
    const group = new THREE.Group();
    const geo = new THREE.OctahedronGeometry(0.8, 0);
    geo.scale(0.8, 1.4, 0.8);
    const crystal = new THREE.Mesh(geo, ProceduralMeshFactory.materials.crystal);
    crystal.position.y = 1.2;
    crystal.castShadow = true;
    group.add(crystal);
    return group;
  }
}

type ModelType = 'character' | 'car' | 'tree' | 'crate' | 'coin' | 'crystal';

export class Procedural3dDemo implements Demo {
  readonly id = 'procedural3d';
  readonly title = ['🎨 Процедурная 3D-графика', '🎨 Procedural 3D Mesh Builder'] as const;
  readonly hint = [
    '<b>1..6</b> выбор модели (1: Герой, 2: Машина, 3: Дерево, 4: Ящик, 5: Монета, 6: Кристалл)'
    + ' · <b>WASD</b> двигать героя (процедурная походка) · <b>Space</b> реген цвета · <b>R</b> сброс',
    '<b>1..6</b> select model (1: Hero, 2: Car, 3: Tree, 4: Crate, 5: Coin, 6: Crystal)'
    + ' · <b>WASD</b> move character (procedural walk) · <b>Space</b> randomize color · <b>R</b> reset',
  ] as const;
  readonly category = ['🎨 Графика и шейдеры', '🎨 Graphics & Shaders'] as const;
  readonly tags = ['процедурная', 'графика', 'модели', 'генерация', 'low-poly', 'анимация', 'mesh', 'procedural', 'builder', 'character'] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.5, 120);

  private ctx!: DemoContext;
  private currentType: ModelType = 'character';
  private currentRoot: THREE.Group | THREE.Mesh | null = null;

  // Character parts for animation
  private charParts: {
    leftLeg?: THREE.Mesh;
    rightLeg?: THREE.Mesh;
    leftArm?: THREE.Mesh;
    rightArm?: THREE.Mesh;
  } = {};
  private limbRotations: LimbRotations = { leftLegX: 0, rightLegX: 0, leftArmX: 0, rightArmX: 0 };
  private walkTime = 0;
  private charPos = new THREE.Vector3(0, 0, 0);
  private charHeading = 0;

  // Benchmark stats
  private lastBuildTimeMs = 0;
  private triangleCount = 0;
  private colorVariant = 0;

  private pedestal!: THREE.Mesh;
  private unsubscribeKey: (() => void) | null = null;

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.scene.background = new THREE.Color(0x131722);
    this.scene.fog = new THREE.FogExp2(0x131722, 0.02);

    const dirLight = new THREE.DirectionalLight(0xfff5ea, 1.4);
    dirLight.position.set(12, 20, 10);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x4080ff, 0.8);
    rimLight.position.set(-10, 10, -10);
    this.scene.add(rimLight);

    this.scene.add(new THREE.HemisphereLight(0x445566, 0x111122, 0.6));

    this.buildStudio();
    this.rebuildModel();

    this.camera.position.set(0, 4.5, 7.5);
    this.camera.lookAt(0, 1.2, 0);
  }

  enter(): void {
    this.unsubscribeKey = this.ctx.input.onKey((code) => {
      if (code === 'Digit1') this.selectModel('character');
      else if (code === 'Digit2') this.selectModel('car');
      else if (code === 'Digit3') this.selectModel('tree');
      else if (code === 'Digit4') this.selectModel('crate');
      else if (code === 'Digit5') this.selectModel('coin');
      else if (code === 'Digit6') this.selectModel('crystal');
      else if (code === 'Space') {
        this.colorVariant = (this.colorVariant + 1) % 3;
        this.rebuildModel();
        this.ctx.audio.playButtonClick();
      } else if (code === 'KeyR') {
        this.charPos.set(0, 0, 0);
        this.charHeading = 0;
        this.rebuildModel();
      }
    });
  }

  exit(): void {
    this.unsubscribeKey?.();
    this.unsubscribeKey = null;
  }

  fixedUpdate(dt: number): void {
    if (this.currentType === 'character') {
      const mv = this.ctx.input.moveVector();
      const isMoving = mv.lengthSq() > 0.01;

      if (isMoving) {
        this.walkTime += dt;
        const targetHeading = Math.atan2(mv.x, mv.y);
        this.charHeading = targetHeading;

        const speed = 4.5;
        this.charPos.x += mv.x * speed * dt;
        this.charPos.z += mv.y * speed * dt;
        this.charPos.clampLength(0, 8.0);
      }

      this.limbRotations = computeWalkAngles(this.limbRotations, this.walkTime, isMoving);

      if (this.charParts.leftLeg) this.charParts.leftLeg.rotation.x = this.limbRotations.leftLegX;
      if (this.charParts.rightLeg) this.charParts.rightLeg.rotation.x = this.limbRotations.rightLegX;
      if (this.charParts.leftArm) this.charParts.leftArm.rotation.x = this.limbRotations.leftArmX;
      if (this.charParts.rightArm) this.charParts.rightArm.rotation.x = this.limbRotations.rightArmX;

      if (this.currentRoot) {
        this.currentRoot.position.copy(this.charPos);
        this.currentRoot.rotation.y = this.charHeading;
      }
    } else if (this.currentRoot) {
      // Rotate other models continuously on pedestal
      this.currentRoot.rotation.y += dt * 0.8;
      if (this.currentType === 'coin' || this.currentType === 'crystal') {
        this.currentRoot.position.y = 0.6 + Math.sin(Date.now() * 0.003) * 0.15;
      }
    }

    this.pedestal.rotation.y += dt * 0.2;
    this.pushStatus();
  }

  update(dt: number): void {
    if (this.currentType === 'character') {
      const k = 1 - Math.exp(-5 * dt);
      this.camera.position.x += (this.charPos.x - this.camera.position.x) * k;
      this.camera.position.z += (this.charPos.z + 7.5 - this.camera.position.z) * k;
      this.camera.lookAt(this.charPos.x, 1.2, this.charPos.z);
    } else {
      this.camera.position.set(0, 4.5, 7.5);
      this.camera.lookAt(0, 1.2, 0);
    }
  }

  dispose(): void {
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  private buildStudio(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x1a2130, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.6, 0.4, 32),
      new THREE.MeshStandardMaterial({ color: 0x242d3d, roughness: 0.6, metalness: 0.2 }),
    );
    this.pedestal.position.y = 0.2;
    this.pedestal.receiveShadow = true;
    this.scene.add(this.pedestal);
  }

  private selectModel(type: ModelType): void {
    this.currentType = type;
    this.charPos.set(0, 0, 0);
    this.rebuildModel();
    this.ctx.audio.playButtonClick();
  }

  private rebuildModel(): void {
    if (this.currentRoot) {
      disposeObject(this.currentRoot);
      this.currentRoot = null;
    }
    this.charParts = {};

    const t0 = performance.now();

    switch (this.currentType) {
      case 'character': {
        const clothes = [
          ProceduralMeshFactory.materials.clothesGreen,
          ProceduralMeshFactory.materials.clothesOrange,
          ProceduralMeshFactory.materials.clothesPurple,
        ][this.colorVariant];
        const res = ProceduralMeshFactory.createCharacter(clothes);
        this.currentRoot = res.root;
        this.charParts = {
          leftLeg: res.leftLeg,
          rightLeg: res.rightLeg,
          leftArm: res.leftArm,
          rightArm: res.rightArm,
        };
        break;
      }
      case 'car': {
        const mat = [
          ProceduralMeshFactory.materials.carRed,
          ProceduralMeshFactory.materials.carBlue,
          ProceduralMeshFactory.materials.gold,
        ][this.colorVariant];
        this.currentRoot = ProceduralMeshFactory.createCar(mat);
        break;
      }
      case 'tree':
        this.currentRoot = ProceduralMeshFactory.createTree();
        break;
      case 'crate':
        this.currentRoot = ProceduralMeshFactory.createCrate(1.4);
        break;
      case 'coin':
        this.currentRoot = ProceduralMeshFactory.createCoin(0.7);
        break;
      case 'crystal':
        this.currentRoot = ProceduralMeshFactory.createCrystal();
        break;
    }

    this.lastBuildTimeMs = performance.now() - t0;

    if (this.currentRoot) {
      this.scene.add(this.currentRoot);
      this.triangleCount = this.countTriangles(this.currentRoot);
    }
  }

  private countTriangles(obj: THREE.Object3D): number {
    let count = 0;
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        const geo = mesh.geometry;
        if (geo.index) {
          count += geo.index.count / 3;
        } else if (geo.attributes.position) {
          count += geo.attributes.position.count / 3;
        }
      }
    });
    return Math.floor(count);
  }

  private pushStatus(): void {
    const names: Record<ModelType, string> = {
      character: 'Герой с процедурной анимацией',
      car: 'Low-Poly Автомобиль',
      tree: 'Стилизованное дерево',
      crate: 'Деревянный ящик',
      coin: 'Золотая монета',
      crystal: 'Кристалл силы',
    };

    this.ctx.setStatus(
      `Модель: <b>${names[this.currentType]}</b> · Время сборки: <b>${this.lastBuildTimeMs.toFixed(3)} мс</b>`
      + ` · Треугольников: <b>${this.triangleCount}</b> · GLTF файлов: <b>0 (100% код)</b>`,
    );
  }
}
