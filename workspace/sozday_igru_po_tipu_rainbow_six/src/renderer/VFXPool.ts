import * as THREE from "three";

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  color: THREE.Color;
  life: number;
  maxLife: number;
}

interface Tracer {
  origin: THREE.Vector3;
  target: THREE.Vector3;
  progress: number;
  speed: number;
  active: boolean;
  mesh: THREE.Line;
}

export class VFXPool {
  private scene: THREE.Scene;
  private maxParticles = 300;
  private particles: Particle[] = [];
  private instancedMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private baseColor = new THREE.Color();

  // Tracers
  private maxTracers = 20;
  private tracers: Tracer[] = [];

  // Muzzle Flash
  private muzzleFlashLight: THREE.PointLight;
  private muzzleFlashTime = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Particle InstancedMesh (shared sphere geometry & unlit standard material)
    const pGeo = new THREE.DodecahedronGeometry(0.04, 0);
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });

    this.instancedMesh = new THREE.InstancedMesh(pGeo, pMat, this.maxParticles);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.count = 0;
    this.scene.add(this.instancedMesh);

    // Pre-allocate particles array
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 1,
        color: new THREE.Color(1, 1, 1),
        life: 0,
        maxLife: 1,
      });
    }

    // Pre-allocate Tracer lines
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffe680, linewidth: 2 });
    for (let i = 0; i < this.maxTracers; i++) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 1),
      ]);
      const lineMesh = new THREE.Line(lineGeo, lineMat);
      lineMesh.visible = false;
      this.scene.add(lineMesh);

      this.tracers.push({
        origin: new THREE.Vector3(),
        target: new THREE.Vector3(),
        progress: 0,
        speed: 40,
        active: false,
        mesh: lineMesh,
      });
    }

    // Muzzle flash light
    this.muzzleFlashLight = new THREE.PointLight(0xffaa33, 0, 8);
    this.scene.add(this.muzzleFlashLight);
  }

  spawnExplosion(pos: { x: number; y: number; z: number }): void {
    // Spawn 60 explosion sparks & smoke particles
    const count = 60;
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      const angle = Math.random() * Math.PI * 2;
      const elev = (Math.random() - 0.3) * Math.PI;
      const speed = 2.5 + Math.random() * 8.0;

      p.x = pos.x;
      p.y = pos.y;
      p.z = pos.z;
      p.vx = Math.cos(angle) * Math.cos(elev) * speed;
      p.vy = Math.sin(elev) * speed + 1.5;
      p.vz = Math.sin(angle) * Math.cos(elev) * speed;

      p.maxLife = 0.5 + Math.random() * 0.8;
      p.life = p.maxLife;
      p.scale = 1.0 + Math.random() * 2.0;

      // Orange to dark grey smoke
      if (Math.random() < 0.6) {
        p.color.setHex(0xff6a00);
      } else {
        p.color.setHex(0x525960);
      }
    }
  }

  spawnSparks(pos: { x: number; y: number; z: number }, normal: { x: number; y: number; z: number }, count = 12): void {
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      const speed = 1.5 + Math.random() * 4.0;
      p.x = pos.x;
      p.y = pos.y;
      p.z = pos.z;

      p.vx = (normal.x + (Math.random() - 0.5) * 0.8) * speed;
      p.vy = (normal.y + (Math.random() - 0.2) * 0.8) * speed;
      p.vz = (normal.z + (Math.random() - 0.5) * 0.8) * speed;

      p.maxLife = 0.2 + Math.random() * 0.3;
      p.life = p.maxLife;
      p.scale = 0.6 + Math.random() * 0.6;
      p.color.setHex(0xffe680);
    }
  }

  spawnBloodSparks(pos: { x: number; y: number; z: number }): void {
    const count = 15;
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      const speed = 1.0 + Math.random() * 3.0;
      p.x = pos.x;
      p.y = pos.y;
      p.z = pos.z;

      p.vx = (Math.random() - 0.5) * speed;
      p.vy = Math.random() * speed * 0.8;
      p.vz = (Math.random() - 0.5) * speed;

      p.maxLife = 0.3 + Math.random() * 0.3;
      p.life = p.maxLife;
      p.scale = 0.8;
      p.color.setHex(0xff1e27);
    }
  }

  spawnTracer(origin: THREE.Vector3, target: THREE.Vector3): void {
    const tracer = this.tracers.find((t) => !t.active);
    if (!tracer) return;

    tracer.origin.copy(origin);
    tracer.target.copy(target);
    tracer.progress = 0;
    tracer.active = true;
    tracer.mesh.visible = true;

    // Update geometry initial points
    const posAttr = tracer.mesh.geometry.attributes.position as THREE.BufferAttribute;
    posAttr.setXYZ(0, origin.x, origin.y, origin.z);
    posAttr.setXYZ(1, origin.x, origin.y, origin.z);
    posAttr.needsUpdate = true;
  }

  triggerMuzzleFlash(pos: THREE.Vector3): void {
    this.muzzleFlashLight.position.copy(pos);
    this.muzzleFlashLight.intensity = 4.0;
    this.muzzleFlashTime = 0.05;
  }

  private getFreeParticle(): Particle | null {
    return this.particles.find((p) => p.life <= 0) || null;
  }

  update(scaledDt: number): void {
    // 1. Update Particles
    let activeCount = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.life > 0) {
        p.life -= scaledDt;
        p.x += p.vx * scaledDt;
        p.y += p.vy * scaledDt;
        p.z += p.vz * scaledDt;
        p.vy -= 9.8 * scaledDt; // Gravity on particles

        const progress = 1 - p.life / p.maxLife;
        const currentScale = p.scale * (1 - progress * 0.8);

        this.dummy.position.set(p.x, p.y, p.z);
        this.dummy.scale.set(currentScale, currentScale, currentScale);
        this.dummy.updateMatrix();

        this.instancedMesh.setMatrixAt(activeCount, this.dummy.matrix);
        this.instancedMesh.setColorAt(activeCount, this.baseColor.copy(p.color).multiplyScalar(1 - progress * 0.5));

        activeCount++;
      }
    }

    this.instancedMesh.count = activeCount;
    if (activeCount > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      if (this.instancedMesh.instanceColor) {
        this.instancedMesh.instanceColor.needsUpdate = true;
      }
    }

    // 2. Update Tracers
    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      if (t.active) {
        t.progress += t.speed * scaledDt;
        const totalDist = t.origin.distanceTo(t.target);

        if (t.progress >= totalDist) {
          t.active = false;
          t.mesh.visible = false;
        } else {
          const tailProgress = Math.max(0, t.progress - 1.8);
          const dir = new THREE.Vector3().subVectors(t.target, t.origin).normalize();

          const headPos = new THREE.Vector3().copy(t.origin).addScaledVector(dir, t.progress);
          const tailPos = new THREE.Vector3().copy(t.origin).addScaledVector(dir, tailProgress);

          const posAttr = t.mesh.geometry.attributes.position as THREE.BufferAttribute;
          posAttr.setXYZ(0, tailPos.x, tailPos.y, tailPos.z);
          posAttr.setXYZ(1, headPos.x, headPos.y, headPos.z);
          posAttr.needsUpdate = true;
        }
      }
    }

    // 3. Update Muzzle Flash Light
    if (this.muzzleFlashTime > 0) {
      this.muzzleFlashTime -= scaledDt;
      if (this.muzzleFlashTime <= 0) {
        this.muzzleFlashLight.intensity = 0;
      }
    }
  }
}
