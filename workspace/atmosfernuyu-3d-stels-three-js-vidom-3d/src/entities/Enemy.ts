import * as THREE from 'three';
import { PhysicsWorld, RigidBody, CollisionLayer } from '../physics/PhysicsWorld';
import { RagdollController } from '../physics/RagdollController';
import { eventBus } from '../core/EventBus';

export enum EnemyType {
  SHADOW_BEETLE = 'SHADOW_BEETLE',
  FLYING_HORNET = 'FLYING_HORNET',
  ARMORED_CENTIPEDE = 'ARMORED_CENTIPEDE',
  COLOSSUS_GUARDIAN = 'COLOSSUS_GUARDIAN',
}

export enum AIState {
  PATROL,
  SUSPICIOUS,
  CHASE,
  ATTACK,
  STAGGER,
  DEAD,
}

export class Enemy {
  public mesh: THREE.Group;
  public body: RigidBody;
  public ragdoll: RagdollController;

  public type: EnemyType = EnemyType.SHADOW_BEETLE;
  public aiState: AIState = AIState.PATROL;

  public maxHp = 50;
  public hp = 50;
  public speed = 4.0;
  public damage = 15;
  public armor = 0.0;
  public isBoss = false;

  private attackCooldown = 1.2;
  private attackTimer = 0;
  private stateTimer = 0;
  private investigateTarget = new THREE.Vector3();
  private isStunned = false;
  private stunTimer = 0;

  public isAlive = false;

  constructor(private scene: THREE.Scene, private physics: PhysicsWorld) {
    this.mesh = new THREE.Group();
    this.body = new RigidBody({
      radius: 0.6,
      mass: 1.5,
      drag: 0.88,
      layer: CollisionLayer.ENEMY,
      mask: CollisionLayer.ALL,
    });
    this.body.userData = this;
    this.physics.addBody(this.body);

    this.ragdoll = new RagdollController(this.mesh, this.body);
    this.scene.add(this.mesh);
    this.mesh.visible = false;
    this.body.isActive = false;
  }

  spawn(type: EnemyType, position: THREE.Vector3, waveMultiplier = 1.0): void {
    this.type = type;
    this.isBoss = type === EnemyType.COLOSSUS_GUARDIAN;
    this.isAlive = true;
    this.aiState = AIState.PATROL;
    this.stateTimer = 0;
    this.attackTimer = 0;
    this.isStunned = false;

    this.configureStats(waveMultiplier);
    this.build3DVisual();

    this.body.radius = this.isBoss ? 1.8 : 0.6;
    this.body.mass = this.isBoss ? 15.0 : 1.5;
    this.body.teleport(position);
    this.body.isActive = true;

    this.mesh.position.copy(position);
    this.mesh.visible = true;

    if (this.isBoss) {
      eventBus.emit('boss:spawned', {
        name: 'ДРЕВНИЙ СТРАЖ БИБЛИОТЕКИ',
        hp: this.hp,
        maxHp: this.maxHp,
      });
    }
  }

  private configureStats(waveMul: number): void {
    switch (this.type) {
      case EnemyType.SHADOW_BEETLE:
        this.maxHp = Math.floor(40 * waveMul);
        this.speed = 4.8;
        this.damage = 12 * waveMul;
        this.armor = 0.05;
        break;
      case EnemyType.FLYING_HORNET:
        this.maxHp = Math.floor(30 * waveMul);
        this.speed = 6.2;
        this.damage = 18 * waveMul;
        this.armor = 0.0;
        break;
      case EnemyType.ARMORED_CENTIPEDE:
        this.maxHp = Math.floor(90 * waveMul);
        this.speed = 3.2;
        this.damage = 22 * waveMul;
        this.armor = 0.4;
        break;
      case EnemyType.COLOSSUS_GUARDIAN:
        this.maxHp = Math.floor(450 * waveMul);
        this.speed = 2.8;
        this.damage = 35 * waveMul;
        this.armor = 0.3;
        break;
    }
    this.hp = this.maxHp;
  }

