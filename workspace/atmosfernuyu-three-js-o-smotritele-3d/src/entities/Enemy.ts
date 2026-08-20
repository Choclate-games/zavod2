import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { ENEMY, math, COLORS } from '../config/GameConfig';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

/** A single deep-sea creature. Bodies are created once and reused (teleport, not
 * rebuild) — activation toggles `setEnabled` and repositions. */
export class Enemy {
  readonly body: RAPIER.RigidBody;
  readonly group = new THREE.Group();
  health = 1;
  maxHealth = 1;
  alive = false;
  contactCd = 0;
  private readonly mat: THREE.MeshStandardMaterial;

  constructor(
    private readonly scene: THREE.Scene,
    physics: PhysicsWorld,
  ) {
    this.body = physics.createDynamicBody({
      x: 0,
      y: -999,
      z: 0,
      linearDamping: ENEMY.linearDamping,
      angularDamping: 2.0,
    });
    physics.attachBall(this.body, ENEMY.radius, 0.2, 0.4);
    this.body.setEnabled(false);

    this.mat = new THREE.MeshStandardMaterial({
      color: COLORS.enemy,
      emissive: new THREE.Color(COLORS.enemy).multiplyScalar(0.4),
      roughness: 0.8,
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(ENEMY.radius, 0), this.mat);
    core.castShadow = true;
    this.group.add(core);
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.25, 0.8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd0d8, emissive: 0x551018, roughness: 0.7 }),
    );
    spike.position.set(0, ENEMY.radius, 0);
    this.group.add(spike);
    this.group.visible = false;
    scene.add(this.group);
  }

  activate(pos: THREE.Vector3, health: number): void {
    this.health = health;
    this.maxHealth = health;
    this.alive = true;
    this.contactCd = 0;
    this.body.setEnabled(true);
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.wakeUp();
    this.group.visible = true;
  }

  deactivate(): void {
    this.alive = false;
    this.body.setEnabled(false);
    this.group.visible = false;
  }

  /** Returns true if this damage killed the enemy. */
  takeDamage(amount: number): boolean {
    this.health -= amount;
    const f = math.clamp(this.health / this.maxHealth, 0.2, 1);
    this.mat.emissiveIntensity = 0.4 + (1 - f) * 1.5;
    return this.health <= 0;
  }

  get position(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  syncMesh(): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
  }
}

export class EnemyPool {
  private readonly enemies: Enemy[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    physics: PhysicsWorld,
    capacity: number,
  ) {
    for (let i = 0; i < capacity; i++) this.enemies.push(new Enemy(scene, physics));
  }

  spawn(pos: THREE.Vector3, health: number): Enemy | null {
    const e = this.enemies.find((x) => !x.alive);
    if (!e) return null;
    e.activate(pos, health);
    return e;
  }

  kill(e: Enemy): void {
    e.deactivate();
  }

  clearAll(): void {
    for (const e of this.enemies) if (e.alive) e.deactivate();
  }

  get active(): Enemy[] {
    return this.enemies.filter((x) => x.alive);
  }

  get activeCount(): number {
    let n = 0;
    for (const e of this.enemies) if (e.alive) n++;
    return n;
  }

  /** Steer every active enemy toward the player and sync its mesh. */
  update(dt: number, playerPos: THREE.Vector3): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.contactCd > 0) e.contactCd -= dt;
      const p = e.position;
      const dx = playerPos.x - p.x;
      const dy = playerPos.y - p.y;
      const dz = playerPos.z - p.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      const imp = ENEMY.chaseForce * dt;
      e.body.applyImpulse({ x: (dx / d) * imp, y: (dy / d) * imp * 0.6, z: (dz / d) * imp }, true);
      // Cap speed.
      const v = e.body.linvel();
      const sp = Math.hypot(v.x, v.y, v.z);
      if (sp > ENEMY.baseSpeed) {
        const k = ENEMY.baseSpeed / sp;
        e.body.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
      }
      e.syncMesh();
    }
  }
}
