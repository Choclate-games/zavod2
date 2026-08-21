import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export interface DebrisParticleState {
  active: boolean;
  color: number;
  scale: number;
  life: number;
  maxLife: number;
  bounces: number;
  body: RAPIER.RigidBody;
}

export class PhysicsWorld {
  private static instance: PhysicsWorld | null = null;
  public world!: RAPIER.World;
  private isInitialized = false;

  // Static scene colliders
  private chuteLeftCollider!: RAPIER.Collider;
  private chuteRightCollider!: RAPIER.Collider;
  private chuteBackCollider!: RAPIER.Collider;
  private chuteFrontCollider!: RAPIER.Collider;
  private basketFloorCollider!: RAPIER.Collider;
  private basketBackCollider!: RAPIER.Collider;
  private basketFrontCollider!: RAPIER.Collider;
  private basketLeftCollider!: RAPIER.Collider;
  private basketRightCollider!: RAPIER.Collider;

  // Kinematic roller bodies
  private leftRollerBody!: RAPIER.RigidBody;
  private rightRollerBody!: RAPIER.RigidBody;

  // Dynamic debris rigid body pool
  public readonly maxDebris = 1000;
  public debrisPool: DebrisParticleState[] = [];
  public freeDebrisIndices: number[] = [];
  public activeDebrisCount = 0;

  // Fixed timestep accumulator
  private readonly fixedTimeStep = 1 / 60;
  private accumulator = 0;

  public onParticleCollected?: (color: number, worldX: number, worldY: number) => void;

  public static getInstance(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld();
    }
    return PhysicsWorld.instance;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    await RAPIER.init();
    console.log('[PhysicsWorld] Rapier3D initialized successfully.');

    const gravity = { x: 0.0, y: -14.0, z: 0.0 };
    this.world = new RAPIER.World(gravity);

    this.setupStaticColliders();
    this.setupKinematicRollers();
    this.setupDebrisPool();

