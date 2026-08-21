import * as THREE from 'three';

interface Particle {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  scale: THREE.Vector3;
  startScale: number;
  endScale: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

export class ParticleSystem {
  private static instance: ParticleSystem;

  // Particle pools
  private readonly maxParticles = 600;
  private particles: Particle[] = [];
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  // Floating collectible gear gems
  private readonly maxGears = 150;
  private gearParticles: {
    active: boolean;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    rot: number;
    value: number;
  }[] = [];
  private gearMesh: THREE.InstancedMesh;

  static get(scene?: THREE.Scene): ParticleSystem {
    if (!ParticleSystem.instance && scene) {
      ParticleSystem.instance = new ParticleSystem(scene);
    }
    return ParticleSystem.instance;
  }

  constructor(scene: THREE.Scene) {
    // 1. General Particles (smoke, sparks, flame, debris, shockwaves)
    const boxGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(boxGeo, pMat, this.maxParticles);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);

    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        rotation: new THREE.Vector3(),
        rotSpeed: new THREE.Vector3(),
        scale: new THREE.Vector3(1, 1, 1),
        startScale: 1,
        endScale: 0,
        life: 0,
        maxLife: 1,
        color: new THREE.Color(0xffffff),
      });
      this.mesh.setColorAt(i, new THREE.Color(0, 0, 0));
    }

    // 2. Collectible Gears
    const gearGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 8);
    const gearMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x0088ff,
      emissiveIntensity: 0.8,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.gearMesh = new THREE.InstancedMesh(gearGeo, gearMat, this.maxGears);
    this.gearMesh.frustumCulled = false;
    this.gearMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.gearMesh);

    for (let i = 0; i < this.maxGears; i++) {
      this.gearParticles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: 0,
        value: 1,
      });
    }

    // Hide all instances initially
    this.dummy.position.set(0, -999, 0);
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < this.maxParticles; i++) {
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    for (let i = 0; i < this.maxGears; i++) {
      this.gearMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.gearMesh.instanceMatrix.needsUpdate = true;
  }

  emit(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    color: number | THREE.Color,
    life: number,
    startScale = 0.5,
    endScale = 0.05
  ): void {
    const p = this.particles.find(pt => !pt.active);
    if (!p) return;

    p.active = true;
    p.position.copy(pos);
    p.velocity.copy(vel);
    p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    p.rotSpeed.set(
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8
    );
    p.startScale = startScale;
    p.endScale = endScale;
    p.scale.setScalar(startScale);
    p.life = 0;
    p.maxLife = life;
    p.color.set(color);
  }

  emitTireSmoke(pos: THREE.Vector3, forward: THREE.Vector3): void {
    const pPos = pos.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.4,
      0.1,
      (Math.random() - 0.5) * 0.4
    ));
    const vel = forward.clone().multiplyScalar(-2.5).add(new THREE.Vector3(
      (Math.random() - 0.5) * 1.5,
      1.2 + Math.random() * 0.8, // rising smoke
      (Math.random() - 0.5) * 1.5
    ));
    const shade = 0.8 + Math.random() * 0.2;
    this.emit(pPos, vel, new THREE.Color(shade, shade, shade), 0.7, 0.4, 1.4);
  }

  emitDriftSparks(pos: THREE.Vector3): void {
    for (let i = 0; i < 3; i++) {
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 7.0,
        1.5 + Math.random() * 3.5,
        (Math.random() - 0.5) * 7.0
      );
      const isBlue = Math.random() > 0.6;
      const color = isBlue ? 0x00f0ff : 0xff8800;
      this.emit(pos, vel, color, 0.25, 0.2, 0.02);
    }
  }

  emitNitroFlame(pos: THREE.Vector3, forward: THREE.Vector3): void {
    for (let i = 0; i < 2; i++) {
      const vel = forward.clone().multiplyScalar(-14 - Math.random() * 6).add(new THREE.Vector3(
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.2
      ));
      const color = Math.random() > 0.3 ? 0x00f0ff : 0x0088ff;
      this.emit(pos, vel, color, 0.18, 0.45, 0.05);
    }
  }

  emitExplosion(pos: THREE.Vector3, count = 25): void {
    for (let i = 0; i < count; i++) {
      const speed = 6 + Math.random() * 14;
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        0.3 + Math.random() * 1.5,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(speed);

      const colors = [0xff4400, 0xff8800, 0xff0055, 0xffdd00, 0x555555];
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.emit(pos, dir, color, 0.6 + Math.random() * 0.5, 0.6, 0.1);
    }
  }

  emitShockwave(pos: THREE.Vector3, radius = 6.5): void {
    const numRings = 24;
    for (let i = 0; i < numRings; i++) {
      const angle = (i / numRings) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(angle), 0.1, Math.sin(angle));
      const vel = dir.clone().multiplyScalar(radius * 3.5);
      const ringPos = pos.clone().add(dir.clone().multiplyScalar(0.8));
      this.emit(ringPos, vel, 0x00f0ff, 0.35, 0.5, 0.05);
    }
  }

  emitNapalmPatch(pos: THREE.Vector3): void {
    const pPos = pos.clone().setY(0.15);
    const vel = new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4);
    const color = Math.random() > 0.4 ? 0xff4400 : 0xffaa00;
    this.emit(pPos, vel, color, 1.2, 0.6, 0.2);
  }

  // --- Gear Pickups ---

  spawnGears(pos: THREE.Vector3, count = 5): void {
    for (let i = 0; i < count; i++) {
      const g = this.gearParticles.find(gp => !gp.active);
      if (!g) break;

      g.active = true;
      g.pos.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 2.0,
        0.5,
        (Math.random() - 0.5) * 2.0
      ));
      g.vel.set(
        (Math.random() - 0.5) * 6,
        4 + Math.random() * 4,
        (Math.random() - 0.5) * 6
      );
      g.rot = Math.random() * Math.PI * 2;
      g.value = 1;
    }
  }

  update(dt: number, playerPos: THREE.Vector3, magnetRadius = 4.5, onCollect?: (val: number) => void): void {
    // 1. Update general particles
    let pNeedsUpdate = false;
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        pNeedsUpdate = true;
        continue;
      }

      const progress = p.life / p.maxLife;
      p.position.addScaledVector(p.velocity, dt);
      p.rotation.x += p.rotSpeed.x * dt;
      p.rotation.y += p.rotSpeed.y * dt;
      p.rotation.z += p.rotSpeed.z * dt;

      // Gravity / Drag
      p.velocity.y -= 3.5 * dt;
      p.velocity.multiplyScalar(0.96);

      const curScale = THREE.MathUtils.lerp(p.startScale, p.endScale, progress);
      this.dummy.position.copy(p.position);
      this.dummy.rotation.set(p.rotation.x, p.rotation.y, p.rotation.z);
      this.dummy.scale.setScalar(curScale);
      this.dummy.updateMatrix();

      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, p.color);
      pNeedsUpdate = true;
    }

    if (pNeedsUpdate) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    // 2. Update Collectible Gears
    let gNeedsUpdate = false;
    for (let i = 0; i < this.maxGears; i++) {
      const g = this.gearParticles[i];
      if (!g.active) continue;

      g.rot += 3.5 * dt;

      // Magnet pull toward player
      const dist = g.pos.distanceTo(playerPos);
      if (dist < magnetRadius) {
        const pullDir = playerPos.clone().sub(g.pos).normalize();
        const pullSpeed = (1 - dist / magnetRadius) * 28 + 12;
        g.vel.lerp(pullDir.multiplyScalar(pullSpeed), 8.0 * dt);
        g.pos.addScaledVector(g.vel, dt);

        if (dist < 1.4) {
          g.active = false;
          onCollect?.(g.value);
          this.dummy.position.set(0, -999, 0);
          this.dummy.scale.set(0, 0, 0);
          this.dummy.updateMatrix();
          this.gearMesh.setMatrixAt(i, this.dummy.matrix);
          gNeedsUpdate = true;
          continue;
        }
      } else {
        // Normal bouncing / resting
        g.pos.addScaledVector(g.vel, dt);
        g.vel.y -= 12.0 * dt;
        if (g.pos.y < 0.35) {
          g.pos.y = 0.35;
          g.vel.y = Math.abs(g.vel.y) * 0.4;
          g.vel.x *= 0.85;
          g.vel.z *= 0.85;
        }
      }

      this.dummy.position.copy(g.pos);
      this.dummy.rotation.set(0, g.rot, 0.4);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.gearMesh.setMatrixAt(i, this.dummy.matrix);
      gNeedsUpdate = true;
    }

    if (gNeedsUpdate) {
      this.gearMesh.instanceMatrix.needsUpdate = true;
    }
  }

  reset(): void {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles[i].active = false;
    }
    for (let i = 0; i < this.maxGears; i++) {
      this.gearParticles[i].active = false;
    }
    this.dummy.position.set(0, -999, 0);
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < this.maxParticles; i++) {
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    for (let i = 0; i < this.maxGears; i++) {
      this.gearMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.gearMesh.instanceMatrix.needsUpdate = true;
  }
}