  private build3DVisual(): void {
    // Clear old children
    while (this.mesh.children.length > 0) {
      this.mesh.remove(this.mesh.children[0]);
    }

    if (this.isBoss) {
      // Giant Guardian Golem
      const torsoGeo = new THREE.BoxGeometry(2.5, 2.5, 2.0);
      const torsoMat = new THREE.MeshStandardMaterial({
        color: '#424242',
        roughness: 0.4,
        metalness: 0.8,
      });
      const torso = new THREE.Mesh(torsoGeo, torsoMat);
      torso.position.y = 2.0;
      torso.castShadow = true;
      this.mesh.add(torso);

      const eyeGeo = new THREE.SphereGeometry(0.4, 12, 12);
      const eyeMat = new THREE.MeshStandardMaterial({
        color: '#ff1744',
        emissive: '#ff1744',
        emissiveIntensity: 1.0,
      });
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0, 2.5, 1.1);
      this.mesh.add(eye);

      // Horns
      const hornGeo = new THREE.ConeGeometry(0.3, 1.2, 8);
      const hornMat = new THREE.MeshStandardMaterial({ color: '#ffb300' });
      const leftHorn = new THREE.Mesh(hornGeo, hornMat);
      leftHorn.position.set(-1.0, 3.4, 0);
      leftHorn.rotation.z = 0.3;
      this.mesh.add(leftHorn);

      const rightHorn = new THREE.Mesh(hornGeo, hornMat);
      rightHorn.position.set(1.0, 3.4, 0);
      rightHorn.rotation.z = -0.3;
      this.mesh.add(rightHorn);
    } else if (this.type === EnemyType.FLYING_HORNET) {
      // Hornet Body
      const bodyGeo = new THREE.ConeGeometry(0.35, 1.0, 8);
      bodyGeo.rotateX(-Math.PI / 2);
      const bodyMat = new THREE.MeshStandardMaterial({ color: '#fbc02d', roughness: 0.3 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1.4;
      body.castShadow = true;
      this.mesh.add(body);

      // Wings
      const wingGeo = new THREE.PlaneGeometry(0.6, 0.3);
      const wingMat = new THREE.MeshBasicMaterial({
        color: '#e0f7fa',
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      const leftWing = new THREE.Mesh(wingGeo, wingMat);
      leftWing.position.set(-0.4, 1.6, 0);
      leftWing.rotation.x = Math.PI / 2;
      this.mesh.add(leftWing);

      const rightWing = new THREE.Mesh(wingGeo, wingMat);
      rightWing.position.set(0.4, 1.6, 0);
      rightWing.rotation.x = Math.PI / 2;
      this.mesh.add(rightWing);
    } else {
      // Crawler Beetle / Centipede
      const bodyGeo = new THREE.SphereGeometry(0.5, 12, 12);
      bodyGeo.scale(1, 0.7, 1.4);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: this.type === EnemyType.ARMORED_CENTIPEDE ? '#2e7d32' : '#8d6e63',
        roughness: 0.6,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.45;
      body.castShadow = true;
      this.mesh.add(body);

      // Red Glowing Eyes
      const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
      const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff3d00' });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.25, 0.55, 0.65);
      this.mesh.add(eyeL);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(0.25, 0.55, 0.65);
      this.mesh.add(eyeR);
    }
  }

  takeDamage(amount: number, knockbackDir: THREE.Vector3, isCritical = false): boolean {
    if (!this.isAlive) return false;

    const actualDamage = Math.max(1, amount * (1 - this.armor));
    this.hp -= actualDamage;

    // Apply physical knockback impulse
    const impulse = knockbackDir.clone().multiplyScalar(isCritical ? 14 : 8);
    this.body.applyImpulse(impulse);

    // Stagger
    this.stun(0.4);

    if (this.isBoss) {
      eventBus.emit('boss:hp_changed', { hp: this.hp, maxHp: this.maxHp });
    }

    if (this.hp <= 0) {
      this.die(knockbackDir);
      return true;
    }
    return false;
  }

  stun(duration: number): void {
    this.isStunned = true;
    this.stunTimer = duration;
    this.aiState = AIState.STAGGER;
  }

  investigateSound(pos: THREE.Vector3): void {
    if (!this.isAlive || this.aiState === AIState.CHASE) return;
    this.investigateTarget.copy(pos);
    this.aiState = AIState.SUSPICIOUS;
    this.stateTimer = 3.0;
  }

  private die(impactForce: THREE.Vector3): void {
    this.isAlive = false;
    this.aiState = AIState.DEAD;
    this.body.layer = CollisionLayer.NONE;
    this.body.mask = CollisionLayer.NONE;

    this.ragdoll.triggerDeathExplosion(impactForce);

    eventBus.emit('enemy:died', {
      position: this.body.position.clone(),
      type: this.type,
      isBoss: this.isBoss,
    });
  }

  update(dt: number, playerPos: THREE.Vector3, isPlayerStealthed: boolean): void {
    if (!this.isAlive) {
      const finished = this.ragdoll.update(dt);
      if (finished) {
        this.mesh.visible = false;
        this.body.isActive = false;
      }
      return;
    }

    // Sync mesh position with physics body
    this.mesh.position.copy(this.body.position);

    // Stun logic
    if (this.isStunned) {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) {
        this.isStunned = false;
        this.aiState = AIState.CHASE;
      }
      return;
    }

    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
    }

    const distToPlayer = this.body.position.distanceTo(playerPos);
    // Detection radius: 10m normal, 3.5m when stealthed
    const sightRadius = isPlayerStealthed ? (this.isBoss ? 6.0 : 3.8) : (this.isBoss ? 16.0 : 11.0);

    // State machine
    if (distToPlayer <= sightRadius) {
      this.aiState = AIState.CHASE;
    }

    let targetDir = new THREE.Vector3();

    switch (this.aiState) {
      case AIState.PATROL:
        this.stateTimer += dt;
        if (this.stateTimer > 4.0) {
          this.stateTimer = 0;
          this.investigateTarget.set(
            (Math.random() - 0.5) * 40,
            0.5,
            (Math.random() - 0.5) * 40
          );
        }
        targetDir.subVectors(this.investigateTarget, this.body.position);
        break;

      case AIState.SUSPICIOUS:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.aiState = AIState.PATROL;
        }
        targetDir.subVectors(this.investigateTarget, this.body.position);
        break;

      case AIState.CHASE:
        targetDir.subVectors(playerPos, this.body.position);
        if (distToPlayer < (this.isBoss ? 2.5 : 1.4) && this.attackTimer <= 0) {
          this.aiState = AIState.ATTACK;
          this.attackTimer = this.attackCooldown;
          eventBus.emit('enemy:attack', {
            enemy: this,
            damage: this.damage,
          });
        }
        break;

      case AIState.ATTACK:
        if (this.attackTimer <= this.attackCooldown - 0.3) {
          this.aiState = AIState.CHASE;
        }
        break;
    }

    targetDir.y = 0;
    const len = targetDir.length();
    if (len > 0.1) {
      targetDir.normalize();
      const moveSpeed = this.aiState === AIState.CHASE ? this.speed : this.speed * 0.5;
      this.body.velocity.x = THREE.MathUtils.lerp(this.body.velocity.x, targetDir.x * moveSpeed, dt * 6);
      this.body.velocity.z = THREE.MathUtils.lerp(this.body.velocity.z, targetDir.z * moveSpeed, dt * 6);

      // Face movement direction
      const angle = Math.atan2(targetDir.x, targetDir.z);
      this.mesh.rotation.y = angle;
    }
  }
}
