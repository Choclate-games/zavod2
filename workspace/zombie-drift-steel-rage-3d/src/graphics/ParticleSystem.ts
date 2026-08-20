import * as THREE from 'three';

interface Particle {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  scale: number;
  maxLife: number;
  life: number;
  growth: number;
  gravity: number;
  drag: number;
  rotation: number;
  rotSpeed: number;
}

export class ParticleSystem {
  public group = new THREE.Group();
  private pool: Particle[] = [];
  private maxParticles = 600;
  private instancedMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private colorAttribute: THREE.InstancedBufferAttribute;

  constructor() {
    // Quad billboard geometry
    const geom = new THREE.PlaneGeometry(0.8, 0.8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.instancedMesh = new THREE.InstancedMesh(geom, mat, this.maxParticles);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Instance colors
    const colors = new Float32Array(this.maxParticles * 3);
    this.colorAttribute = new THREE.InstancedBufferAttribute(colors, 3);
    geom.setAttribute('color', this.colorAttribute);

    this.group.add(this.instancedMesh);

    // Pre-allocate particle pool
    for (let i = 0; i < this.maxParticles; i++) {
      this.pool.push({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(),
        scale: 0.4,
        maxLife: 1.0,
        life: 0,
        growth: 0,
        gravity: 0,
        drag: 0.95,
        rotation: 0,
        rotSpeed: 0,
      });
    }
  }

  private allocParticle(): Particle | null {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        this.pool[i].active = true;
        this.pool[i].life = 0;
        return this.pool[i];
      }
    }
    return null;
  }

  public emitSmoke(x: number, y: number, z: number, count = 2): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      const gray = 0.65 + Math.random() * 0.25;
      p.position.set(x + (Math.random() - 0.5) * 0.4, y + 0.15, z + (Math.random() - 0.5) * 0.4);
      p.velocity.set((Math.random() - 0.5) * 1.5, Math.random() * 1.8 + 0.5, (Math.random() - 0.5) * 1.5);
      p.color.setRGB(gray, gray, gray);
      p.scale = 0.4 + Math.random() * 0.3;
      p.maxLife = 0.7 + Math.random() * 0.4;
      p.growth = 2.2;
      p.gravity = -0.2;
      p.drag = 0.94;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 3;
    }
  }

  public emitNitroFire(x: number, y: number, z: number, dir: THREE.Vector3, count = 3): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      const isCyan = Math.random() > 0.4;
      if (isCyan) {
        p.color.setHex(0x00f0ff);
      } else {
        p.color.setHex(0x3a86ff);
      }
      p.position.set(x, y + 0.2, z);
      p.velocity.set(
        dir.x * -14.0 + (Math.random() - 0.5) * 0.8,
        dir.y * -14.0 + (Math.random() - 0.5) * 0.6,
        dir.z * -14.0 + (Math.random() - 0.5) * 0.8
      );
      p.scale = 0.5 + Math.random() * 0.3;
      p.maxLife = 0.25 + Math.random() * 0.15;
      p.growth = -1.2;
      p.gravity = 0;
      p.drag = 0.92;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 5;
    }
  }

  public emitBloodSplatter(x: number, y: number, z: number, count = 12): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      if (Math.random() > 0.2) {
        p.color.setHex(0x990000);
      } else {
        p.color.setHex(0x550000);
      }
      p.position.set(x, y + 0.5, z);
      p.velocity.set(
        (Math.random() - 0.5) * 9,
        Math.random() * 6 + 2,
        (Math.random() - 0.5) * 9
      );
      p.scale = 0.35 + Math.random() * 0.35;
      p.maxLife = 0.6 + Math.random() * 0.4;
      p.growth = -0.4;
      p.gravity = 12.0;
      p.drag = 0.96;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 4;
    }
  }

  public emitSparks(x: number, y: number, z: number, count = 8): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      if (Math.random() > 0.5) {
        p.color.setHex(0xffd166);
      } else {
        p.color.setHex(0xff9f1c);
      }
      p.position.set(x, y + 0.3, z);
      p.velocity.set(
        (Math.random() - 0.5) * 8,
        Math.random() * 5 + 2,
        (Math.random() - 0.5) * 8
      );
      p.scale = 0.25 + Math.random() * 0.2;
      p.maxLife = 0.3 + Math.random() * 0.2;
      p.growth = -0.8;
      p.gravity = 8.0;
      p.drag = 0.95;
      p.rotation = 0;
      p.rotSpeed = 0;
    }
  }

  public emitExplosion(x: number, y: number, z: number, count = 24): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      const r = Math.random();
      if (r < 0.4) {
        p.color.setHex(0xff4500);
      } else if (r < 0.8) {
        p.color.setHex(0xffba08);
      } else {
        p.color.setHex(0x333333);
      }
      p.position.set(x, y + 0.5, z);
      p.velocity.set(
        (Math.random() - 0.5) * 14,
        Math.random() * 8 + 3,
        (Math.random() - 0.5) * 14
      );
      p.scale = 0.6 + Math.random() * 0.6;
      p.maxLife = 0.5 + Math.random() * 0.4;
      p.growth = 1.5;
      p.gravity = 2.0;
      p.drag = 0.92;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 6;
    }
  }

  public emitAcidSplash(x: number, y: number, z: number, count = 8): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      p.color.setHex(0x76ff03);
      p.position.set(x, y + 0.3, z);
      p.velocity.set(
        (Math.random() - 0.5) * 5,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 5
      );
      p.scale = 0.4;
      p.maxLife = 0.5;
      p.growth = 0.5;
      p.gravity = 8.0;
      p.drag = 0.95;
      p.rotation = 0;
      p.rotSpeed = 0;
    }
  }

  public emitWoodSplinters(x: number, y: number, z: number, count = 12): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      const shade = Math.random() > 0.5 ? 0x8b5a2b : 0xcd853f;
      p.color.setHex(shade);
      p.position.set(x + (Math.random() - 0.5) * 0.4, y + 0.4, z + (Math.random() - 0.5) * 0.4);
      p.velocity.set(
        (Math.random() - 0.5) * 8,
        Math.random() * 6 + 2,
        (Math.random() - 0.5) * 8
      );
      p.scale = 0.3 + Math.random() * 0.25;
      p.maxLife = 0.45 + Math.random() * 0.3;
      p.growth = -0.4;
      p.gravity = 10.0;
      p.drag = 0.94;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 8;
    }
  }

  public emitToxicBubbles(x: number, y: number, z: number, count = 4): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      p.color.setHex(0x39ff14);
      p.position.set(x + (Math.random() - 0.5) * 0.6, y + 0.1, z + (Math.random() - 0.5) * 0.6);
      p.velocity.set(
        (Math.random() - 0.5) * 1.5,
        Math.random() * 2.2 + 0.8,
        (Math.random() - 0.5) * 1.5
      );
      p.scale = 0.25 + Math.random() * 0.2;
      p.maxLife = 0.4 + Math.random() * 0.25;
      p.growth = 0.8;
      p.gravity = -1.5;
      p.drag = 0.96;
      p.rotation = 0;
      p.rotSpeed = 0;
    }
  }

  public emitBoostTrail(x: number, y: number, z: number, dir: THREE.Vector3, count = 4): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      p.color.setHex(Math.random() > 0.3 ? 0xff9100 : 0xffea00);
      p.position.set(x + (Math.random() - 0.5) * 0.4, y + 0.2, z + (Math.random() - 0.5) * 0.4);
      p.velocity.set(
        dir.x * -8.0 + (Math.random() - 0.5) * 2,
        Math.random() * 2 + 0.5,
        dir.z * -8.0 + (Math.random() - 0.5) * 2
      );
      p.scale = 0.45 + Math.random() * 0.25;
      p.maxLife = 0.35;
      p.growth = -0.5;
      p.gravity = 0;
      p.drag = 0.93;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 6;
    }
  }

  public update(dt: number, camera: THREE.Camera): void {
    let activeIndex = 0;

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }

      // Physics
      p.velocity.y -= p.gravity * dt;
      p.velocity.x *= p.drag;
      p.velocity.y *= p.drag;
      p.velocity.z *= p.drag;

      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.position.z += p.velocity.z * dt;

      if (p.position.y < 0.1) {
        p.position.y = 0.1;
        p.velocity.y = 0;
      }

      p.rotation += p.rotSpeed * dt;
      const progress = p.life / p.maxLife;
      const currentScale = Math.max(0.01, p.scale + p.growth * progress);

      // Billboard orientation towards camera
      this.dummy.position.copy(p.position);
      this.dummy.quaternion.copy(camera.quaternion);
      this.dummy.scale.set(currentScale, currentScale, currentScale);
      this.dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(activeIndex, this.dummy.matrix);
      this.instancedMesh.setColorAt(activeIndex, p.color);
      activeIndex++;
    }

    this.instancedMesh.count = activeIndex;
    if (activeIndex > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      if (this.instancedMesh.instanceColor) {
        this.instancedMesh.instanceColor.needsUpdate = true;
      }
    }
  }
}
