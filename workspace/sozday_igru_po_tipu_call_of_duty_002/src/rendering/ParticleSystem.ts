import * as THREE from 'three';

interface Particle {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  scale: number;
  maxLife: number;
  life: number;
  gravity: number;
}

export class ParticleSystem {
  private static instance: ParticleSystem;
  private maxParticles: number = 300;
  private particles: Particle[] = [];
  private instancedMesh: THREE.InstancedMesh;
  private dummy: THREE.Object3D = new THREE.Object3D();
  private scene: THREE.Scene | null = null;

  private constructor() {
    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxParticles);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.frustumCulled = false;

    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(),
        scale: 1.0,
        maxLife: 1.0,
        life: 0.0,
        gravity: 9.8
      });
    }
  }

  public static getInstance(): ParticleSystem {
    if (!ParticleSystem.instance) {
      ParticleSystem.instance = new ParticleSystem();
    }
    return ParticleSystem.instance;
  }

  public init(scene: THREE.Scene): void {
    this.scene = scene;
    this.scene.add(this.instancedMesh);
  }

  public emitSparks(pos: THREE.Vector3, normal: THREE.Vector3, count: number = 10, isGold: boolean = false): void {
    const sparkColor = isGold ? new THREE.Color(0xffd700) : new THREE.Color(0xff9900);

    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.position.copy(pos);
      p.maxLife = 0.2 + Math.random() * 0.3;
      p.life = p.maxLife;
      p.gravity = 14.0;
      p.scale = 0.6 + Math.random() * 0.8;
      p.color.copy(sparkColor);

      // Cone along reflection normal + random spread
      p.velocity.set(
        normal.x * 4 + (Math.random() - 0.5) * 5,
        normal.y * 4 + Math.random() * 5,
        normal.z * 4 + (Math.random() - 0.5) * 5
      );
    }
  }

  public emitBlood(pos: THREE.Vector3, count: number = 12): void {
    const bloodColor = new THREE.Color(0x990000);

    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.position.copy(pos);
      p.maxLife = 0.3 + Math.random() * 0.3;
      p.life = p.maxLife;
      p.gravity = 12.0;
      p.scale = 0.8 + Math.random() * 0.6;
      p.color.copy(bloodColor);

      p.velocity.set(
        (Math.random() - 0.5) * 3,
        Math.random() * 2 + 1,
        (Math.random() - 0.5) * 3
      );
    }
  }

  public emitSlideSparks(pos: THREE.Vector3, count: number = 4): void {
    const sparkColor = new THREE.Color(0xffaa22);

    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.position.copy(pos);
      p.position.y = Math.max(0.05, p.position.y);
      p.maxLife = 0.25;
      p.life = p.maxLife;
      p.gravity = 6.0;
      p.scale = 0.5 + Math.random() * 0.5;
      p.color.copy(sparkColor);

      p.velocity.set(
        (Math.random() - 0.5) * 4,
        Math.random() * 2.5 + 0.5,
        (Math.random() - 0.5) * 4
      );
    }
  }

  public emitMuzzleFlash(pos: THREE.Vector3, dir: THREE.Vector3): void {
    const flashColor = new THREE.Color(0xffe066);

    for (let i = 0; i < 6; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.position.copy(pos);
      p.maxLife = 0.08;
      p.life = p.maxLife;
      p.gravity = 0;
      p.scale = 1.2 + Math.random() * 0.8;
      p.color.copy(flashColor);

      p.velocity.copy(dir).multiplyScalar(6 + Math.random() * 4);
      p.velocity.x += (Math.random() - 0.5) * 1.5;
      p.velocity.y += (Math.random() - 0.5) * 1.5;
      p.velocity.z += (Math.random() - 0.5) * 1.5;
    }
  }

  public emitExplosion(pos: THREE.Vector3): void {
    const fireColor = new THREE.Color(0xff4500);
    const smokeColor = new THREE.Color(0x555555);

    for (let i = 0; i < 40; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.position.copy(pos);
      p.maxLife = 0.5 + Math.random() * 0.5;
      p.life = p.maxLife;
      p.gravity = -1.0; // Smoke rises
      p.scale = 1.5 + Math.random() * 2.0;
      p.color.copy(Math.random() > 0.4 ? fireColor : smokeColor);

      p.velocity.set(
        (Math.random() - 0.5) * 12,
        Math.random() * 8 + 2,
        (Math.random() - 0.5) * 12
      );
    }
  }

  private getFreeParticle(): Particle | null {
    for (const p of this.particles) {
      if (!p.active) return p;
    }
    return null;
  }

  public update(dt: number): void {
    let activeCount = 0;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        // Move inactive off-screen or scale to 0
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      activeCount++;
      p.velocity.y -= p.gravity * dt;
      p.position.addScaledVector(p.velocity, dt);

      const progress = p.life / p.maxLife;
      const curScale = p.scale * progress;

      this.dummy.position.copy(p.position);
      this.dummy.scale.set(curScale, curScale, curScale);
      this.dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
      this.instancedMesh.setColorAt(i, p.color);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }
}

export const particleSystem = ParticleSystem.getInstance();