    this.isInitialized = true;
  }

  private setupStaticColliders(): void {
    // 1. Funnel Chute Left: inclined wall at (-2.2, 3.2, 0) rotated around Z by -0.15 rad
    const chuteLeftBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(-2.2, 3.2, 0)
      .setRotation({ x: 0, y: 0, z: Math.sin(-0.15 / 2), w: Math.cos(-0.15 / 2) });
    const chuteLeftBody = this.world.createRigidBody(chuteLeftBodyDesc);
    const chuteLeftColliderDesc = RAPIER.ColliderDesc.cuboid(0.15, 2.5, 2.2)
      .setRestitution(0.3)
      .setFriction(0.2);
    this.chuteLeftCollider = this.world.createCollider(chuteLeftColliderDesc, chuteLeftBody);

    // 2. Funnel Chute Right: inclined wall at (2.2, 3.2, 0) rotated around Z by 0.15 rad
    const chuteRightBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(2.2, 3.2, 0)
      .setRotation({ x: 0, y: 0, z: Math.sin(0.15 / 2), w: Math.cos(0.15 / 2) });
    const chuteRightBody = this.world.createRigidBody(chuteRightBodyDesc);
    const chuteRightColliderDesc = RAPIER.ColliderDesc.cuboid(0.15, 2.5, 2.2)
      .setRestitution(0.3)
      .setFriction(0.2);
    this.chuteRightCollider = this.world.createCollider(chuteRightColliderDesc, chuteRightBody);

    // 3. Front & Back Guide Plates to keep particles inside viewport
    const chuteBackDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, -2.1);
    const chuteBackBody = this.world.createRigidBody(chuteBackDesc);
    this.chuteBackCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(3.0, 5.0, 0.1).setRestitution(0.2).setFriction(0.1),
      chuteBackBody
    );

    const chuteFrontDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 2.1);
    const chuteFrontBody = this.world.createRigidBody(chuteFrontDesc);
    this.chuteFrontCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(3.0, 5.0, 0.1).setRestitution(0.2).setFriction(0.1),
      chuteFrontBody
    );

    // 4. Basket Bottom Floor at y = -3.45
    const basketFloorDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -3.45, 0);
    const basketFloorBody = this.world.createRigidBody(basketFloorDesc);
    this.basketFloorCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(2.5, 0.1, 2.0).setRestitution(0.35).setFriction(0.5),
      basketFloorBody
    );

    // 5. Basket Walls (Back, Front, Left, Right)
    const basketBackDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -3.2, -1.8);
    const basketBackBody = this.world.createRigidBody(basketBackDesc);
    this.basketBackCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(2.5, 1.1, 0.15).setRestitution(0.3).setFriction(0.4),
      basketBackBody
    );

    const basketFrontDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -3.6, 1.8);
    const basketFrontBody = this.world.createRigidBody(basketFrontDesc);
    this.basketFrontCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(2.5, 0.7, 0.15).setRestitution(0.3).setFriction(0.4),
      basketFrontBody
    );

    const basketLeftDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(-2.4, -3.2, 0);
    const basketLeftBody = this.world.createRigidBody(basketLeftDesc);
    this.basketLeftCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.15, 1.1, 2.0).setRestitution(0.3).setFriction(0.4),
      basketLeftBody
    );

    const basketRightDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(2.4, -3.2, 0);
    const basketRightBody = this.world.createRigidBody(basketRightDesc);
    this.basketRightCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.15, 1.1, 2.0).setRestitution(0.3).setFriction(0.4),
      basketRightBody
    );
  }

  private setupKinematicRollers(): void {
    const rollerRadius = 0.75;
    const rollerHalfLength = 1.6;

    // Left Roller Body
    const leftDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(-0.81, 0, 0);
    this.leftRollerBody = this.world.createRigidBody(leftDesc);
    // Cylinder collider aligned along Z axis
    // Rapier cylinder is along Y by default, rotate by 90 deg around X to align with Z axis
    const rotCylX = Math.sin(Math.PI / 4);
    const rotCylW = Math.cos(Math.PI / 4);
    const leftColDesc = RAPIER.ColliderDesc.cylinder(rollerHalfLength, rollerRadius)
      .setRotation({ x: rotCylX, y: 0, z: 0, w: rotCylW })
      .setRestitution(0.2)
      .setFriction(0.6);
    this.world.createCollider(leftColDesc, this.leftRollerBody);

    // Right Roller Body
    const rightDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0.81, 0, 0);
    this.rightRollerBody = this.world.createRigidBody(rightDesc);
    const rightColDesc = RAPIER.ColliderDesc.cylinder(rollerHalfLength, rollerRadius)
      .setRotation({ x: rotCylX, y: 0, z: 0, w: rotCylW })
      .setRestitution(0.2)
      .setFriction(0.6);
    this.world.createCollider(rightColDesc, this.rightRollerBody);
  }

  private setupDebrisPool(): void {
    const halfVoxel = 0.06; // Voxel particle box half-size
    this.debrisPool = new Array(this.maxDebris);
    this.freeDebrisIndices = [];

    for (let i = 0; i < this.maxDebris; i++) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, -100 - i * 0.5, 0)
        .setCanSleep(true)
        .setLinearDamping(0.3)
        .setAngularDamping(0.8);

      const body = this.world.createRigidBody(bodyDesc);
      body.setEnabled(false);

      const colDesc = RAPIER.ColliderDesc.cuboid(halfVoxel, halfVoxel, halfVoxel)
        .setDensity(1.5)
        .setRestitution(0.35)
        .setFriction(0.4);

      this.world.createCollider(colDesc, body);

      this.debrisPool[i] = {
        active: false,
        color: 0xffffff,
        scale: 1.0,
        life: 0,
        maxLife: 2.0,
        bounces: 0,
        body
      };

      this.freeDebrisIndices.push(i);
    }
  }

  public updateRollersKinematics(leftRotZ: number, rightRotZ: number): void {
    if (!this.isInitialized) return;

    // Set rotation of left roller
    const qLeftZ = Math.sin(leftRotZ / 2);
    const qLeftW = Math.cos(leftRotZ / 2);
    this.leftRollerBody.setNextKinematicRotation({ x: 0, y: 0, z: qLeftZ, w: qLeftW });

    // Set rotation of right roller
    const qRightZ = Math.sin(rightRotZ / 2);
    const qRightW = Math.cos(rightRotZ / 2);
    this.rightRollerBody.setNextKinematicRotation({ x: 0, y: 0, z: qRightZ, w: qRightW });
  }

  public spawnDebris(
    worldX: number,
    worldY: number,
    worldZ: number,
    velX: number,
    velY: number,
    velZ: number,
    color: number,
    isTurbo: boolean
  ): number {
    if (!this.isInitialized) return -1;

    let index: number;
    if (this.freeDebrisIndices.length > 0) {
      index = this.freeDebrisIndices.pop()!;
    } else {
      // Recycle oldest or random particle
      index = Math.floor(Math.random() * this.maxDebris);
    }

    const p = this.debrisPool[index];
    const body = p.body;

    p.active = true;
    p.color = color;
    p.scale = 1.0;
    p.life = 0;
    p.maxLife = 1.8 + Math.random() * 0.8;
    p.bounces = 0;

    body.setEnabled(true);
    body.setTranslation({ x: worldX, y: worldY, z: worldZ }, true);
    body.setLinvel({ x: velX, y: velY, z: velZ }, true);

    // Random 3D angular spin torque for realistic voxel tumbling
    const spinMagnitude = isTurbo ? 22 : 12;
    body.setAngvel(
      {
        x: (Math.random() - 0.5) * spinMagnitude,
        y: (Math.random() - 0.5) * spinMagnitude,
        z: (Math.random() - 0.5) * spinMagnitude
      },
      true
    );

    // Small random orientation
    const randAngle = Math.random() * Math.PI * 2;
    body.setRotation(
      {
        x: Math.sin(randAngle / 4) * 0.3,
        y: Math.sin(randAngle / 4) * 0.3,
        z: Math.sin(randAngle / 2),
        w: Math.cos(randAngle / 2)
      },
      true
    );

    this.activeDebrisCount++;
    return index;
  }

  public recycleDebris(index: number): void {
    const p = this.debrisPool[index];
    if (!p.active) return;

    p.active = false;
    p.body.setEnabled(false);
    p.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    p.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    p.body.setTranslation({ x: 0, y: -100 - index * 0.5, z: 0 }, false);

    this.freeDebrisIndices.push(index);
    this.activeDebrisCount = Math.max(0, this.activeDebrisCount - 1);
  }

  public resetAllDebris(): void {
    this.freeDebrisIndices = [];
    for (let i = 0; i < this.maxDebris; i++) {
      const p = this.debrisPool[i];
      p.active = false;
      p.body.setEnabled(false);
      p.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      p.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
      p.body.setTranslation({ x: 0, y: -100 - i * 0.5, z: 0 }, false);
      this.freeDebrisIndices.push(i);
    }
    this.activeDebrisCount = 0;
  }

  public step(dt: number): void {
    if (!this.isInitialized) return;

    // Fixed timestep accumulator for stable Rapier simulation
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator >= this.fixedTimeStep) {
      this.world.step();
      this.accumulator -= this.fixedTimeStep;
    }

    if (this.activeDebrisCount === 0) return;

    const basketFloorY = -3.4;

    for (let i = 0; i < this.maxDebris; i++) {
      const p = this.debrisPool[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        this.recycleDebris(i);
        continue;
      }

      const translation = p.body.translation();
      const linvel = p.body.linvel();

      // Check landing and bouncing on basket floor
      if (translation.y <= basketFloorY + 0.15) {
        p.bounces++;
        if (p.bounces === 1 && this.onParticleCollected) {
          this.onParticleCollected(p.color, translation.x, translation.y);
        }

        // Decay scale after settling
        if (p.bounces >= 3 || p.life > 0.8) {
          p.scale = Math.max(0, p.scale - dt * 2.2);
          if (p.scale <= 0.05) {
            this.recycleDebris(i);
            continue;
          }
        }
      }

      // Safeguard: recycle particles fallen too far down
      if (translation.y < -5.0) {
        this.recycleDebris(i);
      }
    }
  }
}
