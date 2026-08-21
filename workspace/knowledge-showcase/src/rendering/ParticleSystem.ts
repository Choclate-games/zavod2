import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { RoadGenerator } from '../world/RoadGenerator';

export type ParticleKind =
  | 'exhaust'
  | 'tireSmoke'
  | 'dust'
  | 'mud'
  | 'waterSpray'
  | 'waterFoam'
  | 'waterRipple'
  | 'waterMist'
  | 'spark'
  | 'leaf'
  | 'confetti';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  quaternion: THREE.Quaternion;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  startOpacity: number;
  endOpacity: number;
  kind: ParticleKind;
  active: boolean;
  gravity: number;
  drag: number;
  turbScale: number;
  color?: THREE.Color;
}

const KIND_LIMITS: Record<ParticleKind, number> = {
  exhaust: 24,
  tireSmoke: 90,
  dust: 24,
  mud: 30,
  waterSpray: 24,
  waterFoam: 20,
  waterRipple: 12,
  waterMist: 12,
  spark: 16,
  leaf: 16,
  confetti: 32,
};

/**
 * Ultra-fast GPU-instanced particle system with zero memory allocations in the render loop.
 * Renders all tactical vehicle & environment effects using only 10 InstancedMesh draw calls:
 * - Fluid water spray droplets (tapered 3D cones oriented along velocity)
 * - Soft translucent white foam clusters & bubbles
 * - Expanding surface water ripple rings
 * - Low-altitude ballistic chunky mud splatters
 * - Diesel exhaust smoke (idle light puffs vs dark soot under load)
 * - Swirling dry dirt & dust trails
 * - Chassis bottoming & rock collision sparks
 * - Dynamic autumn leaves swirling in the vehicle wake
 * - Sawmill finish celebration confetti & sawdust explosion
 */
export class ParticleSystem {
  private readonly pool: Particle[] = [];
  private readonly instancedMeshes: Map<ParticleKind, THREE.InstancedMesh> = new Map();

  private readonly scratchVec = new THREE.Vector3();
  private readonly scratchVec2 = new THREE.Vector3();
  private readonly scaleVec = new THREE.Vector3();
  private readonly transformMatrix = new THREE.Matrix4();
  private readonly scratchQuat = new THREE.Quaternion();
  private readonly scratchEuler = new THREE.Euler();
  private readonly upAxis = new THREE.Vector3(0, 1, 0);
  private elapsed = 0;

  // Shared reusable geometries
  private readonly puffGeom: THREE.DodecahedronGeometry;
  private readonly chunkGeom: THREE.DodecahedronGeometry;
  private readonly sparkGeom: THREE.OctahedronGeometry;
  private readonly leafGeom: THREE.CircleGeometry;
  private readonly confettiGeom: THREE.CircleGeometry;
  private readonly dropletGeom: THREE.ConeGeometry;
  private readonly rippleGeom: THREE.RingGeometry;

  // Pre-allocated color objects
  private readonly leafColors = [new THREE.Color(0xdf9b20), new THREE.Color(0xd95725), new THREE.Color(0xab2328)];
  private readonly confettiColors = [
    new THREE.Color(0xffd21f),
    new THREE.Color(0xff3b69),
    new THREE.Color(0x22a6f5),
    new THREE.Color(0x2ec956),
  ];
  private readonly exhaustDarkColor = new THREE.Color(0x222224);
  private readonly exhaustLightColor = new THREE.Color(0xaaaaaa);

  constructor(
    private readonly scene: SceneManager,
    private readonly road: RoadGenerator,
  ) {
    this.puffGeom = new THREE.DodecahedronGeometry(0.45, 0); // 12 tris
    this.chunkGeom = new THREE.DodecahedronGeometry(0.32, 0);
    this.sparkGeom = new THREE.OctahedronGeometry(0.08, 0);
    this.leafGeom = new THREE.CircleGeometry(0.18, 5);
    this.confettiGeom = new THREE.CircleGeometry(0.14, 4);
    this.dropletGeom = new THREE.ConeGeometry(0.14, 0.45, 6);
    this.rippleGeom = new THREE.RingGeometry(0.1, 0.40, 12);
    this.rippleGeom.rotateX(-Math.PI / 2);

    this.initPool();
  }

