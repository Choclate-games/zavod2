import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { SceneManager } from './rendering/SceneManager';
import { RoadGenerator } from './world/RoadGenerator';
import { TruckController } from './vehicle/TruckController';
import { LEVELS } from './world/levels';
import { InputManager } from './input/InputManager';
import { AudioManager } from './audio/AudioManager';

export class ShowcaseApp {
  private currentMode: string = 'truck';
  private physics: PhysicsWorld | null = null;
  private sceneManager: SceneManager | null = null;
  private roadGenerator: RoadGenerator | null = null;
  private truck: TruckController | null = null;
  private inputManager: InputManager | null = null;
  private audioManager: AudioManager | null = null;
  private isInitialized = false;

  // FPS Mode properties
  private fpsGroup = new THREE.Group();
  private fpsYaw = new THREE.Object3D();
  private fpsPitch = new THREE.Object3D();
  private fpsRifle = new THREE.Group();
  private legMesh = new THREE.Group();
  private isKicking = false;
  private kickTimer = 0;
  private fpsTargets: { group: THREE.Group; mesh: THREE.Mesh; hp: number }[] = [];

  // Melee Mode properties
  private meleeGroup = new THREE.Group();
  private knight = new THREE.Group();
  private kSword = new THREE.Group();
  private orc = new THREE.Group();
  private orcBody: THREE.Mesh | null = null;
  private meleeCombo = 0;
  private meleeSwingTimer = 0;
  private isParrying = false;

  // 3D Showroom
  private modelsGroup = new THREE.Group();
  private showKnight = new THREE.Group();
  private showCoin = new THREE.Mesh();

  // 2D Slicer
  private canvas2D: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;
  private bladePoints: { x: number; y: number; time: number }[] = [];
  private isSlicing = false;

  // Camera Shake & Hit Stop
  private trauma = 0;
  private isHitFrozen = false;

  constructor(private container: HTMLElement) {
    this.canvas2D = document.getElementById('2d-canvas-overlay') as HTMLCanvasElement;
    this.ctx2d = this.canvas2D.getContext('2d')!;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // 1. Инициализация реального физического движка Rapier3D (WASM)
    this.physics = new PhysicsWorld();
    await this.physics.initialize();

    // 2. Инициализация сцены, освещения и холста из SceneManager
    this.sceneManager = new SceneManager();
    this.sceneManager.initialize();
    this.sceneManager.onResize();

    window.addEventListener('resize', () => {
      this.sceneManager?.onResize();
      this.canvas2D.width = window.innerWidth;
      this.canvas2D.height = window.innerHeight;
    });

    this.audioManager = new AudioManager();
    this.inputManager = new InputManager();

    // 3. Построение реального 3D террейна и лесной трассы
    this.roadGenerator = new RoadGenerator();
    this.roadGenerator.build(this.sceneManager, this.physics, LEVELS[0]);

    // 4. Построение контроллера грузовика ЗиЛ-130 с Rapier DynamicRayCastVehicleController
    this.truck = new TruckController(this.physics, this.sceneManager, this.roadGenerator);
    this.truck.build('zil');

    // 5. Инициализация дополнительных режимов (FPS, Melee, Models, Gestures)
    this.setupFPSMode();
    this.setupMeleeMode();
    this.setupShowroomMode();
    this.setupGestures();

    this.setupEventHandlers();
    this.isInitialized = true;

    // Запуск единого игрового цикла
    this.startLoop();
  }

