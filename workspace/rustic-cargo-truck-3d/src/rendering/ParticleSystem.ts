import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { RoadGenerator } from '../world/RoadGenerator';

export type ParticleKind =
  | 'exhaust'
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
  mesh: THREE.Mesh;
  material: THREE.Material;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
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
}

/**
 * High-performance, zero-allocation particle system for realistic tactile vehicle and environment VFX.
 * Features:
 * - Fluid curved water spray droplets (tapered 3D cones/droplets oriented along trajectory, NO square quads)
 * - Soft fluffy white foam clusters & bubbles
 * - Ultra-smooth circular expanding ripple waves
 * - Diesel exhaust smoke (idle light puffs vs heavy dark-grey soot under load)
 * - Swirling dry dirt & dust trails
 * - Ballistic chunky mud splatters
 * - Bottoming out & rock collision sparks
 * - Dynamic autumn leaves swirling in the vehicle wake
 * - Sawmill finish celebration confetti and sawdust burst
 */
export class ParticleSystem {
  private readonly pool: Particle[] = [];
  private readonly scratchVec = new THREE.Vector3();
  private readonly scratchVec2 = new THREE.Vector3();
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

  constructor(
    private readonly scene: SceneManager,
    private readonly road: RoadGenerator,
  ) {
    this.puffGeom = new THREE.DodecahedronGeometry(0.45, 1);
    this.chunkGeom = new THREE.DodecahedronGeometry(0.32, 0);
    this.sparkGeom = new THREE.OctahedronGeometry(0.08, 0);
    this.leafGeom = new THREE.CircleGeometry(0.18, 6);
    this.confettiGeom = new THREE.CircleGeometry(0.14, 5);
    this.dropletGeom = new THREE.ConeGeometry(0.15, 0.48, 8);
    this.rippleGeom = new THREE.RingGeometry(0.1, 0.42, 24);
    this.rippleGeom.rotateX(-Math.PI / 2);

    this.initPool();
  }

  private initPool(): void {
    const mats = this.scene.materials;

    // 1. Exhaust smoke particles (30 items)
    for (let i = 0; i < 30; i += 1) {
      const mat = mats.smokeParticle.clone();
      const mesh = new THREE.Mesh(this.puffGeom, mat);
      mesh.visible = false;
      this.scene.particleGroup.add(mesh);
      this.pool.push(this.createParticleObject(mesh, mat, 'exhaust'));
    }

    // 2. Wheel dust cloud particles (30 items)
    for (let i = 0; i < 30; i += 1) {
      const mat = mats.dustParticle.clone();
      const mesh = new THREE.Mesh(this.puffGeom, mat);
      mesh.visible = false;
      this.scene.particleGroup.add(mesh);
      this.pool.push(this.createParticleObject(mesh, mat, 'dust'));
    }

    // 3. Mud chunks & spray (40 items)
    for (let i = 0; i < 40; i += 1) {
      const mat = mats.mudParticle.clone();
      const mesh = new THREE.Mesh(this.chunkGeom, mat);
      mesh.visible = false;
      this.scene.particleGroup.add(mesh);
      this.pool.push(this.createParticleObject(mesh, mat, 'mud'));
    }

    // 4. Fluid curved water spray droplets (35 items)
    for (let i = 0; i < 35; i += 1) {
      const mat = mats.waterSpray.clone();
      const mesh = new THREE.Mesh(this.dropletGeom, mat);
      mesh.visible = false;
      this.scene.particleGroup.add(mesh);
      this.pool.push(this.createParticleObject(mesh, mat, 'waterSpray'));
    }

    // 5. White water foam & bubbles (35 items)
    for (let i = 0; i < 35; i += 1) {
      const mat = mats.waterFoam.clone();
      const mesh = new THREE.Mesh(this.puffGeom, mat);
      mesh.visible = false;
      this.scene.particleGroup.add(mesh);
      this.pool.push(this.createParticleObject(mesh, mat, 'waterFoam'));
    }

    // 6. Surface water ripple rings (20 items)
    for (let i = 0; i < 20; i += 1) {
      const mat = mats.waterRipple.clone();
      const mesh = new THREE.Mesh(this.rippleGeom, mat);
      mesh.visible = false;
      this.scene.particleGroup.add(mesh);
      this.pool.push(this.createParticleObject(mesh, mat, 'waterRipple'));
    }

    // 7. Water mist (15 items)
    for (let i = 0; i < 15; i += 1) {
      const mat = mats.waterMist.clone();
      const mesh = new THREE.Mesh(this.puffGeom, mat);
      mesh.visible = false;
      this.scene.particleGroup.add(mesh);
      this.pool.push(this.createParticleObject(mesh, mat, 'waterMist'));
    }

    // 8. Sparks (20 items)
    for (let i = 0; i < 20; i += 1) {
      const mat = mats.sparkParticle;
      const mesh = new THREE.Mesh(this.sparkGeom, mat);
      mesh.visible = false;
      this.scene.particleGroup.add(mesh);
      this.pool.push(this.createParticleObject(mesh, mat, 'spark'));
    }

    // 9. Forest autumn leaves (18 items)
    const leafMats = [mats.leafGold, mats.leafOrange, mats.leafRed];
    for (let i = 0; i < 18; i += 1) {
      const mat = leafMats[i % leafMats.length];
      const mesh = new THREE.Mesh(this.leafGeom, mat);
      mesh.visible = false;
      this.scene.particleGroup.add(mesh);
      this.pool.push(this.createParticleObject(mesh, mat, 'leaf'));
    }

    // 10. Confetti and sawdust (20 items)
    const confettiMats = [mats.confettiGold, mats.confettiPink, mats.confettiBlue, mats.confettiGreen];
    for (let i = 0; i < 20; i += 1) {
      const mat = confettiMats[i % confettiMats.length];
      const mesh = new THREE.Mesh(this.confettiGeom, mat);
      mesh.visible = false;
      this.scene.particleGroup.add(mesh);
      this.pool.push(this.createParticleObject(mesh, mat, 'confetti'));
    }
  }