  private initPool(): void {
    const mats = this.scene.materials;

    const setupKind = (
      kind: ParticleKind,
      geom: THREE.BufferGeometry,
      mat: THREE.Material,
      capacity: number,
    ): THREE.InstancedMesh => {
      const imesh = new THREE.InstancedMesh(geom, mat, capacity);
      imesh.count = 0;
      imesh.visible = false;
      imesh.castShadow = false;
      imesh.receiveShadow = false;
      // Particles live in world space while the mesh itself sits at the origin.
      // THREE.Frustum.intersectsObject computes InstancedMesh.boundingSphere once and then
      // caches it forever, so the sphere stays pinned near the spawn point: as soon as the
      // truck drives away every emitter is culled and no particle is ever drawn again.
      // Same trap as the tire tracks buffer — see TireTracksManager.
      imesh.frustumCulled = false;
      this.scene.particleGroup.add(imesh);
      this.instancedMeshes.set(kind, imesh);

      for (let i = 0; i < capacity; i += 1) {
        this.pool.push({
          position: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          rotVelocity: new THREE.Vector3(),
          quaternion: new THREE.Quaternion(),
          life: 0,
          maxLife: 1,
          startScale: 0.1,
          endScale: 0.5,
          startOpacity: 0.5,
          endOpacity: 0.0,
          kind,
          active: false,
          gravity: -9.8,
          drag: 0.95,
          turbScale: 0,
        });
      }
      return imesh;
    };

    setupKind('exhaust', this.puffGeom, mats.smokeParticle, KIND_LIMITS.exhaust);
    setupKind('tireSmoke', this.puffGeom, mats.tireSmokeParticle, KIND_LIMITS.tireSmoke);
    setupKind('dust', this.puffGeom, mats.dustParticle, KIND_LIMITS.dust);
    setupKind('mud', this.chunkGeom, mats.mudParticle, KIND_LIMITS.mud);
    setupKind('waterSpray', this.dropletGeom, mats.waterSpray, KIND_LIMITS.waterSpray);
    setupKind('waterFoam', this.puffGeom, mats.waterFoam, KIND_LIMITS.waterFoam);
    setupKind('waterRipple', this.rippleGeom, mats.waterRipple, KIND_LIMITS.waterRipple);
    setupKind('waterMist', this.puffGeom, mats.waterMist, KIND_LIMITS.waterMist);
    setupKind('spark', this.sparkGeom, mats.sparkParticle, KIND_LIMITS.spark);
    setupKind('leaf', this.leafGeom, mats.leafGold, KIND_LIMITS.leaf);
    setupKind('confetti', this.confettiGeom, mats.confettiGold, KIND_LIMITS.confetti);
  }

  private acquire(kind: ParticleKind): Particle | null {
    for (const p of this.pool) {
      if (!p.active && p.kind === kind) return p;
    }
    let oldest: Particle | null = null;
    let maxProgress = -1;
    for (const p of this.pool) {
      if (p.kind === kind) {
        const progress = p.life / p.maxLife;
        if (progress > maxProgress) {
          maxProgress = progress;
          oldest = p;
        }
      }
    }
    return oldest;
  }

