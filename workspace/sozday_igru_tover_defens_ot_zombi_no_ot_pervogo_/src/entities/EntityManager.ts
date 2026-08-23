import * as THREE from 'three';
import { ProceduralModels } from '../rendering/ProceduralModels';
import { BALANCE } from '../balance';
import { EventBus } from '../core/EventBus';

export interface TurretSlot {
  id: number;
  position: THREE.Vector3;
  isMounted: boolean;
  level: number; // 0 = empty, 1 = T1, 2 = T2, 3 = T3
  heat: number; // 0 .. 100°C
  isJammed: boolean;
  jamTimer: number;
  isOvercharged: boolean;
  overchargeTimer: number;
  meshGroup: THREE.Group | null;
  fireSectorDeg: number;
  fireRange: number;
  fireCooldown: number;
  yaw: number;
}

export interface ZombieEntity {
  id: number;
  type: 'walker' | 'runner' | 'brute' | 'boss';
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  isFrozen: boolean;
  freezeTimer: number;
  targetSlotId: number;
  active: boolean;
}

export interface BarrelEntity {
  id: number;
  type: 'cryo' | 'diesel';
  x: number;
  y: number;
  z: number;
  hp: number;
  meshGroup: THREE.Group;
  active: boolean;
}

export interface ParapetSection {
  id: number;
  hp: number;
  maxHp: number;
  x: number;
  z: number;
}

export class EntityManager {
  public turretSlots: TurretSlot[] = [];
  public zombies: ZombieEntity[] = [];
  public barrels: BarrelEntity[] = [];
  public parapets: ParapetSection[] = [];
  public generatorCellsAvailable = BALANCE.overcharge.kolichestvo_dostupnyh_yacheek_na_rubezhe;
  public generatorRechargeTimer = 0;
  public scrap = 150; // Начальный скрап для первой турели

