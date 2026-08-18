import * as THREE from 'three';

interface Particle {
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
  private particles: Particle[] = [];
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
  }

  public emitSmoke(x: number, y: number, z: number, count = 2): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const gray = 0.65 + Math.random() * 0.25;
      this.particles.push({
        position: new THREE.Vector3(x + (Math.random() - 0.5) * 0.4, y + 0.15, z + (Math.random() - 0.5) * 0.4),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.8 + 0.5, (Math.random() - 0.5) * 1.5),
        color: new THREE.Color(gray, gray, gray),
        scale: 0.4 + Math.random() * 0.3,
        maxLife: 0.7 + Math.random() * 0.4,
        life: 0,
        growth: 2.2,
        gravity: -0.2, // Floats upward
        drag: 0.94,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 3,
      });
    }
  }

  public emitNitroFire(x: number, y: number, z: number, dir: THREE.Vector3, count = 3): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const isCyan = Math.random() > 0.4;
      const color = isCyan ? new THREE.Color(0x00f0ff) : new THREE.Color(0x3a86ff);
      const spread = new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8);
      const vel = dir.clone().multiplyScalar(-14.0).add(spread);

      this.particles.push({
        position: new THREE.Vector3(x, y + 0.2, z),
        velocity: vel,
        color: color,
        scale: 0.5 + Math.random() * 0.3,
        maxLife: 0.25 + Math.random() * 0.15,
        life: 0,
        growth: -1.2,
        gravity: 0,
        drag: 0.92,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 5,
      });
    }
  }

  public emitBloodSplatter(x: number, y: number, z: number, count = 12): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const color = Math.random() > 0.2 ? new THREE.Color(0x990000) : new THREE.Color(0x550000);
      this.particles.push({
        position: new THREE.Vector3(x, y + 0.5, z),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 6 + 2, (Math.random() - 0.5) * 9),
        color: color,
        scale: 0.35 + Math.random() * 0.35,
        maxLife: 0.6 + Math.random() * 0.4,
        life: 0,
        growth: -0.4,
        gravity: 12.0, // Drops fast
        drag: 0.96,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 4,
      });
    }
  }

  public emitSparks(x: number, y: number, z: number, count = 8): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const color = Math.random() > 0.5 ? new THREE.Color(0xffd166) : new THREE.Color(0xff9f1c);
      this.particles.push({
        position: new THREE.Vector3(x, y + 0.3, z),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 5 + 2, (Math.random() - 0.5) * 8),
        color: color,
        scale: 0.25 + Math.random() * 0.2,
        maxLife: 0.3 + Math.random() * 0.2,
        life: 0,
        growth: -0.8,
        gravity: 8.0,
        drag: 0.95,
        rotation: 0,
        rotSpeed: 0,
      });
    }
  }

  public emitExplosion(x: number, y: number, z: number, count = 24): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const r = Math.random();
      const color = r < 0.4 ? new THREE.Color(0xff4500) : r < 0.8 ? new THREE.Color(0xffba08) : new THREE.Color(0x333333);
      this.particles.push({
        position: new THREE.Vector3(x, y + 0.5, z),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 14, Math.random() * 8 + 3, (Math.random() - 0.5) * 14),
        color: color,
        scale: 0.6 + Math.random() * 0.6,
        maxLife: 0.5 + Math.random() * 0.4,
        life: 0,
        growth: 1.5,
        gravity: 2.0,
        drag: 0.92,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 6,
      });
    }
  }

  public emitAcidSplash(x: number, y: number, z: number, count = 8): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      this.particles.push({
        position: new THREE.Vector3(x, y + 0.3, z),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4 + 1, (Math.random() - 0.5) * 5),
        color: new THREE.Color(0x76ff03),
        scale: 0.4,
        maxLife: 0.5,
        life: 0,
        growth: 0.5,
        gravity: 8.0,
        drag: 0.95,
        rotation: 0,
        rotSpeed: 0,
      });
    }
  }

  public update(dt: number, camera: THREE.Camera): void {
    let activeIndex = 0;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.velocity.y -= p.gravity * dt;
      p.velocity.multiplyScalar(p.drag);
      p.position.addScaledVector(p.velocity, dt);
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

    // Hide remaining instances
    for (let j = activeIndex; j < this.maxParticles; j++) {
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(j, this.dummy.matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }
}