  /**
   * Multi-layered fluid water splash VFX.
   */
  emitWaterSplash(
    pos: THREE.Vector3,
    forward: THREE.Vector3,
    speed: number,
    waterIntensity: number,
    wheelRadius = 0.6,
  ): void {
    const intensity = Math.min(1.0, waterIntensity);
    const speedMag = Math.abs(speed);
    const groundY = pos.y - wheelRadius * 0.92 + 0.02;

    // 1. Fluid Water Spray Droplets (wide radial fan, low height)
    const dropCount = Math.min(6, Math.round(3 + intensity * 3 + speedMag * 0.18));
    for (let c = 0; c < dropCount; c += 1) {
      const p = this.acquire('waterSpray');
      if (!p) break;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.25;

      const side = c % 2 === 0 ? 1 : -1;
      const spreadX = side * (0.60 + Math.random() * 0.85);
      p.position.set(pos.x + spreadX * 0.5, groundY, pos.z + (Math.random() - 0.5) * 0.4);

      const sideVel = side * (6.5 + Math.random() * 8.0 * intensity);
      const upVel = 1.0 + Math.random() * 2.2 * intensity + speedMag * 0.08;
      const forwardVel = forward.z * (speed * 0.35) + (Math.random() - 0.5) * 2.5;

      p.velocity.set(sideVel, upVel, forwardVel);
      p.rotVelocity.set(0, 0, 0);

      this.scratchVec.copy(p.velocity).normalize();
      if (this.scratchVec.lengthSq() > 0.01) {
        p.quaternion.setFromUnitVectors(this.upAxis, this.scratchVec);
      } else {
        p.quaternion.identity();
      }

      p.startScale = 0.42 + Math.random() * 0.30 * intensity;
      p.endScale = p.startScale * 0.75;
      p.startOpacity = 0.60;
      p.endOpacity = 0.0;
      p.gravity = -14.0;
      p.drag = 0.95;
      p.turbScale = 0.2;
    }

    // 2. Soft Translucent White Foam Bubbles
    const foamCount = Math.min(4, Math.round(2 + intensity * 3));
    for (let c = 0; c < foamCount; c += 1) {
      const p = this.acquire('waterFoam');
      if (!p) break;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.42 + Math.random() * 0.30;

      const spreadX = (Math.random() - 0.5) * 1.2;
      p.position.set(pos.x + spreadX, groundY + 0.01, pos.z + (Math.random() - 0.5) * 0.5);

      p.velocity.set(
        spreadX * 4.2,
        0.5 + Math.random() * 1.2 * intensity,
        -forward.z * (1.0 + Math.random() * 1.8),
      );
      p.rotVelocity.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
      p.quaternion.identity();

      p.startScale = 0.22 + Math.random() * 0.24;
      p.endScale = p.startScale * 1.8;
      p.startOpacity = 0.35;
      p.endOpacity = 0.0;
      p.gravity = -2.0;
      p.drag = 0.88;
      p.turbScale = 0.5;
    }

    // 3. Broad Surface Water Ripple Waves
    if (Math.random() < 0.8) {
      const p = this.acquire('waterRipple');
      if (p) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.70 + Math.random() * 0.35;

        p.position.set(pos.x + (Math.random() - 0.5) * 0.4, groundY + 0.015, pos.z);
        p.velocity.set(0, 0, 0);
        p.rotVelocity.set(0, 0, 0);
        p.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

        p.startScale = 0.6;
        p.endScale = 3.6 + intensity * 2.2;
        p.startOpacity = 0.45;
        p.endOpacity = 0.0;
        p.gravity = 0;
        p.drag = 1.0;
        p.turbScale = 0;
      }
    }