  // Инстансированный рендеринг орды зомби
  private zombieInstancedMesh: THREE.InstancedMesh;
  private maxZombies = 160;
  private dummyTransform = new THREE.Object3D();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupTurretSlots();
    this.setupParapets();
    this.setupBarrels();
    this.setupZombieMesh();
    this.setupStations();
  }

  private setupTurretSlots(): void {
    const slotPositions = [
      new THREE.Vector3(-6, 0, -5.5),
      new THREE.Vector3(0, 0, -5.5),
      new THREE.Vector3(6, 0, -5.5),
    ];

    slotPositions.forEach((pos, idx) => {
      this.turretSlots.push({
        id: idx,
        position: pos,
        isMounted: false,
        level: 0,
        heat: 0,
        isJammed: false,
        jamTimer: 0,
        isOvercharged: false,
        overchargeTimer: 0,
        meshGroup: null,
        fireSectorDeg: BALANCE.montazh.sektor_avtozahvata_tseley,
        fireRange: BALANCE.montazh.dalnost_effektivnogo_ognya_t1,
        fireCooldown: 0,
        yaw: 0,
      });
    });
  }

  private setupParapets(): void {
    this.parapets = [
      { id: 0, hp: BALANCE.repair.prochnost_sektsii_brustvera, maxHp: BALANCE.repair.prochnost_sektsii_brustvera, x: -6.5, z: -6 },
      { id: 1, hp: BALANCE.repair.prochnost_sektsii_brustvera, maxHp: BALANCE.repair.prochnost_sektsii_brustvera, x: 0, z: -6 },
      { id: 2, hp: BALANCE.repair.prochnost_sektsii_brustvera, maxHp: BALANCE.repair.prochnost_sektsii_brustvera, x: 6.5, z: -6 },
    ];
  }

  private setupBarrels(): void {
    const barrelConfigs: Array<{ x: number; z: number; type: 'cryo' | 'diesel' }> = [
      { x: -8, z: -12, type: 'cryo' },
      { x: -3, z: -15, type: 'diesel' },
      { x: 3, z: -15, type: 'cryo' },
      { x: 8, z: -12, type: 'diesel' },
    ];

    barrelConfigs.forEach((cfg, idx) => {
      const mesh = ProceduralModels.createBarrelMesh(cfg.type);
      mesh.position.set(cfg.x, 0, cfg.z);
      this.scene.add(mesh);

      this.barrels.push({
        id: idx,
        type: cfg.type,
        x: cfg.x,
        y: 0,
        z: cfg.z,
        hp: 50,
        meshGroup: mesh,
        active: true,
      });
    });
  }

  private setupStations(): void {
    // 1. Стойка генератора Overcharge (слева в бункере)
    const genGroup = new THREE.Group();
    const genGeo = new THREE.BoxGeometry(1.5, 1.2, 1.0);
    const genMat = new THREE.MeshStandardMaterial({ color: 0x243342, metalness: 0.4, roughness: 0.6 });
    const genMesh = new THREE.Mesh(genGeo, genMat);
    genMesh.position.set(-8, 0.6, 4);
    genMesh.castShadow = true;
    genGroup.add(genMesh);

    // Светодиоды ячеек
    const ledGeo = new THREE.BoxGeometry(0.3, 0.5, 0.3);
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, emissive: 0xaa8800 });
    const led1 = new THREE.Mesh(ledGeo, ledMat);
    led1.position.set(-8.3, 1.3, 4);
    const led2 = new THREE.Mesh(ledGeo, ledMat);
    led2.position.set(-7.7, 1.3, 4);
    genGroup.add(led1, led2);
    this.scene.add(genGroup);

    // 2. Станция заправки крио-хладагента (справа в бункере)
    const cryoGroup = new THREE.Group();
    const tankGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.8, 10);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x3498db, emissive: 0x003355, roughness: 0.4 });
    const tankMesh = new THREE.Mesh(tankGeo, tankMat);
    tankMesh.position.set(8, 0.9, 4);
    tankMesh.castShadow = true;
    cryoGroup.add(tankMesh);
    this.scene.add(cryoGroup);
  }

  private setupZombieMesh(): void {
    const geo = new THREE.BoxGeometry(0.7, 1.8, 0.6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x485868,
      roughness: 0.8,
    });

    this.zombieInstancedMesh = new THREE.InstancedMesh(geo, mat, this.maxZombies);
    this.zombieInstancedMesh.castShadow = true;
    this.zombieInstancedMesh.frustumCulled = false;
    this.scene.add(this.zombieInstancedMesh);
  }

  public mountTurret(slotId: number): boolean {
    const slot = this.turretSlots[slotId];
    if (!slot || slot.isMounted) return false;

    if (this.scrap < BALANCE.montazh.stoimost_t1_tureli_v_skrape) {
      EventBus.emit('TOAST_SHOW', { message: 'Недостаточно металлолома (нужно 75)!', type: 'warn' });
      return false;
    }

    this.scrap -= BALANCE.montazh.stoimost_t1_tureli_v_skrape;
    EventBus.emit('SCRAP_CHANGED', this.scrap);

    slot.isMounted = true;
    slot.level = 1;
    slot.meshGroup = ProceduralModels.createTurretMesh();
    slot.meshGroup.position.copy(slot.position);
    this.scene.add(slot.meshGroup);

    EventBus.emit('TURRET_MOUNTED', { slotId, level: 1, cost: BALANCE.montazh.stoimost_t1_tureli_v_skrape });
    EventBus.emit('TOAST_SHOW', { message: `Турель Т1 смонтирована в секторе ${slotId + 1}!`, type: 'info' });
    return true;
  }

  public upgradeTurret(slotId: number): boolean {
    const slot = this.turretSlots[slotId];
    if (!slot || !slot.isMounted || slot.level >= 3) return false;

    const cost = slot.level === 1 ? 120 : 250;
    if (this.scrap < cost) {
      EventBus.emit('TOAST_SHOW', { message: `Недостаточно скрапа для апгрейда (нужно ${cost})!`, type: 'warn' });
      return false;
    }

    this.scrap -= cost;
    EventBus.emit('SCRAP_CHANGED', this.scrap);
    slot.level += 1;
    slot.fireRange += 6.0;

    EventBus.emit('TURRET_UPGRADED', { slotId, level: slot.level });
    EventBus.emit('TOAST_SHOW', { message: `Сектор ${slotId + 1}: орудие улучшено до Т${slot.level}!`, type: 'info' });
    return true;
  }

  public spawnZombie(type: 'walker' | 'runner' | 'brute' | 'boss'): void {
    let hp = 100;
    let speed = 1.6;
    if (type === 'runner') { hp = 60; speed = 3.2; }
    if (type === 'brute') { hp = 450; speed = 1.1; }
    if (type === 'boss') { hp = 1800; speed = 0.9; }

    const spawnX = (Math.random() - 0.5) * 22;
    const spawnZ = -28 - Math.random() * 8;
    const targetSlotId = Math.floor(Math.random() * 3);

    this.zombies.push({
      id: Math.random(),
      type,
      x: spawnX,
      y: 0.9,
      z: spawnZ,
      hp,
      maxHp: hp,
      speed,
      isFrozen: false,
      freezeTimer: 0,
      targetSlotId,
      active: true,
    });
  }

  public updateZombies(dt: number): void {
    let activeIndex = 0;

    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (!z.active) {
        this.zombies.splice(i, 1);
        continue;
      }

      // Заморозка
      if (z.isFrozen) {
        z.freezeTimer -= dt;
        if (z.freezeTimer <= 0) z.isFrozen = false;
      }

      if (!z.isFrozen) {
        // Движение к брустверу
        const targetX = this.turretSlots[z.targetSlotId].position.x;
        const targetZ = -6.2;

        const dx = targetX - z.x;
        const dz = targetZ - z.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.4) {
          z.x += (dx / dist) * z.speed * dt;
          z.z += (dz / dist) * z.speed * dt;
        } else {
          // Атака сектора бруствера
          const parapet = this.parapets[z.targetSlotId];
          if (parapet && parapet.hp > 0) {
            parapet.hp = Math.max(0, parapet.hp - 15 * dt);
          }
        }
      }

      if (activeIndex < this.maxZombies) {
        this.dummyTransform.position.set(z.x, z.y, z.z);
        this.dummyTransform.scale.set(
          z.type === 'boss' ? 2.2 : z.type === 'brute' ? 1.4 : 1.0,
          z.type === 'boss' ? 2.2 : z.type === 'brute' ? 1.4 : 1.0,
          z.type === 'boss' ? 2.2 : z.type === 'brute' ? 1.4 : 1.0
        );
        this.dummyTransform.updateMatrix();
        this.zombieInstancedMesh.setMatrixAt(activeIndex, this.dummyTransform.matrix);
        activeIndex++;
      }
    }

    // Скрытие неактивных инстансов
    for (let i = activeIndex; i < this.maxZombies; i++) {
      this.dummyTransform.position.set(0, -1000, 0);
      this.dummyTransform.updateMatrix();
      this.zombieInstancedMesh.setMatrixAt(i, this.dummyTransform.matrix);
    }
    this.zombieInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  public reset(): void {
    this.zombies = [];
    this.scrap = 150;
    EventBus.emit('SCRAP_CHANGED', this.scrap);
    this.generatorCellsAvailable = BALANCE.overcharge.kolichestvo_dostupnyh_yacheek_na_rubezhe;
    this.parapets.forEach((p) => (p.hp = p.maxHp));
    this.turretSlots.forEach((s) => {
      s.heat = 0;
      s.isJammed = false;
      s.isOvercharged = false;
    });
  }
}
