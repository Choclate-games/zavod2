import * as THREE from 'three';
import { Player } from './Player';
import { Enemy } from './Enemy';
import { Door } from './Door';
import { Barrel } from './Barrel';
import { Projectile } from './Projectile';
import { WeaponPickup } from './WeaponPickup';

export class EntityManager {
  private static instance: EntityManager;
  public scene: THREE.Scene | null = null;
  public player!: Player;
  public enemies: Enemy[] = [];
  public doors: Door[] = [];
  public barrels: Barrel[] = [];
  public projectiles: Projectile[] = [];
  public pickups: WeaponPickup[] = [];

  private idCounter = 1;

  public static getInstance(): EntityManager {
    if (!EntityManager.instance) {
      EntityManager.instance = new EntityManager();
    }
    return EntityManager.instance;
  }

  public init(scene: THREE.Scene): void {
    this.scene = scene;
    this.player = new Player();
  }

  public clearLevelEntities(): void {
    if (!this.scene) return;

    this.enemies.forEach((e) => e.destroy(this.scene!));
    this.doors.forEach((d) => d.destroy(this.scene!));
    this.barrels.forEach((b) => b.destroy(this.scene!));
    this.projectiles.forEach((p) => p.destroy(this.scene!));
    this.pickups.forEach((w) => w.destroy(this.scene!));

    this.enemies = [];
    this.doors = [];
    this.barrels = [];
    this.projectiles = [];
    this.pickups = [];
  }

  public spawnEnemy(type: any, pos: THREE.Vector3): Enemy {
    const id = `e_${this.idCounter++}`;
    const enemy = new Enemy(id, type, pos);
    this.enemies.push(enemy);
    if (this.scene) this.scene.add(enemy.mesh);
    return enemy;
  }

  public spawnDoor(pos: THREE.Vector3, rotY = 0): Door {
    const id = `d_${this.idCounter++}`;
    const door = new Door(id, pos, rotY);
    this.doors.push(door);
    if (this.scene) this.scene.add(door.mesh);
    return door;
  }

  public spawnBarrel(pos: THREE.Vector3): Barrel {
    const id = `b_${this.idCounter++}`;
    const barrel = new Barrel(id, pos);
    this.barrels.push(barrel);
    if (this.scene) this.scene.add(barrel.mesh);
    return barrel;
  }

  public spawnProjectile(
    team: 'PLAYER' | 'ENEMY',
    pos: THREE.Vector3,
    dir: THREE.Vector3,
    speed: number,
    damage: number,
    isReflectable = true
  ): Projectile {
    const id = `p_${this.idCounter++}`;
    const proj = new Projectile(id, team, pos, dir, speed, damage, isReflectable);
    this.projectiles.push(proj);
    if (this.scene) this.scene.add(proj.mesh);
    return proj;
  }

  public spawnWeaponDrop(type: any, pos: THREE.Vector3, initialVel?: THREE.Vector3): WeaponPickup {
    const id = `w_${this.idCounter++}`;
    const pickup = new WeaponPickup(id, type, pos, initialVel);
    this.pickups.push(pickup);
    if (this.scene) this.scene.add(pickup.mesh);
    return pickup;
  }

  public update(dt: number): void {
    if (!this.scene) return;

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.isDead && e.state === 'DEAD') {
        // Drop carried weapon on death
        if (Math.random() < 0.4) {
          this.spawnWeaponDrop(e.carriedWeapon, e.position);
        }
        e.destroy(this.scene);
        this.enemies.splice(i, 1);
        continue;
      }
      e.update(dt, this.player.position, (enemy, dir) => {
        // Enemy shooting
        this.spawnProjectile('ENEMY', enemy.position.clone().add(new THREE.Vector3(0, 1.3, 0)), dir, 18.0, 15, enemy.type === 'GUNNER' || enemy.type === 'BOSS_MECH');
      });
    }

    // Update Doors
    for (let i = 0; i < this.doors.length; i++) {
      this.doors[i].update(dt);
    }

    // Update Barrels
    for (let i = 0; i < this.barrels.length; i++) {
      this.barrels[i].update(dt);
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt);
      if (p.isDead) {
        p.destroy(this.scene);
        this.projectiles.splice(i, 1);
      }
    }

    // Update Weapon Pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const w = this.pickups[i];
      w.update(dt);
      if (w.isDead) {
        w.destroy(this.scene);
        this.pickups.splice(i, 1);
      }
    }
  }
}
