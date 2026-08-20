import * as THREE from 'three';
import { Player, KickState } from '../entities/Player';
import { EnemyPool } from '../entities/EnemyPool';
import { CombatSystem } from '../systems/CombatSystem';
import { ProjectilePool } from '../entities/ProjectilePool';
import { ParticleSystem } from '../systems/ParticleSystem';
import { ModelFactory } from './ModelFactory';
import { EventBus } from '../core/EventBus';

export class SceneManager {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private playerMesh: THREE.Group;
  private enemyMeshMap: Map<string, THREE.Group> = new Map();
  private barrelMeshMap: Map<string, THREE.Group> = new Map();
  private doorMeshMap: Map<string, THREE.Group> = new Map();
  private pickupMeshMap: Map<string, THREE.Object3D> = new Map();
  private projectileMeshMap: Map<string, THREE.Mesh> = new Map();

  public particleSystem: ParticleSystem;

  // Camera Shake & FOV punch
  private baseFov: number = 50;
  private currentFov: number = 50;
  private targetFov: number = 50;
  private shakeAmp: number = 0;
  private shakeDuration: number = 0;

  // Lighting
  private dirLight: THREE.DirectionalLight;
  private pointLight: THREE.PointLight;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d14);
    this.scene.fog = new THREE.FogExp2(0x0a0d14, 0.025);

    // Camera
    this.camera = new THREE.PerspectiveCamera(this.baseFov, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 18, 16);
    this.camera.lookAt(0, 0, 0);

    // Particles
    this.particleSystem = new ParticleSystem(this.scene);

    // Lighting
    const ambient = new THREE.AmbientLight(0x223344, 1.2);
    this.scene.add(ambient);

    this.dirLight = new THREE.DirectionalLight(0xfff0dd, 2.0);
    this.dirLight.position.set(15, 25, 10);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 60;
    this.dirLight.shadow.camera.left = -20;
    this.dirLight.shadow.camera.right = 20;
    this.dirLight.shadow.camera.top = 20;
    this.dirLight.shadow.camera.bottom = -20;
    this.scene.add(this.dirLight);

    this.pointLight = new THREE.PointLight(0xff6b00, 0, 15);
    this.scene.add(this.pointLight);

    // Build Arena Environment
    this.buildArenaEnvironment();

    // Create Player Mesh
    this.playerMesh = ModelFactory.createPlayerMesh();
    this.scene.add(this.playerMesh);

    // Event Bus hooks
    this.setupEventHooks();

    window.addEventListener('resize', () => this.onResize());
  }

  private setupEventHooks(): void {
    const bus = EventBus.getInstance();

    bus.on('camera:shake', (data: { amplitude: number; duration: number }) => {
      this.shakeAmp = data.amplitude;
      this.shakeDuration = data.duration;
    });

    bus.on('camera:punchFov', (delta: number) => {
      this.targetFov = this.baseFov - delta;
    });

    bus.on('vfx:explosion', (data: { x: number; z: number; radius: number }) => {
      this.particleSystem.emitExplosion(data.x, data.z, data.radius);
      this.pointLight.position.set(data.x, 1.5, data.z);
      this.pointLight.intensity = 8.0;
    });

    bus.on('vfx:shockwave', (data: { x: number; z: number; radius: number }) => {
      this.particleSystem.emitShockwaveRing(data.x, data.z, data.radius);
    });
  }

  private buildArenaEnvironment(): void {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(32, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x141824,
      roughness: 0.7,
      metalness: 0.3
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Grid markings
    const grid = new THREE.GridHelper(36, 18, 0x00f0ff, 0x1c2438);
    grid.position.y = 0.02;
    this.scene.add(grid);

    // Arena Perimeter Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b2233, roughness: 0.5, metalness: 0.6 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 0.6 });

    // Left Wall
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, 3.5, 40), wallMat);
    leftWall.position.set(-16.5, 1.75, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    // Right Wall
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, 3.5, 40), wallMat);
    rightWall.position.set(16.5, 1.75, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    // North Wall
    const northWall = new THREE.Mesh(new THREE.BoxGeometry(34, 3.5, 1), wallMat);
    northWall.position.set(0, 1.75, -20.5);
    northWall.castShadow = true;
    this.scene.add(northWall);

    // South Wall
    const southWall = new THREE.Mesh(new THREE.BoxGeometry(34, 3.5, 1), wallMat);
    southWall.position.set(0, 1.75, 20.5);
    southWall.castShadow = true;
    this.scene.add(southWall);

    // Neon wall trims
    const trimL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 40), trimMat);
    trimL.position.set(-15.9, 2.5, 0);
    this.scene.add(trimL);

    const trimR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 40), trimMat);
    trimR.position.set(15.9, 2.5, 0);
    this.scene.add(trimR);
  }

  public render(
    dt: number,
    player: Player,
    enemyPool: EnemyPool,
    combatSystem: CombatSystem,
    projectilePool: ProjectilePool
  ): void {
    // 1. Update Player Mesh
    this.playerMesh.position.set(player.position.x, player.position.y, player.position.z);
    this.playerMesh.rotation.y = -player.aimAngle + Math.PI / 2;

    // Leg Kick Animation
    const rightBoot = this.playerMesh.children.find((c) => c.position.x > 0.1 && c.position.y < 0.3);
    if (rightBoot) {
      if (player.kickState === KickState.WINDUP) {
        rightBoot.position.z = -0.3;
        rightBoot.position.y = 0.35;
      } else if (player.kickState === KickState.ACTIVE_HITBOX || player.kickState === KickState.HIT_FREEZE) {
        rightBoot.position.z = 0.65;
        rightBoot.position.y = 0.45;
      } else {
        rightBoot.position.z = 0.08;
        rightBoot.position.y = 0.12;
      }
    }

    // 2. Sync Enemies
    const activeEnemies = enemyPool.getActiveEnemies();
    const activeEnemyIds = new Set<string>();

    for (const enemy of activeEnemies) {
      activeEnemyIds.add(enemy.id);
      let mesh = this.enemyMeshMap.get(enemy.id);
      if (!mesh) {
        mesh = ModelFactory.createEnemyMesh(enemy.type);
        this.scene.add(mesh);
        this.enemyMeshMap.set(enemy.id, mesh);
      }

      mesh.position.set(enemy.position.x, enemy.position.y, enemy.position.z);

      // Rotate towards player or tumble if airborne
      if (enemy.isAirborneSkeet) {
        mesh.rotation.x += 12 * dt;
        mesh.rotation.z += 8 * dt;
      } else {
        mesh.rotation.x = 0;
        mesh.rotation.z = 0;
        const dx = player.position.x - enemy.position.x;
        const dz = player.position.z - enemy.position.z;
        mesh.rotation.y = Math.atan2(dx, dz);
      }

      // Shield visibility
      const shield = mesh.getObjectByName('shieldMesh');
      if (shield) {
        shield.visible = enemy.hasShield && enemy.shieldHp > 0;
      }
    }

    // Clean up inactive enemy meshes
    for (const [id, mesh] of this.enemyMeshMap.entries()) {
      if (!activeEnemyIds.has(id)) {
        this.scene.remove(mesh);
        this.enemyMeshMap.delete(id);
      }
    }

    // 3. Sync Barrels
    const activeBarrelIds = new Set<string>();
    for (const barrel of combatSystem.barrels) {
      activeBarrelIds.add(barrel.id);
      let mesh = this.barrelMeshMap.get(barrel.id);
      if (!mesh) {
        mesh = ModelFactory.createBarrelMesh();
        this.scene.add(mesh);
        this.barrelMeshMap.set(barrel.id, mesh);
      }
      mesh.position.set(barrel.position.x, barrel.position.y, barrel.position.z);
    }
    for (const [id, mesh] of this.barrelMeshMap.entries()) {
      if (!activeBarrelIds.has(id)) {
        this.scene.remove(mesh);
        this.barrelMeshMap.delete(id);
      }
    }

    // 4. Sync Doors
    const activeDoorIds = new Set<string>();
    for (const door of combatSystem.doors) {
      activeDoorIds.add(door.id);
      let mesh = this.doorMeshMap.get(door.id);
      if (!mesh) {
        mesh = ModelFactory.createDoorMesh();
        this.scene.add(mesh);
        this.doorMeshMap.set(door.id, mesh);
      }
      mesh.position.set(door.position.x, door.position.y, door.position.z);
      if (door.isBreached) {
        mesh.rotation.x += 10 * dt;
      }
    }
    for (const [id, mesh] of this.doorMeshMap.entries()) {
      if (!activeDoorIds.has(id)) {
        this.scene.remove(mesh);
        this.doorMeshMap.delete(id);
      }
    }

    // 5. Sync Pickups
    const activePickupIds = new Set<string>();
    for (const w of combatSystem.droppedWeapons) {
      activePickupIds.add(w.id);
      let mesh = this.pickupMeshMap.get(w.id);
      if (!mesh) {
        mesh = ModelFactory.createWeaponPickupMesh(w.type);
        this.scene.add(mesh);
        this.pickupMeshMap.set(w.id, mesh);
      }
      mesh.position.set(w.position.x, w.position.y + 0.3, w.position.z);
      mesh.rotation.y += 6 * dt;
      mesh.rotation.z += 4 * dt;
    }
    for (const s of combatSystem.droppedShards) {
      activePickupIds.add(s.id);
      let mesh = this.pickupMeshMap.get(s.id);
      if (!mesh) {
        mesh = ModelFactory.createShardMesh(s.type);
        this.scene.add(mesh);
        this.pickupMeshMap.set(s.id, mesh);
      }
      mesh.position.set(s.position.x, s.position.y + 0.2, s.position.z);
      mesh.rotation.y += 8 * dt;
    }
    for (const [id, mesh] of this.pickupMeshMap.entries()) {
      if (!activePickupIds.has(id)) {
        this.scene.remove(mesh);
        this.pickupMeshMap.delete(id);
      }
    }

    // 6. Sync Projectiles
    const activeProjs = projectilePool.getActive();
    const activeProjIds = new Set<string>();
    const projGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const playerBulletMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const enemyBulletMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

    for (const p of activeProjs) {
      activeProjIds.add(p.id);
      let mesh = this.projectileMeshMap.get(p.id);
      if (!mesh) {
        mesh = new THREE.Mesh(projGeo, p.isPlayerOwned ? playerBulletMat : enemyBulletMat);
        this.scene.add(mesh);
        this.projectileMeshMap.set(p.id, mesh);
      }
      mesh.position.set(p.position.x, p.position.y + 0.8, p.position.z);
    }
    for (const [id, mesh] of this.projectileMeshMap.entries()) {
      if (!activeProjIds.has(id)) {
        this.scene.remove(mesh);
        this.projectileMeshMap.delete(id);
      }
    }

    // 7. Update Particles
    this.particleSystem.update(dt);

    // Light decay
    if (this.pointLight.intensity > 0) {
      this.pointLight.intensity = Math.max(0, this.pointLight.intensity - 15 * dt);
    }

    // 8. Camera Smooth Tracking & Dynamic FOV
    const targetCamX = player.position.x * 0.65;
    const targetCamZ = player.position.z * 0.65 + 16;
    this.camera.position.x += (targetCamX - this.camera.position.x) * 6 * dt;
    this.camera.position.z += (targetCamZ - this.camera.position.z) * 6 * dt;
    this.camera.lookAt(player.position.x * 0.35, 0.5, player.position.z * 0.35);

    // Screen Shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmp;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmp;
    }

    // FOV Punch lerp
    this.targetFov += (this.baseFov - this.targetFov) * 5 * dt;
    this.currentFov += (this.targetFov - this.currentFov) * 8 * dt;
    if (Math.abs(this.camera.fov - this.currentFov) > 0.1) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // Render WebGL
    this.renderer.render(this.scene, this.camera);
  }

  public onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
