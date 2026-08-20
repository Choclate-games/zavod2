import * as THREE from 'three';

interface Particle {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  maxLife: number;
  life: number;
  rotation: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  gravity: number;
}

export class ParticleSystem {
  private static instance: ParticleSystem;
  private readonly MAX_PARTICLES = 350;
  private particles: Particle[] = [];
  private instancedMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private scene: THREE.Scene | null = null;

  private constructor() {
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.4,
      metalness: 0.2,
      vertexColors: false,
    });

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.MAX_PARTICLES);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.count = this.MAX_PARTICLES;

    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(),
        size: 0.1,
        maxLife: 1.0,
        life: 0,
        rotation: new THREE.Vector3(),
        rotSpeed: new THREE.Vector3(),
        gravity: -18.0,
      });

      // Hide initially
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  public static getInstance(): ParticleSystem {
    if (!ParticleSystem.instance) {
      ParticleSystem.instance = new ParticleSystem();
    }
    return ParticleSystem.instance;
  }

  public init(scene: THREE.Scene): void {
    this.scene = scene;
    scene.add(this.instancedMesh);
  }

  public spawnSparks(origin: THREE.Vector3, count = 12, colorHex = 0xf2cc8f): void {
    const color = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.position.copy(origin);
      p.velocity.set(
        (Math.random() - 0.5) * 12,
        Math.random() * 8 + 2,
        (Math.random() - 0.5) * 12
      );
      p.color.copy(color);
      p.size = 0.08 + Math.random() * 0.08;
      p.maxLife = 0.35 + Math.random() * 0.25;
      p.life = p.maxLife;
      p.gravity = -22;
      p.rotSpeed.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
    }
  }

  public spawnSplinters(origin: THREE.Vector3, dir: THREE.Vector3, count = 16): void {
    const woodColor = new THREE.Color(0xa06535);
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.position.copy(origin).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 0.6
      ));
      p.velocity.copy(dir).multiplyScalar(10 + Math.random() * 14).add(new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 7 + 2,
        (Math.random() - 0.5) * 8
      ));
      p.color.copy(woodColor);
      p.size = 0.12 + Math.random() * 0.15;
      p.maxLife = 0.8 + Math.random() * 0.4;
      p.life = p.maxLife;
      p.gravity = -20;
      p.rotSpeed.set(Math.random() * 15, Math.random() * 15, Math.random() * 15);
    }
  }

  public spawnWallCrushDebris(origin: THREE.Vector3, normal: THREE.Vector3, count = 20): void {
    const stoneColor = new THREE.Color(0xe07a5f);
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.position.copy(origin);
      p.velocity.copy(normal).multiplyScalar(8 + Math.random() * 10).add(new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        Math.random() * 8 + 3,
        (Math.random() - 0.5) * 10
      ));
      p.color.copy(stoneColor);
      p.size = 0.15 + Math.random() * 0.18;
      p.maxLife = 0.6 + Math.random() * 0.5;
      p.life = p.maxLife;
      p.gravity = -24;
      p.rotSpeed.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
    }
  }

  public spawnExplosion(origin: THREE.Vector3, radius = 3.5): void {
    this.spawnSparks(origin, 25, 0xff5500);
    this.spawnSparks(origin, 20, 0xffcc00);
    this.spawnWallCrushDebris(origin, new THREE.Vector3(0, 1, 0), 15);
  }

  public update(dt: number): void {
    let needsUpdate = false;

    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        needsUpdate = true;
        continue;
      }

      // Physics integration
      p.velocity.y += p.gravity * dt;
      p.position.addScaledVector(p.velocity, dt);

      // Floor bounce / friction
      if (p.position.y < 0.05) {
        p.position.y = 0.05;
        p.velocity.y = -p.velocity.y * 0.3;
        p.velocity.x *= 0.8;
        p.velocity.z *= 0.8;
      }

      p.rotation.addScaledVector(p.rotSpeed, dt);

      const lifeRatio = p.life / p.maxLife;
      const currentScale = p.size * lifeRatio;

      this.dummy.position.copy(p.position);
      this.dummy.rotation.set(p.rotation.x, p.rotation.y, p.rotation.z);
      this.dummy.scale.set(currentScale, currentScale, currentScale);
      this.dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
      needsUpdate = true;
    }

    if (needsUpdate) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private getFreeParticle(): Particle | null {
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      if (!this.particles[i].active) {
        return this.particles[i];
      }
    }
    return null;
  }
}
