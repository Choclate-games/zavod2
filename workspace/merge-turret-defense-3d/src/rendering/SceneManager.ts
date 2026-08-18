import * as THREE from 'three';
import { GRID_SIZE, MAX_TIER } from '../game/config';
import type { EnemyState, ProjectileState, TurretTier } from '../game/types';
import { InstancedMeshPool } from './MeshPool';

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);

  private readonly root = new THREE.Group();
  private readonly turretRoot = new THREE.Group();
  private readonly enemyPool: InstancedMeshPool;
  private readonly projectilePool: InstancedMeshPool;
  private readonly pathPoints: THREE.Vector3[] = [
    new THREE.Vector3(-4.5, 0.32, -5.2),
    new THREE.Vector3(3.8, 0.32, -4.1),
    new THREE.Vector3(-2.7, 0.32, -1.6),
    new THREE.Vector3(4.3, 0.32, 1.1),
    new THREE.Vector3(-3.7, 0.32, 3.5),
    new THREE.Vector3(0, 0.32, 5.2)
  ];
  private readonly pathCurve = new THREE.CatmullRomCurve3(this.pathPoints);
  private readonly turretMeshes: THREE.Group[] = [];
  private readonly enemyColor = new THREE.Color();
  private readonly tempPosition = new THREE.Vector3();

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isMobile(),
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setClearColor(0x07111f);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.host.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.Fog(0x07111f, 18, 52);
    this.scene.add(this.root);
    this.root.add(this.turretRoot);

    this.camera.position.set(0, 10.5, 10.8);
    this.camera.lookAt(0, 0, 0);

    const enemyMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.42, 18, 12),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      80
    );
    enemyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyPool = new InstancedMeshPool(enemyMesh, 80);
    this.scene.add(enemyMesh);

    const projectileMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff7ad }),
      96
    );
    projectileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.projectilePool = new InstancedMeshPool(projectileMesh, 96);
    this.scene.add(projectileMesh);

    this.buildEnvironment();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  setTurrets(slots: readonly (TurretTier | null)[]): void {
    this.turretRoot.clear();
    this.turretMeshes.length = 0;
    for (let i = 0; i < slots.length; i += 1) {
      const tier = slots[i];
      if (tier === null) continue;
      const turret = this.createTurret(tier);
      const col = i % GRID_SIZE;
      const row = Math.floor(i / GRID_SIZE);
      turret.position.set((col - 1.5) * 1.35, 0.38, 5.9 + row * 0.78);
      this.turretRoot.add(turret);
      this.turretMeshes[i] = turret;
    }
  }

  updateEnemies(enemies: readonly EnemyState[]): void {
    for (let i = 0; i < this.enemyPool.capacity; i += 1) this.enemyPool.hide(i);
    for (let i = 0; i < enemies.length && i < this.enemyPool.capacity; i += 1) {
      const enemy = enemies[i];
      if (!enemy.alive) continue;
      this.pathCurve.getPointAt(Math.min(1, enemy.progress), this.tempPosition);
      const scale = enemy.size * (enemy.selected ? 0.56 : 0.48);
      this.enemyPool.set(i, this.tempPosition.x, this.tempPosition.y, this.tempPosition.z, scale);
      this.enemyColor.setHSL((enemy.id * 0.11) % 1, 0.76, enemy.selected ? 0.68 : 0.53);
      this.enemyPool.mesh.setColorAt(i, this.enemyColor);
    }
    if (this.enemyPool.mesh.instanceColor) this.enemyPool.mesh.instanceColor.needsUpdate = true;
    this.enemyPool.flush();
  }

  updateProjectiles(projectiles: readonly ProjectileState[]): void {
    for (let i = 0; i < this.projectilePool.capacity; i += 1) this.projectilePool.hide(i);
    for (let i = 0; i < projectiles.length && i < this.projectilePool.capacity; i += 1) {
      const projectile = projectiles[i];
      if (!projectile.active) continue;
      const t = projectile.progress;
      const x = projectile.startX + (projectile.endX - projectile.startX) * t;
      const y = projectile.startY + (projectile.endY - projectile.startY) * t + Math.sin(t * Math.PI) * 0.7;
      const z = projectile.startZ + (projectile.endZ - projectile.startZ) * t;
      this.projectilePool.set(i, x, y, z, projectile.critical ? 1.75 : 1);
    }
    this.projectilePool.flush();
  }

  pointOnPath(progress: number): THREE.Vector3 {
    return this.pathCurve.getPointAt(Math.min(1, Math.max(0, progress)));
  }

  screenToEnemyHit(clientX: number, clientY: number, enemies: readonly EnemyState[]): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    let bestId: number | null = null;
    let bestDistance = 0.09;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const point = this.pointOnPath(enemy.progress).project(this.camera);
      const dx = point.x - x;
      const dy = point.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestDistance) {
        bestDistance = d;
        bestId = enemy.id;
      }
    }
    return bestId;
  }

  private buildEnvironment(): void {
    const ambient = new THREE.HemisphereLight(0x9ad8ff, 0x23364f, 2.2);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffd7a3, 2.4);
    sun.position.set(-5, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.isMobile() ? 512 : 1024, this.isMobile() ? 512 : 1024);
    this.scene.add(sun);

    const floorMat = new THREE.MeshLambertMaterial({ color: 0x172554 });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.26, 12), floorMat);
    platform.position.set(0, 0, 0.55);
    platform.receiveShadow = true;
    this.scene.add(platform);

    const laneMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.46 });
    const lane = new THREE.Mesh(new THREE.TubeGeometry(this.pathCurve, 72, 0.09, 8, false), laneMat);
    this.scene.add(lane);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.15, 0.65, 6),
      new THREE.MeshLambertMaterial({ color: 0x22c55e })
    );
    base.position.set(0, 0.56, 5.45);
    base.castShadow = true;
    this.scene.add(base);
  }

  private createTurret(tier: TurretTier): THREE.Group {
    const group = new THREE.Group();
    const hue = (tier / MAX_TIER) * 0.62;
    const baseMat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(hue, 0.62, 0.52) });
    const barrelMat = new THREE.MeshLambertMaterial({ color: tier > 8 ? 0xfacc15 : 0xd1d5db });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.28, 6), baseMat);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.4), baseMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.75 + tier * 0.035, 8), barrelMat);
    head.position.y = 0.32;
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.32, -0.48);
    group.add(base, head, barrel);
    group.scale.setScalar(0.9 + Math.min(0.45, tier * 0.025));
    return group;
  }

  private resize(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, this.isMobile() ? 1.5 : 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private isMobile(): boolean {
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
  }
}
