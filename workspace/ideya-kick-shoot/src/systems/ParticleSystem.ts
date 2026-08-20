import * as THREE from 'three';
import { Vector3D } from '../core/Types';

interface Particle {
  mesh: THREE.Mesh;
  velocity: Vector3D;
  life: number;
  maxLife: number;
  scaleGrowth: number;
  active: boolean;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private pool: Particle[] = [];
  private activeParticles: Particle[] = [];

  private sparkGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  private fireMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.85 });
  private ringGeo = new THREE.RingGeometry(0.2, 0.45, 32);
  private ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });

  constructor(scene: THREE.Scene, initialCapacity: number = 80) {
    this.scene = scene;

    for (let i = 0; i < initialCapacity; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.pool.push({
        mesh,
        velocity: { x: 0, y: 0, z: 0 },
        life: 0,
        maxLife: 1.0,
        scaleGrowth: 0,
        active: false
      });
    }
  }

  public emitSparks(x: number, y: number, z: number, count: number = 10, colorHex: number = 0xffd700): void {
    for (let i = 0; i < count; i++) {
      const p = this.getParticle();
      if (!p) break;

      p.mesh.material = this.sparkMat;
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
      p.mesh.position.set(x, y, z);
      p.mesh.scale.set(1, 1, 1);
      p.mesh.visible = true;

      const angle = Math.random() * Math.PI * 2;
      const speed = 4.0 + Math.random() * 8.0;
      p.velocity = {
        x: Math.cos(angle) * speed,
        y: 2.0 + Math.random() * 6.0,
        z: Math.sin(angle) * speed
      };
      p.life = 0.35 + Math.random() * 0.25;
      p.maxLife = p.life;
      p.scaleGrowth = -1.5;
      p.active = true;
      this.activeParticles.push(p);
    }
  }

  public emitShockwaveRing(x: number, z: number, maxRadius: number = 4.5): void {
    const ringMesh = new THREE.Mesh(this.ringGeo, this.ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(x, 0.1, z);
    this.scene.add(ringMesh);

    const p: Particle = {
      mesh: ringMesh,
      velocity: { x: 0, y: 0, z: 0 },
      life: 0.4,
      maxLife: 0.4,
      scaleGrowth: maxRadius * 3.5,
      active: true
    };
    this.activeParticles.push(p);
  }

  public emitExplosion(x: number, z: number, radius: number): void {
    this.emitSparks(x, 1.0, z, 24, 0xff5500);
    this.emitShockwaveRing(x, z, radius);
  }

  private getParticle(): Particle | null {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return null;
  }

  public update(dt: number): void {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life -= dt;

      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        this.activeParticles.splice(i, 1);
        this.pool.push(p);
        continue;
      }

      // Physics
      p.velocity.y -= 15.0 * dt;
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;

      // Scale Growth / Fade
      const progress = 1 - p.life / p.maxLife;
      if (p.scaleGrowth > 0) {
        const s = 1 + progress * p.scaleGrowth;
        p.mesh.scale.set(s, s, s);
      } else {
        const s = Math.max(0.1, 1 - progress);
        p.mesh.scale.set(s, s, s);
      }
    }
  }

  public clear(): void {
    for (const p of this.activeParticles) {
      p.active = false;
      p.mesh.visible = false;
      this.pool.push(p);
    }
    this.activeParticles = [];
  }
}