  private createParticleObject(mesh: THREE.Mesh, material: THREE.Material, kind: ParticleKind): Particle {
    return {
      mesh,
      material,
      velocity: new THREE.Vector3(),
      rotVelocity: new THREE.Vector3(),
      life: 0,
      maxLife: 1,
      startScale: 0.1,
      endScale: 0.5,
      startOpacity: 0.6,
      endOpacity: 0.0,
      kind,
      active: false,
      gravity: -9.8,
      drag: 0.95,
      turbScale: 0,
    };
  }

  private acquire(kind: ParticleKind): Particle | null {
    for (const p of this.pool) {
      if (!p.active && p.kind === kind) return p;
    }
    // Fallback: steal oldest of same kind
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
   * Multi-layered rich water splash VFX:
   * - Fluid aerodynamic water droplets shooting out along velocity vector
   * - Fluffy white foam crests billowing around wheels
   * - Concentric expanding ripple rings on the water surface
   * - Atmospheric wet mist haze
   */
  emitWaterSplash(pos: THREE.Vector3, forward: THREE.Vector3, speed: number, waterIntensity: number): void {
    const intensity = Math.min(1.0, waterIntensity);
    const speedMag = Math.abs(speed);

    // 1. Fluid Water Spray Droplets (aerodynamically aligned)
    const dropCount = Math.min(5, Math.round(3 + intensity * 3 + speedMag * 0.18));
    for (let c = 0; c < dropCount; c += 1) {
      const p = this.acquire('waterSpray');
      if (!p) break;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.38 + Math.random() * 0.28;
      p.mesh.visible = true;

      const side = c % 2 === 0 ? 1 : -1;
      const spreadX = side * (0.35 + Math.random() * 0.55);
      p.mesh.position.set(pos.x + spreadX * 0.4, pos.y + 0.05, pos.z + (Math.random() - 0.5) * 0.3);

      const sideVel = side * (4.2 + Math.random() * 5.8 * intensity);
      const upVel = 3.2 + Math.random() * 4.5 * intensity + speedMag * 0.14;
      const forwardVel = forward.z * (speed * 0.4) + (Math.random() - 0.5) * 2.0;

      p.velocity.set(sideVel, upVel, forwardVel);
      p.rotVelocity.set(0, 0, 0);

      // Orient droplet along velocity vector
      this.scratchVec.copy(p.velocity).normalize();
      p.mesh.quaternion.setFromUnitVectors(this.upAxis, this.scratchVec);

      p.startScale = 0.45 + Math.random() * 0.35 * intensity;
      p.endScale = p.startScale * 0.8;
      p.startOpacity = 0.78;
      p.endOpacity = 0.0;
      p.gravity = -16.0;
      p.drag = 0.96;
      p.turbScale = 0.2;
    }

    // 2. White Foam & Froth Bubbles
    const foamCount = Math.min(4, Math.round(2 + intensity * 3));
    for (let c = 0; c < foamCount; c += 1) {
      const p = this.acquire('waterFoam');
      if (!p) break;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.35;
      p.mesh.visible = true;

      const spreadX = (Math.random() - 0.5) * 0.8;
      p.mesh.position.set(pos.x + spreadX, pos.y + 0.02, pos.z + (Math.random() - 0.5) * 0.5);

      p.velocity.set(
        spreadX * 3.5,
        0.8 + Math.random() * 1.6 * intensity,
        -forward.z * (1.2 + Math.random() * 2.0),
      );
      p.rotVelocity.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);

      p.startScale = 0.24 + Math.random() * 0.28;
      p.endScale = p.startScale * 2.0;
      p.startOpacity = 0.88;
      p.endOpacity = 0.0;
      p.gravity = -2.5; // Floats softly on surface
      p.drag = 0.88;
      p.turbScale = 0.6;
    }

    // 3. Surface Water Ripple Waves
    if (Math.random() < 0.75) {
      const p = this.acquire('waterRipple');
      if (p) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.65 + Math.random() * 0.35;
        p.mesh.visible = true;

        p.mesh.position.set(pos.x + (Math.random() - 0.5) * 0.3, pos.y + 0.04, pos.z);
        p.velocity.set(0, 0, 0);
        p.rotVelocity.set(0, 0, 0);
        p.mesh.rotation.set(-Math.PI / 2, 0, 0);

        p.startScale = 0.5;
        p.endScale = 2.6 + intensity * 1.4;
        p.startOpacity = 0.65;
        p.endOpacity = 0.0;
        p.gravity = 0;
        p.drag = 1.0;
        p.turbScale = 0;
      }
    }