  private setupFPSMode(): void {
    const scene = this.sceneManager!.scene;
    scene.add(this.fpsGroup);
    this.fpsGroup.visible = false;

    this.fpsYaw.position.set(0, 1.7, 5);
    this.fpsYaw.add(this.fpsPitch);
    scene.add(this.fpsYaw);

    const rBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), new THREE.MeshStandardMaterial({ color: 0x22252a, metalness: 0.8 }));
    const rBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x111215 }));
    rBarrel.rotation.x = Math.PI / 2;
    rBarrel.position.set(0, 0.02, -0.32);
    this.fpsRifle.add(rBody, rBarrel);
    this.fpsRifle.position.set(0.28, -0.25, -0.55);
    this.fpsPitch.add(this.fpsRifle);

    const legShin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.55, 8), new THREE.MeshStandardMaterial({ color: 0x2b3824 }));
    legShin.position.set(0.18, -0.3, -0.4);
    legShin.rotation.x = -Math.PI / 4;
    const legBoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.28), new THREE.MeshStandardMaterial({ color: 0x1a1614 }));
    legBoot.position.set(0.18, -0.45, -0.65);
    this.legMesh.add(legShin, legBoot);
    this.fpsPitch.add(this.legMesh);
    this.legMesh.visible = false;

    for (let i = 0; i < 8; i++) {
      const tGroup = new THREE.Group();
      const targetMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 12), new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.4 }));
      targetMesh.castShadow = true;
      tGroup.add(targetMesh);
      tGroup.position.set((i - 3.5) * 3.5, 0.9, -15 - (i % 2) * 5);
      this.fpsGroup.add(tGroup);
      this.fpsTargets.push({ group: tGroup, mesh: targetMesh, hp: 100 });
    }
  }

  private setupMeleeMode(): void {
    const scene = this.sceneManager!.scene;
    scene.add(this.meleeGroup);
    this.meleeGroup.visible = false;

    const kBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), new THREE.MeshStandardMaterial({ color: 0x2980b9, roughness: 0.4 }));
    kBody.position.y = 1.0;
    kBody.castShadow = true;
    const kHead = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.8 }));
    kHead.position.y = 1.6;
    this.knight.add(kBody, kHead);

    const sBlade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.02), new THREE.MeshStandardMaterial({ color: 0xecf0f1, metalness: 0.9 }));
    sBlade.position.y = 0.6;
    const sGuard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: 0xf39c12, metalness: 0.8 }));
    sGuard.position.y = 0.05;
    this.kSword.add(sBlade, sGuard);
    this.kSword.position.set(0.45, 0.9, 0.2);
    this.knight.add(this.kSword);
    this.meleeGroup.add(this.knight);

    this.orcBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.5), new THREE.MeshStandardMaterial({ color: 0x8e44ad, roughness: 0.5 }));
    this.orcBody.position.y = 0.8;
    this.orcBody.castShadow = true;
    this.orc.add(this.orcBody);
    this.orc.position.set(0, 0, -3.2);
    this.meleeGroup.add(this.orc);
  }

  private setupShowroomMode(): void {
    const scene = this.sceneManager!.scene;
    scene.add(this.modelsGroup);
    this.modelsGroup.visible = false;

    this.showKnight = this.knight.clone();
    this.showKnight.position.set(-2, 0, 0);
    this.modelsGroup.add(this.showKnight);

    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0x795548 }));
    trunk.position.y = 0.9;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 0), new THREE.MeshStandardMaterial({ color: 0x2ecc71, flatShading: true }));
    crown.position.y = 2.4;
    tree.add(trunk, crown);
    tree.position.set(2, 0, 0);
    this.modelsGroup.add(tree);

    this.showCoin = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.9, roughness: 0.2 }));
    this.showCoin.rotation.x = Math.PI / 2;
    this.showCoin.position.set(5.5, 1.2, 0);
    this.modelsGroup.add(this.showCoin);
  }

  private setupGestures(): void {
    this.canvas2D.width = window.innerWidth;
    this.canvas2D.height = window.innerHeight;

    this.canvas2D.addEventListener('pointerdown', (e) => {
      this.isSlicing = true;
      this.bladePoints = [{ x: e.clientX, y: e.clientY, time: Date.now() }];
    });
    this.canvas2D.addEventListener('pointermove', (e) => {
      if (!this.isSlicing) return;
      this.bladePoints.push({ x: e.clientX, y: e.clientY, time: Date.now() });
      if (this.bladePoints.length > 20) this.bladePoints.shift();
    });
    this.canvas2D.addEventListener('pointerup', () => { this.isSlicing = false; });
  }

  private setupEventHandlers(): void {
    window.addEventListener('keydown', (e) => {
      if (this.currentMode === 'fps' && e.code === 'KeyF') this.triggerSpartanKick();
      if (this.currentMode === 'melee' && (e.code === 'Space' || e.code === 'KeyE')) this.triggerMeleeAttack();
      if (this.currentMode === 'melee' && e.code === 'KeyQ') this.triggerParry();
    });

    const domElement = this.sceneManager!.renderer.domElement;

    domElement.addEventListener('click', () => {
      if (this.currentMode === 'fps' && document.pointerLockElement !== domElement) {
        domElement.requestPointerLock?.();
      } else if (this.currentMode === 'fps') {
        this.shootFPS();
      } else if (this.currentMode === 'melee') {
        this.triggerMeleeAttack();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (this.currentMode === 'fps' && document.pointerLockElement === domElement) {
        const sensitivity = 0.0022;
        this.fpsYaw.rotation.y -= e.movementX * sensitivity;
        this.fpsPitch.rotation.x -= e.movementY * sensitivity;
        this.fpsPitch.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.fpsPitch.rotation.x));
      }
    });
  }

  public switchMode(mode: string): void {
    this.currentMode = mode;
    const isTruck = mode === 'truck';

    this.sceneManager!.roadGroup.visible = isTruck;
    this.sceneManager!.decorationGroup.visible = isTruck;
    this.truck!.chassis.visible = isTruck;

    this.fpsGroup.visible = (mode === 'fps');
    this.meleeGroup.visible = (mode === 'melee');
    this.modelsGroup.visible = (mode === 'models');
    this.canvas2D.style.display = (mode === 'gestures') ? 'block' : 'none';

    const crosshair = document.getElementById('fps-crosshair');
    if (crosshair) crosshair.style.display = (mode === 'fps') ? 'block' : 'none';

    const spd = document.getElementById('speedometer');
    if (spd) spd.style.display = isTruck ? 'block' : 'none';
  }

  private shootFPS(): void {
    this.fpsRifle.position.z += 0.09;
    this.fpsRifle.rotation.x += 0.18;
    this.trauma = Math.min(1.0, this.trauma + 0.25);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.sceneManager!.camera);
    const hits = raycaster.intersectObjects(this.fpsTargets.map(t => t.mesh), false);
    if (hits.length > 0) {
      const hit = hits[0];
      const target = this.fpsTargets.find(t => t.mesh === hit.object);
      if (target) {
        const isHeadshot = hit.point.y > 1.4;
        const dmg = isHeadshot ? 75 : 35;
        target.hp -= dmg;
        target.mesh.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        setTimeout(() => { target.mesh.material = new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.4 }); }, 60);
      }
    }
  }

  private triggerSpartanKick(): void {
    if (this.isKicking) return;
    this.isKicking = true;
    this.kickTimer = 0.35;
    this.legMesh.visible = true;
    this.trauma = Math.min(1.0, this.trauma + 0.4);

    this.fpsTargets.forEach(t => {
      if (this.fpsYaw.position.distanceTo(t.group.position) < 6.0) {
        t.group.position.z -= 8.0;
        t.group.position.y += 3.0;
      }
    });
  }

  private triggerMeleeAttack(): void {
    this.meleeCombo = (this.meleeCombo + 1) % 3;
    this.meleeSwingTimer = 0.22;
    this.kSword.rotation.z = -1.6;
    this.trauma = Math.min(1.0, this.trauma + 0.2);
    if (this.orcBody) {
      this.orc.position.z -= 0.6;
      this.orcBody.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
      setTimeout(() => { this.orcBody!.material = new THREE.MeshStandardMaterial({ color: 0x8e44ad, roughness: 0.5 }); }, 70);
    }
  }

  private triggerParry(): void {
    this.isParrying = true;
    this.kSword.rotation.x = Math.PI / 2;
    this.trauma = Math.min(1.0, this.trauma + 0.4);
    setTimeout(() => { this.isParrying = false; this.kSword.rotation.x = 0; }, 300);
  }

  private startLoop(): void {
    let lastTime = performance.now();

    const tick = (now: number) => {
      requestAnimationFrame(tick);
      if (this.isHitFrozen) return;

      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (this.currentMode === 'truck' && this.physics && this.truck && this.inputManager) {
        // ЧЕСТНЫЙ ШАГ ФИЗИКИ RAPIER 3D (WASM) ДЛЯ ГРУЗОВИКА
        const input = this.inputManager.snapshot();
        this.physics.step();
        this.truck.fixedUpdate(dt, input);
        this.truck.render(1.0);

        // Обновление спидометра
        const spdEl = document.getElementById('speed-val');
        if (spdEl) spdEl.textContent = Math.round(this.truck.speed).toString();

        // Камера и рендер сцены SceneManager
        this.sceneManager!.render(this.truck.position, this.truck.forward, this.truck.speed);

      } else if (this.currentMode === 'fps') {
        const input = this.inputManager?.snapshot();
        if (input) {
          const moveVec = new THREE.Vector3();
          if (input.throttle > 0) moveVec.z -= 1;
          if (input.brake > 0) moveVec.z += 1;
          if (input.steer < 0) moveVec.x -= 1;
          if (input.steer > 0) moveVec.x += 1;
          moveVec.normalize();
          if (moveVec.lengthSq() > 0.01) {
            moveVec.applyEuler(new THREE.Euler(0, this.fpsYaw.rotation.y, 0));
            this.fpsYaw.position.addScaledVector(moveVec, 9.0 * dt);
          }
        }

        this.sceneManager!.camera.position.copy(this.fpsYaw.position);
        this.sceneManager!.camera.rotation.set(this.fpsPitch.rotation.x, this.fpsYaw.rotation.y, 0, 'YXZ');
        this.fpsRifle.position.lerp(new THREE.Vector3(0.28, -0.25, -0.55), 10.0 * dt);
        this.fpsRifle.rotation.x = THREE.MathUtils.lerp(this.fpsRifle.rotation.x, 0, 12.0 * dt);

        if (this.isKicking) {
          this.kickTimer -= dt;
          if (this.kickTimer <= 0) { this.isKicking = false; this.legMesh.visible = false; }
        }
        this.sceneManager!.renderer.render(this.sceneManager!.scene, this.sceneManager!.camera);

      } else if (this.currentMode === 'melee') {
        this.sceneManager!.camera.position.set(0, 2.8, 5.2);
        this.sceneManager!.camera.lookAt(0, 1.2, -1.0);
        if (this.meleeSwingTimer > 0) {
          this.meleeSwingTimer -= dt;
        } else if (!this.isParrying) {
          this.kSword.rotation.z = THREE.MathUtils.lerp(this.kSword.rotation.z, 0, 10.0 * dt);
        }
        this.orc.position.z = THREE.MathUtils.lerp(this.orc.position.z, -3.2, 4.0 * dt);
        this.sceneManager!.renderer.render(this.sceneManager!.scene, this.sceneManager!.camera);

      } else if (this.currentMode === 'models') {
        this.sceneManager!.camera.position.set(0, 4.5, 14.0);
        this.sceneManager!.camera.lookAt(0, 1.2, 0);
        this.showKnight.rotation.y += 0.6 * dt;
        this.showCoin.rotation.z += 2.0 * dt;
        this.sceneManager!.renderer.render(this.sceneManager!.scene, this.sceneManager!.camera);
      }

      // Отрисовка 2D лезвия
      if (this.currentMode === 'gestures') {
        this.ctx2d.clearRect(0, 0, this.canvas2D.width, this.canvas2D.height);
        const tNow = Date.now();
        for (let i = this.bladePoints.length - 1; i >= 0; i--) {
          if (tNow - this.bladePoints[i].time > 180) this.bladePoints.splice(i, 1);
        }
        if (this.bladePoints.length > 2) {
          this.ctx2d.beginPath();
          this.ctx2d.moveTo(this.bladePoints[0].x, this.bladePoints[0].y);
          for (let i = 1; i < this.bladePoints.length; i++) this.ctx2d.lineTo(this.bladePoints[i].x, this.bladePoints[i].y);
          this.ctx2d.strokeStyle = '#00cec9';
          this.ctx2d.lineWidth = 8;
          this.ctx2d.lineCap = 'round';
          this.ctx2d.stroke();
        }
      }
    };

    requestAnimationFrame(tick);
  }
}