    // 4. Fine Translucent Water Mist
    if (speedMag > 8 && Math.random() < 0.5) {
      const p = this.acquire('waterMist');
      if (p) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.65 + Math.random() * 0.35;

        p.position.set(pos.x + (Math.random() - 0.5) * 0.8, groundY + 0.2, pos.z - 0.3);
        p.velocity.set((Math.random() - 0.5) * 1.8, 0.3 + Math.random() * 0.5, -forward.z * 1.5);
        p.rotVelocity.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
        p.quaternion.identity();

        p.startScale = 0.45;
        p.endScale = 1.5;
        p.startOpacity = 0.18;
        p.endOpacity = 0.0;
        p.gravity = 0.15;
        p.drag = 0.90;
        p.turbScale = 0.6;
      }
    }
  }

  /**
   * Diesel exhaust puff: light translucent grey at idle, dark soot under load.
   */
  emitExhaust(pos: THREE.Vector3, forward: THREE.Vector3, throttle: number, speed: number, isVerticalStack = false): void {
    const p = this.acquire('exhaust');
    if (!p) return;

    p.active = true;
    p.life = 0;

    const isHeavyLoad = throttle > 0.35 || speed > 12;
    p.maxLife = isHeavyLoad ? 0.80 + Math.random() * 0.40 : 0.50 + Math.random() * 0.30;
    p.startScale = isHeavyLoad ? 0.20 : 0.12;
    p.endScale = isHeavyLoad ? 0.80 + Math.random() * 0.35 : 0.40 + Math.random() * 0.2;
    p.startOpacity = isHeavyLoad ? 0.50 : 0.25;
    p.endOpacity = 0.0;
    p.gravity = isVerticalStack ? 1.4 : 0.8;
    p.drag = 0.92;
    p.turbScale = 0.8;
    p.color = isHeavyLoad ? this.exhaustDarkColor : this.exhaustLightColor;

    p.position.copy(pos).add(
      this.scratchVec.set((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08),
    );

    const exitVelZ = isVerticalStack ? -1.0 : -2.5 - Math.random() * 2.0;
    const exitVelY = isVerticalStack ? 2.8 + Math.random() * 1.8 : 0.6 + Math.random() * 0.8;
    const spreadX = (Math.random() - 0.5) * 0.6;

    p.velocity.set(
      forward.x * exitVelZ + spreadX,
      exitVelY,
      forward.z * exitVelZ + (Math.random() - 0.5) * 0.5,
    );

    p.rotVelocity.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    p.quaternion.identity();
  }

  /**
   * Thick burnt-rubber smoke billowing from a spinning / locked tire (burnout, lockup, drift).
   * Emitted right at the contact patch and rolls outward low along the ground before rising.
   */
  emitTireSmoke(
    pos: THREE.Vector3,
    forward: THREE.Vector3,
    intensity: number,
    wheelRadius = 0.6,
    count = 2,
  ): void {
    const clamped = Math.min(1.0, Math.max(0, intensity));
    const total = Math.max(1, Math.round(count * (0.5 + clamped * 0.9)));

    for (let n = 0; n < total; n += 1) {
      const p = this.acquire('tireSmoke');
      if (!p) return;

      p.active = true;
      p.life = 0;

      // Long-lived, large and slow: rubber smoke lingers far longer than dust
      p.maxLife = 1.1 + Math.random() * 0.9 * (0.5 + clamped);
      p.startScale = 0.16 + Math.random() * 0.10;
      p.endScale = 1.15 + Math.random() * 0.85 * (0.4 + clamped);
      p.startOpacity = 0.30 * (0.35 + clamped * 0.65);
      p.endOpacity = 0.0;
      p.gravity = 0.85; // buoyant — hot smoke rises
      p.drag = 0.90;
      p.turbScale = 1.15; // strong curl/turbulence
      p.color = undefined;

      // Spawn at the contact patch, spread across the tire width
      const spreadX = (Math.random() - 0.5) * 0.55;
      const groundY = pos.y - wheelRadius * 0.90 + 0.03;
      p.position.set(pos.x + spreadX, groundY + Math.random() * 0.12, pos.z + (Math.random() - 0.5) * 0.4);

      // Rubber smoke is thrown backwards off the rim, then billows sideways and up
      const backSpeed = 1.2 + Math.random() * 2.4 * (0.4 + clamped);
      p.velocity.set(
        -forward.x * backSpeed + spreadX * 3.6,
        0.55 + Math.random() * 0.85,
        -forward.z * backSpeed + (Math.random() - 0.5) * 1.5,
      );

      p.rotVelocity.set((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8);
      p.quaternion.identity();
    }
  }

  /**
   * Swirling dust cloud kicked up from spinning or fast-rolling tires on dry road.
   */
  emitDustCloud(pos: THREE.Vector3, forward: THREE.Vector3, speed: number, intensity = 1.0, wheelRadius = 0.6): void {
    const p = this.acquire('dust');
    if (!p) return;

    p.active = true;
    p.life = 0;

    p.maxLife = 0.60 + Math.random() * 0.40;
    p.startScale = 0.22;
    p.endScale = 0.90 + Math.random() * 0.50 * intensity;
    p.startOpacity = 0.26 * Math.min(1.0, intensity);
    p.endOpacity = 0.0;
    p.gravity = 0.25;
    p.drag = 0.88;
    p.turbScale = 0.5;

    const spreadX = (Math.random() - 0.5) * 0.45;
    const groundY = pos.y - wheelRadius * 0.92 + 0.02;
    p.position.set(pos.x + spreadX, groundY, pos.z - 0.2);

    const backSpeed = -Math.sign(speed || 1) * (1.5 + Math.random() * 2.8);
    p.velocity.set(
      spreadX * 3.2,
      0.4 + Math.random() * 0.7,
      forward.z * backSpeed + (Math.random() - 0.5) * 1.2,
    );

    p.rotVelocity.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
    p.quaternion.identity();
  }

  /**
   * Chunky mud spray with low ground trajectory.
   */
  emitMudSpray(pos: THREE.Vector3, forward: THREE.Vector3, rotSpeed: number, mud: number, wheelRadius = 0.6): void {
    const count = Math.min(4, Math.round(mud * 2.5 + Math.abs(rotSpeed) * 0.09));
    const groundY = pos.y - wheelRadius * 0.96 + 0.02;

    for (let c = 0; c < count; c += 1) {
      const p = this.acquire('mud');
      if (!p) break;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.32 + Math.random() * 0.28;

      const spreadX = (Math.random() - 0.5) * 0.4;
      p.position.set(pos.x + spreadX, groundY, pos.z - 0.2);

      const backwardSpeed = -Math.sign(rotSpeed || 1) * (2.8 + Math.random() * 4.6);
      const upwardSpeed = 0.8 + Math.random() * 1.5 * mud;

      p.velocity.set(
        spreadX * 4.8,
        upwardSpeed,
        forward.z * backwardSpeed + (Math.random() - 0.5) * 1.8,
      );

      p.rotVelocity.set((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7);
      p.quaternion.identity();

      p.startScale = 0.12 + Math.random() * 0.20 * mud;
      p.endScale = p.startScale * 0.85;
      p.startOpacity = 1.0;
      p.endOpacity = 1.0;
      p.gravity = -16.0;
      p.drag = 0.98;
      p.turbScale = 0;
    }
  }

  /**
   * Bright collision sparks on harsh rock / bottoming impacts.
   */
  emitSparks(pos: THREE.Vector3, normal?: THREE.Vector3, count = 8): void {
    const norm = normal || this.scratchVec2.set(0, 1, 0);
    for (let i = 0; i < count; i += 1) {
      const p = this.acquire('spark');
      if (!p) break;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.18 + Math.random() * 0.22;

      p.position.copy(pos).add(
        this.scratchVec.set((Math.random() - 0.5) * 0.15, 0.05, (Math.random() - 0.5) * 0.15),
      );

      const speed = 4.5 + Math.random() * 6.5;
      const angleH = Math.random() * Math.PI * 2;
      const angleV = 0.2 + Math.random() * 0.9;

      p.velocity.set(
        Math.cos(angleH) * Math.cos(angleV) * speed + norm.x * 2.0,
        Math.sin(angleV) * speed + norm.y * 2.0,
        Math.sin(angleH) * Math.cos(angleV) * speed + norm.z * 2.0,
      );

      p.rotVelocity.set((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15);
      p.quaternion.identity();

      p.startScale = 0.18 + Math.random() * 0.15;
      p.endScale = 0.02;
      p.startOpacity = 1.0;
      p.endOpacity = 1.0;
      p.gravity = -18.0;
      p.drag = 0.96;
      p.turbScale = 0;
    }
  }

  /**
   * Swirling autumn leaves fluttering in the forest wind / truck slipstream.
   */
  emitLeaves(pos: THREE.Vector3, speed: number, count = 2): void {
    for (let i = 0; i < count; i += 1) {
      const p = this.acquire('leaf');
      if (!p) break;

      p.active = true;
      p.life = 0;
      p.maxLife = 1.4 + Math.random() * 0.9;

      p.position.set(
        pos.x + (Math.random() - 0.5) * 2.8,
        pos.y + 1.2 + Math.random() * 1.5,
        pos.z + (Math.random() - 0.5) * 2.0,
      );

      const slipstreamZ = -Math.sign(speed || 1) * (1.2 + Math.random() * 2.5);
      p.velocity.set(
        (Math.random() - 0.5) * 2.5,
        -0.8 - Math.random() * 1.2,
        slipstreamZ,
      );

      p.rotVelocity.set(
        (Math.random() - 0.5) * 7.0,
        (Math.random() - 0.5) * 8.0,
        (Math.random() - 0.5) * 6.0,
      );
      p.quaternion.identity();

      p.startScale = 0.22 + Math.random() * 0.14;
      p.endScale = p.startScale;
      p.startOpacity = 1.0;
      p.endOpacity = 1.0;
      p.gravity = -1.8;
      p.drag = 0.94;
      p.turbScale = 1.5;
      p.color = this.leafColors[Math.floor(Math.random() * this.leafColors.length)];
    }
  }

  /**
   * Celebratory confetti & golden sawdust explosion at the Sawmill finish line.
   */
  emitFinishCelebration(pos: THREE.Vector3): void {
    for (let i = 0; i < 28; i += 1) {
      const p = this.acquire('confetti');
      if (!p) break;

      p.active = true;
      p.life = 0;
      p.maxLife = 1.8 + Math.random() * 1.2;

      p.position.set(
        pos.x + (Math.random() - 0.5) * 2.5,
        pos.y + 2.0 + Math.random() * 1.5,
        pos.z + (Math.random() - 0.5) * 2.5,
      );

      const shootSpeed = 5.0 + Math.random() * 8.0;
      const angle = Math.random() * Math.PI * 2;

      p.velocity.set(
        Math.cos(angle) * shootSpeed * 0.7,
        4.0 + Math.random() * 7.0,
        Math.sin(angle) * shootSpeed * 0.7,
      );

      p.rotVelocity.set(
        (Math.random() - 0.5) * 12.0,
        (Math.random() - 0.5) * 12.0,
        (Math.random() - 0.5) * 12.0,
      );
      p.quaternion.identity();

      p.startScale = 0.2 + Math.random() * 0.2;
      p.endScale = p.startScale;
      p.startOpacity = 1.0;
      p.endOpacity = 1.0;
      p.gravity = -4.5;
      p.drag = 0.92;
      p.turbScale = 1.8;
      p.color = this.confettiColors[Math.floor(Math.random() * this.confettiColors.length)];
    }
  }

  reset(): void {
    for (const p of this.pool) {
      p.active = false;
    }
    for (const imesh of this.instancedMeshes.values()) {
      imesh.count = 0;
      imesh.visible = false;
    }
  }

  update(dt: number): void {
    this.elapsed += dt;

    // 1. Update physics for all active particles
    for (const p of this.pool) {
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }

      p.velocity.y += p.gravity * dt;
      p.velocity.x *= Math.pow(p.drag, dt * 60);
      p.velocity.z *= Math.pow(p.drag, dt * 60);

      if (p.turbScale > 0) {
        const freq = this.elapsed * 4.0 + p.life * 10;
        p.velocity.x += Math.sin(freq) * p.turbScale * dt;
        p.velocity.z += Math.cos(freq * 1.3) * p.turbScale * dt;
      }

      p.position.addScaledVector(p.velocity, dt);

      if (p.kind === 'waterSpray') {
        this.scratchVec.copy(p.velocity).normalize();
        if (this.scratchVec.lengthSq() > 0.01) {
          p.quaternion.setFromUnitVectors(this.upAxis, this.scratchVec);
        }
      } else {
        this.scratchEuler.set(p.rotVelocity.x * dt, p.rotVelocity.y * dt, p.rotVelocity.z * dt);
        this.scratchQuat.setFromEuler(this.scratchEuler);
        p.quaternion.multiply(this.scratchQuat);
      }

      const groundY = this.road.heightAt(p.position.x, p.position.z);
      if (p.position.y <= groundY - 0.05) {
        if (
          p.kind === 'spark' ||
          p.kind === 'mud' ||
          p.kind === 'waterSpray' ||
          p.kind === 'waterMist'
        ) {
          p.active = false;
        } else if (p.kind === 'waterFoam' || p.kind === 'waterRipple') {
          p.position.y = groundY + 0.02;
          p.velocity.y = 0;
        } else {
          p.position.y = groundY + 0.02;
          p.velocity.set(0, 0, 0);
          p.rotVelocity.set(0, 0, 0);
        }
      }
    }

    // 2. Build instance matrices and update InstancedMesh counts (10 draw calls max)
    const activeCounts: Record<ParticleKind, number> = {
      exhaust: 0,
      tireSmoke: 0,
      dust: 0,
      mud: 0,
      waterSpray: 0,
      waterFoam: 0,
      waterRipple: 0,
      waterMist: 0,
      spark: 0,
      leaf: 0,
      confetti: 0,
    };

    for (const p of this.pool) {
      if (!p.active) continue;

      const idx = activeCounts[p.kind];
      const limit = KIND_LIMITS[p.kind];
      if (idx >= limit) continue;

      const imesh = this.instancedMeshes.get(p.kind);
      if (!imesh) continue;

      const progress = p.life / p.maxLife;
      const curScale = THREE.MathUtils.lerp(p.startScale, p.endScale, progress);
      this.scaleVec.set(curScale, curScale, curScale);

      this.transformMatrix.compose(p.position, p.quaternion, this.scaleVec);
      imesh.setMatrixAt(idx, this.transformMatrix);

      if (p.color) {
        imesh.setColorAt(idx, p.color);
      }

      activeCounts[p.kind] += 1;
    }

    for (const [kind, imesh] of this.instancedMeshes.entries()) {
      const count = activeCounts[kind];
      imesh.count = count;
      imesh.visible = count > 0;
      if (count > 0) {
        imesh.instanceMatrix.needsUpdate = true;
        if (imesh.instanceColor) imesh.instanceColor.needsUpdate = true;
      }
    }
  }
}