    // 4. Fine Water Mist Haze at speed
    if (speedMag > 8 && Math.random() < 0.6) {
      const p = this.acquire('waterMist');
      if (p) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.7 + Math.random() * 0.4;
        p.mesh.visible = true;

        p.mesh.position.set(pos.x + (Math.random() - 0.5) * 0.6, pos.y + 0.4, pos.z - 0.4);
        p.velocity.set((Math.random() - 0.5) * 1.5, 0.4 + Math.random() * 0.6, -forward.z * 1.8);
        p.rotVelocity.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);

        p.startScale = 0.5;
        p.endScale = 1.6;
        p.startOpacity = 0.4;
        p.endOpacity = 0.0;
        p.gravity = 0.2;
        p.drag = 0.90;
        p.turbScale = 0.8;
      }
    }
  }

  /**
   * Diesel exhaust puff: light translucent grey at idle, thick dark smoke under throttle acceleration.
   */
  emitExhaust(pos: THREE.Vector3, forward: THREE.Vector3, throttle: number, speed: number, isVerticalStack = false): void {
    const p = this.acquire('exhaust');
    if (!p) return;

    p.active = true;
    p.life = 0;
    p.mesh.visible = true;

    const isHeavyLoad = throttle > 0.35 || speed > 12;
    p.maxLife = isHeavyLoad ? 0.85 + Math.random() * 0.45 : 0.55 + Math.random() * 0.35;
    p.startScale = isHeavyLoad ? 0.22 : 0.12;
    p.endScale = isHeavyLoad ? 0.85 + Math.random() * 0.4 : 0.45 + Math.random() * 0.2;
    p.startOpacity = isHeavyLoad ? 0.75 : 0.45;
    p.endOpacity = 0.0;
    p.gravity = isVerticalStack ? 1.4 : 0.8;
    p.drag = 0.92;
    p.turbScale = 0.8;

    p.mesh.position.copy(pos).add(
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

    const mat = p.material as THREE.MeshLambertMaterial;
    if (mat) {
      if (isHeavyLoad) {
        mat.color.setHex(Math.random() > 0.4 ? 0x222224 : 0x3d3835);
      } else {
        mat.color.setHex(0xaaaaaa);
      }
    }
  }

  /**
   * Swirling dust cloud kicked up from spinning or fast-rolling tires on dry road.
   */
  emitDustCloud(pos: THREE.Vector3, forward: THREE.Vector3, speed: number, intensity = 1.0): void {
    const p = this.acquire('dust');
    if (!p) return;

    p.active = true;
    p.life = 0;
    p.mesh.visible = true;

    p.maxLife = 0.65 + Math.random() * 0.45;
    p.startScale = 0.25;
    p.endScale = 0.95 + Math.random() * 0.55 * intensity;
    p.startOpacity = 0.42 * Math.min(1.0, intensity);
    p.endOpacity = 0.0;
    p.gravity = 0.3;
    p.drag = 0.88;
    p.turbScale = 0.5;

    const spreadX = (Math.random() - 0.5) * 0.45;
    p.mesh.position.set(pos.x + spreadX, pos.y + 0.05, pos.z - 0.2);

    const backSpeed = -Math.sign(speed || 1) * (1.5 + Math.random() * 3.0);
    p.velocity.set(
      spreadX * 3.5,
      0.6 + Math.random() * 0.9,
      forward.z * backSpeed + (Math.random() - 0.5) * 1.2,
    );

    p.rotVelocity.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
  }

  /**
   * Chunky mud spray with ballistic trajectory.
   */
  emitMudSpray(pos: THREE.Vector3, forward: THREE.Vector3, rotSpeed: number, mud: number, wheelRadius = 0.6): void {
    const count = Math.min(4, Math.round(mud * 2.5 + Math.abs(rotSpeed) * 0.09));
    for (let c = 0; c < count; c += 1) {
      const p = this.acquire('mud');
      if (!p) break;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.32;
      p.mesh.visible = true;

      const spreadX = (Math.random() - 0.5) * 0.4;
      p.mesh.position.set(pos.x + spreadX, pos.y - wheelRadius * 0.45 + 0.08, pos.z - 0.25);

      const backwardSpeed = -Math.sign(rotSpeed || 1) * (3.0 + Math.random() * 5.2);
      const upwardSpeed = 2.2 + Math.random() * 3.6 * mud;

      p.velocity.set(
        spreadX * 4.5,
        upwardSpeed,
        forward.z * backwardSpeed + (Math.random() - 0.5) * 2.0,
      );

      p.rotVelocity.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);

      p.startScale = 0.12 + Math.random() * 0.22 * mud;
      p.endScale = p.startScale * 0.9;
      p.startOpacity = 1.0;
      p.endOpacity = 1.0;
      p.gravity = -15.0;
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
      p.mesh.visible = true;

      p.mesh.position.copy(pos).add(
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
      p.mesh.visible = true;

      p.mesh.position.set(
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

      p.startScale = 0.22 + Math.random() * 0.14;
      p.endScale = p.startScale;
      p.startOpacity = 1.0;
      p.endOpacity = 1.0;
      p.gravity = -1.8;
      p.drag = 0.94;
      p.turbScale = 1.5;
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
      p.mesh.visible = true;

      p.mesh.position.set(
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

      p.startScale = 0.2 + Math.random() * 0.2;
      p.endScale = p.startScale;
      p.startOpacity = 1.0;
      p.endOpacity = 1.0;
      p.gravity = -4.5;
      p.drag = 0.92;
      p.turbScale = 1.8;
    }
  }

  reset(): void {
    for (const p of this.pool) {
      p.active = false;
      p.mesh.visible = false;
    }
  }

  update(dt: number): void {
    this.elapsed += dt;

    for (const p of this.pool) {
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      const progress = p.life / p.maxLife;

      // Dynamics: Gravity + Drag + Turbulence
      p.velocity.y += p.gravity * dt;
      p.velocity.x *= Math.pow(p.drag, dt * 60);
      p.velocity.z *= Math.pow(p.drag, dt * 60);

      // Turbulence flutter for smoke, dust, leaves, confetti
      if (p.turbScale > 0) {
        const freq = this.elapsed * 4.0 + p.mesh.id;
        p.velocity.x += Math.sin(freq) * p.turbScale * dt;
        p.velocity.z += Math.cos(freq * 1.3) * p.turbScale * dt;
      }

      p.mesh.position.addScaledVector(p.velocity, dt);

      // Orientation update
      if (p.kind === 'waterSpray') {
        this.scratchVec.copy(p.velocity).normalize();
        if (this.scratchVec.lengthSq() > 0.01) {
          p.mesh.quaternion.setFromUnitVectors(this.upAxis, this.scratchVec);
        }
      } else {
        p.mesh.rotation.x += p.rotVelocity.x * dt;
        p.mesh.rotation.y += p.rotVelocity.y * dt;
        p.mesh.rotation.z += p.rotVelocity.z * dt;
      }

      // Dynamic scale interpolation
      const curScale = THREE.MathUtils.lerp(p.startScale, p.endScale, progress);
      p.mesh.scale.set(curScale, curScale, curScale);

      // Dynamic opacity interpolation
      const curOpacity = THREE.MathUtils.lerp(p.startOpacity, p.endOpacity, progress);
      const mat = p.material as THREE.Material & { opacity?: number; transparent?: boolean };
      if (mat && mat.opacity !== undefined && mat.transparent) {
        mat.opacity = curOpacity;
      }

      // Ground / surface collision cutoff
      const groundY = this.road.heightAt(p.mesh.position.x, p.mesh.position.z);
      if (p.mesh.position.y <= groundY - 0.05) {
        if (
          p.kind === 'spark' ||
          p.kind === 'mud' ||
          p.kind === 'waterSpray' ||
          p.kind === 'waterMist'
        ) {
          p.active = false;
          p.mesh.visible = false;
        } else if (p.kind === 'waterFoam' || p.kind === 'waterRipple') {
          // Keep floating on water / ground surface
          p.mesh.position.y = groundY + 0.03;
          p.velocity.y = 0;
        } else {
          p.mesh.position.y = groundY + 0.02;
          p.velocity.set(0, 0, 0);
          p.rotVelocity.set(0, 0, 0);
        }
      }
    }
  }
}
