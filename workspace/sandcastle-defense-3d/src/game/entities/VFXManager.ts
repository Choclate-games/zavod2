import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  gravity: number;
  life: number;
  maxLife: number;
  scaleDecay: boolean;
}

export class VFXManager {
  private scene: THREE.Scene;
  private particles: Particle[] = [];

  // Reusable materials & geometries for pooling
  private sandGeo: THREE.DodecahedronGeometry;
  private sandMat: THREE.MeshLambertMaterial;
  private waterGeo: THREE.SphereGeometry;
  private waterMat: THREE.MeshBasicMaterial;
  private sparkGeo: THREE.BoxGeometry;
  private sparkMat: THREE.MeshBasicMaterial;

  // Tsunami wave mesh
  private tsunamiMesh: THREE.Mesh | null = null;
  private tsunamiActive: boolean = false;
  private tsunamiProgress: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.sandGeo = new THREE.DodecahedronGeometry(0.08, 0);
    this.sandMat = new THREE.MeshLambertMaterial({ color: 0xF7D070 });

    this.waterGeo = new THREE.SphereGeometry(0.06, 4, 4);
    this.waterMat = new THREE.MeshBasicMaterial({ color: 0x48E5D5, transparent: true, opacity: 0.8 });

    this.sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });

    this.createTsunamiMesh();
  }

  private createTsunamiMesh(): void {
    const geo = new THREE.CylinderGeometry(2.5, 3.5, 24, 16, 1, true, 0, Math.PI);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x29C5B5,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.tsunamiMesh = new THREE.Mesh(geo, mat);
    this.tsunamiMesh.rotation.z = Math.PI / 2;
    this.tsunamiMesh.rotation.y = Math.PI / 2;
    this.tsunamiMesh.visible = false;
    this.scene.add(this.tsunamiMesh);
  }

  public spawnSandDust(x: number, y: number, z: number, count: number = 10): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.sandGeo, this.sandMat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.4,
        y + 0.1,
        z + (Math.random() - 0.5) * 0.4
      );
      this.scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 1.5;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        1.2 + Math.random() * 1.5,
        Math.sin(angle) * speed
      );

      this.particles.push({
        mesh,
        velocity: vel,
        gravity: 6.0,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.25,
        scaleDecay: true,
      });
    }
  }

  public spawnWaterSplash(x: number, y: number, z: number, count: number = 8): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.waterGeo, this.waterMat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.5,
        y + 0.2,
        z + (Math.random() - 0.5) * 0.5
      );
      this.scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 2.0;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        1.5 + Math.random() * 2.0,
        Math.sin(angle) * speed
      );

      this.particles.push({
        mesh,
        velocity: vel,
        gravity: 8.0,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
        scaleDecay: true,
      });
    }
  }

  public spawnHitSparks(x: number, y: number, z: number, count: number = 6): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      mesh.position.set(x, y + 0.3, z);
      this.scene.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3.0,
        1.5 + Math.random() * 2.5,
        (Math.random() - 0.5) * 3.0
      );

      this.particles.push({
        mesh,
        velocity: vel,
        gravity: 9.0,
        life: 0,
        maxLife: 0.25 + Math.random() * 0.15,
        scaleDecay: true,
      });
    }
  }

  public triggerTsunami(): void {
    if (!this.tsunamiMesh) return;
    this.tsunamiActive = true;
    this.tsunamiProgress = 0;
    this.tsunamiMesh.visible = true;
    this.tsunamiMesh.position.set(-18, 0, 0);
  }

  public update(dt: number): void {
    // Update active particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      p.velocity.y -= p.gravity * dt;
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;

      if (p.scaleDecay) {
        const ratio = Math.max(0, 1.0 - p.life / p.maxLife);
        p.mesh.scale.set(ratio, ratio, ratio);
      }

      if (p.life >= p.maxLife || p.mesh.position.y < -0.2) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }

    // Update Tsunami Wave animation
    if (this.tsunamiActive && this.tsunamiMesh) {
      this.tsunamiProgress += dt * 0.8;
      // Sweep from -18 to +18 along X
      const currX = -18 + this.tsunamiProgress * 36;
      this.tsunamiMesh.position.x = currX;

      if (this.tsunamiProgress >= 1.0) {
        this.tsunamiActive = false;
        this.tsunamiMesh.visible = false;
      }
    }
  }

  public clear(): void {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
    }
    this.particles = [];
    if (this.tsunamiMesh) {
      this.tsunamiMesh.visible = false;
      this.tsunamiActive = false;
    }
  }
}
