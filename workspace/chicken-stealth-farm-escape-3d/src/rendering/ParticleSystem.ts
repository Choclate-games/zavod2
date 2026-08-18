// src/rendering/ParticleSystem.ts
import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  scaleSpeed: number;
  fadeSpeed: number;
  rotSpeed: number;
}

export class ParticleSystem {
  private static instance: ParticleSystem;
  private scene: THREE.Scene | null = null;
  private pool: Particle[] = [];
  private readonly maxParticles = 120;

  private dustMat: THREE.MeshBasicMaterial;
  private goldMat: THREE.MeshBasicMaterial;
  private featherMat: THREE.MeshBasicMaterial;
  private confettiColors: THREE.MeshBasicMaterial[];

  private constructor() {
    this.dustMat = new THREE.MeshBasicMaterial({ color: 0xecf0f1, transparent: true, opacity: 0.8 });
    this.goldMat = new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.9 });
    this.featherMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

    this.confettiColors = [
      new THREE.MeshBasicMaterial({ color: 0xe74c3c }),
      new THREE.MeshBasicMaterial({ color: 0x3498db }),
      new THREE.MeshBasicMaterial({ color: 0x2ecc71 }),
      new THREE.MeshBasicMaterial({ color: 0xf1c40f }),
      new THREE.MeshBasicMaterial({ color: 0x9b59b6 })
    ];
  }

  public static getInstance(): ParticleSystem {
    if (!ParticleSystem.instance) {
      ParticleSystem.instance = new ParticleSystem();
    }
    return ParticleSystem.instance;
  }

  public init(scene: THREE.Scene): void {
    this.scene = scene;
    const geom = new THREE.BoxGeometry(0.12, 0.12, 0.12);

    for (let i = 0; i < this.maxParticles; i++) {
      const mesh = new THREE.Mesh(geom, this.dustMat);
      mesh.visible = false;
      this.scene.add(mesh);

      this.pool.push({
        mesh,
        active: false,
        life: 0,
        maxLife: 1.0,
        vx: 0,
        vy: 0,
        vz: 0,
        scaleSpeed: 0,
        fadeSpeed: 1.0,
        rotSpeed: 0
      });
    }
  }

  private getInactiveParticle(): Particle | null {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        return this.pool[i];
      }
    }
    return null;
  }

  // Dust puff on footsteps
  public spawnStepDust(x: number, y: number, z: number): void {
    const p = this.getInactiveParticle();
    if (!p) return;

    p.mesh.material = this.dustMat;
    p.mesh.position.set(x + (Math.random() - 0.5) * 0.1, y + 0.05, z + (Math.random() - 0.5) * 0.1);
    p.mesh.scale.setScalar(0.08 + Math.random() * 0.04);
    p.mesh.visible = true;

    p.active = true;
    p.life = 0.35;
    p.maxLife = 0.35;
    p.vx = (Math.random() - 0.5) * 0.3;
    p.vy = 0.4 + Math.random() * 0.2;
    p.vz = (Math.random() - 0.5) * 0.3;
    p.scaleSpeed = -0.2;
    p.fadeSpeed = 2.5;
    p.rotSpeed = (Math.random() - 0.5) * 3;
  }

  // Box drop ground impact cloud
  public spawnBoxImpactPuff(x: number, y: number, z: number): void {
    for (let i = 0; i < 10; i++) {
      const p = this.getInactiveParticle();
      if (!p) break;

      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 0.8 + Math.random() * 0.6;

      p.mesh.material = this.dustMat;
      p.mesh.position.set(x, y + 0.08, z);
      p.mesh.scale.setScalar(0.12 + Math.random() * 0.08);
      p.mesh.visible = true;

      p.active = true;
      p.life = 0.5;
      p.maxLife = 0.5;
      p.vx = Math.cos(angle) * speed;
      p.vy = 0.3 + Math.random() * 0.3;
      p.vz = Math.sin(angle) * speed;
      p.scaleSpeed = 0.1;
      p.fadeSpeed = 2.0;
      p.rotSpeed = (Math.random() - 0.5) * 4;
    }
  }

  // Golden corn sparkles
  public spawnGrainSparkles(x: number, y: number, z: number): void {
    for (let i = 0; i < 8; i++) {
      const p = this.getInactiveParticle();
      if (!p) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 0.8;

      p.mesh.material = this.goldMat;
      p.mesh.position.set(x, y + 0.3, z);
      p.mesh.scale.setScalar(0.14 + Math.random() * 0.06);
      p.mesh.visible = true;

      p.active = true;
      p.life = 0.6;
      p.maxLife = 0.6;
      p.vx = Math.cos(angle) * speed;
      p.vy = 1.2 + Math.random() * 0.6;
      p.vz = Math.sin(angle) * speed;
      p.scaleSpeed = -0.15;
      p.fadeSpeed = 1.6;
      p.rotSpeed = 6.0;
    }
  }

  // Feathers burst
  public spawnFeatherBurst(x: number, y: number, z: number): void {
    for (let i = 0; i < 5; i++) {
      const p = this.getInactiveParticle();
      if (!p) break;

      p.mesh.material = this.featherMat;
      p.mesh.position.set(x, y + 0.3, z);
      p.mesh.scale.set(0.06, 0.18, 0.02);
      p.mesh.visible = true;

      p.active = true;
      p.life = 0.7;
      p.maxLife = 0.7;
      p.vx = (Math.random() - 0.5) * 1.5;
      p.vy = 1.5 + Math.random() * 0.5;
      p.vz = (Math.random() - 0.5) * 1.5;
      p.scaleSpeed = -0.05;
      p.fadeSpeed = 1.4;
      p.rotSpeed = 5.0;
    }
  }

  // Victory Confetti
  public spawnVictoryConfetti(x: number, y: number, z: number): void {
    for (let i = 0; i < 30; i++) {
      const p = this.getInactiveParticle();
      if (!p) break;

      const mat = this.confettiColors[Math.floor(Math.random() * this.confettiColors.length)];
      p.mesh.material = mat;
      p.mesh.position.set(x + (Math.random() - 0.5) * 2.0, y + 2.5 + Math.random() * 1.5, z + (Math.random() - 0.5) * 2.0);
      p.mesh.scale.set(0.1, 0.14, 0.02);
      p.mesh.visible = true;

      p.active = true;
      p.life = 1.8;
      p.maxLife = 1.8;
      p.vx = (Math.random() - 0.5) * 2.0;
      p.vy = 2.0 + Math.random() * 2.5;
      p.vz = (Math.random() - 0.5) * 2.0;
      p.scaleSpeed = 0;
      p.fadeSpeed = 0.5;
      p.rotSpeed = (Math.random() - 0.5) * 8.0;
    }
  }

  public update(dt: number): void {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      // Physics integration
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      p.vy -= 4.0 * dt; // Gravity

      // Rotation
      p.mesh.rotation.y += p.rotSpeed * dt;
      p.mesh.rotation.z += p.rotSpeed * dt * 0.7;

      // Scale
      if (p.scaleSpeed !== 0) {
        const s = Math.max(0.01, p.mesh.scale.x + p.scaleSpeed * dt);
        p.mesh.scale.set(s, s, s);
      }
    }
  }

  public clear(): void {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
      this.pool[i].mesh.visible = false;
    }
  }
}

export const particleSystem = ParticleSystem.getInstance();
