import * as THREE from 'three';

export interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  scale: number;
  maxScale: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
  mesh: THREE.Mesh;
  active: boolean;
  type: 'spark' | 'smoke_cloud' | 'casing' | 'explosion';
}

export class ParticleSystem {
  private static instance: ParticleSystem;
  private scene: THREE.Scene | null = null;
  private pool: Particle[] = [];
  private tracers: Array<{ line: THREE.Line; life: number }> = [];

  private constructor() {}

  public static getInstance(): ParticleSystem {
    if (!ParticleSystem.instance) {
      ParticleSystem.instance = new ParticleSystem();
    }
    return ParticleSystem.instance;
  }

  public init(scene: THREE.Scene): void {
    this.scene = scene;
    this.pool = [];
    this.tracers = [];

    // Pre-allocate 150 particles into pool
    const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const smokeGeo = new THREE.SphereGeometry(0.8, 6, 6);
    const casingGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.08, 5);

    for (let i = 0; i < 120; i++) {
      let geo: THREE.BufferGeometry = sparkGeo;
      let mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 });
      let type: Particle['type'] = 'spark';

      if (i < 40) {
        geo = smokeGeo;
        mat = new THREE.MeshBasicMaterial({ color: 0xA0AAB2, transparent: true, opacity: 0.6, depthWrite: false });
        type = 'smoke_cloud';
      } else if (i < 80) {
        geo = casingGeo;
        mat = new THREE.MeshBasicMaterial({ color: 0xDAA520 });
        type = 'casing';
      } else {
        mat = new THREE.MeshBasicMaterial({ color: 0xFFAA00, transparent: true, opacity: 1 });
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);

      this.pool.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        scale: 1,
        maxScale: 1,
        alpha: 1,
        life: 0,
        maxLife: 1,
        color: new THREE.Color(0xffffff),
        mesh,
        active: false,
        type,
      });
    }
  }

  public spawnTracer(start: THREE.Vector3, end: THREE.Vector3): void {
    if (!this.scene) return;

    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: 0xFFDD88, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  public spawnMuzzleFlash(pos: THREE.Vector3): void {
    for (let i = 0; i < 4; i++) {
      const p = this.getFreeParticle('spark');
      if (!p) break;
      p.active = true;
      p.life = 0.05;
      p.maxLife = 0.05;
      p.position.copy(pos);
      p.velocity.set(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4
      );
      p.scale = 0.2;
      p.maxScale = 0.3;
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xFFCC00);
      p.mesh.visible = true;
    }
  }

  public spawnCasing(pos: THREE.Vector3, rightDir: THREE.Vector3): void {
    const p = this.getFreeParticle('casing');
    if (!p) return;
    p.active = true;
    p.life = 1.5;
    p.maxLife = 1.5;
    p.position.copy(pos);
    p.velocity.copy(rightDir).multiplyScalar(2.5).add(new THREE.Vector3(0, 2.0, (Math.random() - 0.5) * 1.5));
    p.scale = 1.0;
    p.mesh.visible = true;
  }

  public spawnImpactSparks(pos: THREE.Vector3, normal: THREE.Vector3, isWood = false): void {
    const count = isWood ? 8 : 5;
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle('spark');
      if (!p) break;
      p.active = true;
      p.life = 0.25;
      p.maxLife = 0.25;
      p.position.copy(pos);
      p.velocity.copy(normal).multiplyScalar(3.0).add(new THREE.Vector3(
        (Math.random() - 0.5) * 4.0,
        (Math.random() - 0.5) * 4.0,
        (Math.random() - 0.5) * 4.0
      ));
      p.scale = 0.12;
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(isWood ? 0x8B5A2B : 0xFFEE55);
      p.mesh.visible = true;
    }
  }

  public spawnSmokeGrenade(center: THREE.Vector3, radius = 4.2): void {
    // Spawn cluster of 16 expanding spheres
    for (let i = 0; i < 16; i++) {
      const p = this.getFreeParticle('smoke_cloud');
      if (!p) break;
      p.active = true;
      p.life = 12.0;
      p.maxLife = 12.0;

      const angle = (i / 16) * Math.PI * 2;
      const offsetDist = Math.random() * (radius * 0.6);
      p.position.set(
        center.x + Math.cos(angle) * offsetDist,
        center.y + 0.8 + (Math.random() - 0.5) * 1.2,
        center.z + Math.sin(angle) * offsetDist
      );
      p.velocity.set(Math.cos(angle) * 0.2, 0.05, Math.sin(angle) * 0.2);
      p.scale = 0.8;
      p.maxScale = radius * 0.7;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7;
      p.mesh.visible = true;
    }
  }

  public spawnExplosion(center: THREE.Vector3): void {
    for (let i = 0; i < 20; i++) {
      const p = this.getFreeParticle('spark');
      if (!p) break;
      p.active = true;
      p.life = 0.8;
      p.maxLife = 0.8;
      p.position.copy(center);
      p.velocity.set(
        (Math.random() - 0.5) * 18.0,
        Math.random() * 12.0 + 2.0,
        (Math.random() - 0.5) * 18.0
      );
      p.scale = 0.4;
      p.maxScale = 0.8;
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(Math.random() > 0.4 ? 0xFF3300 : 0xFFCC00);
      p.mesh.visible = true;
    }
  }

  private getFreeParticle(type: Particle['type']): Particle | null {
    return this.pool.find((p) => !p.active && p.type === type) || null;
  }

  public update(dt: number): void {
    // Update Particles
    for (const p of this.pool) {
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.position.addScaledVector(p.velocity, dt);

      if (p.type === 'casing' || p.type === 'spark') {
        p.velocity.y -= 9.81 * dt; // Gravity
        if (p.position.y < 0.05) {
          p.position.y = 0.05;
          p.velocity.y *= -0.4;
          p.velocity.x *= 0.7;
          p.velocity.z *= 0.7;
        }
      } else if (p.type === 'smoke_cloud') {
        // Expand smoothly in first 1.2s, then linger
        const age = p.maxLife - p.life;
        if (age < 1.2) {
          p.scale = THREE.MathUtils.lerp(0.8, p.maxScale, age / 1.2);
        }
        if (p.life < 2.5) {
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = (p.life / 2.5) * 0.7;
        }
      }

      p.mesh.position.copy(p.position);
      p.mesh.scale.setScalar(p.scale);
    }

    // Update Tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) {
        this.scene?.remove(this.tracers[i].line);
        this.tracers[i].line.geometry.dispose();
        (this.tracers[i].line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
}

export const particles = ParticleSystem.getInstance();
