import * as THREE from 'three';
import { ParticleConfig, AcidPuddle } from '../types';

export class ParticleSystem {
  private scene: THREE.Scene;
  private maxParticles = 400;
  private particleCount = 0;

  // Instanced mesh for particle blobs
  private instancedMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private particlesData: ParticleConfig[] = [];

  // Acid Puddles
  private puddles: AcidPuddle[] = [];
  private puddleGeometry = new THREE.CircleGeometry(1, 16);
  private puddleMaterial = new THREE.MeshBasicMaterial({
    color: 0x39ff14,
    transparent: true,
    opacity: 0.5,
    depthWrite: false
  });

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const geom = new THREE.SphereGeometry(0.12, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });

    this.instancedMesh = new THREE.InstancedMesh(geom, mat, this.maxParticles);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.maxParticles * 3), 3);
    this.scene.add(this.instancedMesh);

    // Initialize all hidden
    for (let i = 0; i < this.maxParticles; i++) {
      this.dummy.position.set(0, -9999, 0);
      this.dummy.scale.set(0.001, 0.001, 0.001);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  public emit(config: ParticleConfig): void {
    if (this.particlesData.length >= this.maxParticles) {
      // Reuse oldest
      this.particlesData.shift();
    }
    this.particlesData.push({
      position: config.position.clone(),
      velocity: config.velocity.clone(),
      color: config.color,
      size: config.size,
      life: config.life,
      maxLife: config.maxLife,
      gravity: config.gravity ?? 9.8,
      drag: config.drag ?? 0.96,
      shrink: config.shrink ?? true
    });
  }

  public emitSlimeBurst(center: THREE.Vector3, count = 12, color = 0x00ff66): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 5.0;
      this.emit({
        position: new THREE.Vector3(center.x, center.y + 0.3, center.z),
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          2.0 + Math.random() * 4.0,
          Math.sin(angle) * speed
        ),
        color: color,
        size: 0.2 + Math.random() * 0.25,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        gravity: 12
      });
    }
  }

  public emitWoodDebris(center: THREE.Vector3, count = 10): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.0 + Math.random() * 6.0;
      this.emit({
        position: center.clone(),
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          3.0 + Math.random() * 5.0,
          Math.sin(angle) * speed
        ),
        color: 0x8d6e63,
        size: 0.18 + Math.random() * 0.2,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        gravity: 15
      });
    }
  }

  public emitSporeCloud(center: THREE.Vector3, radius = 3.0): void {
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      this.emit({
        position: new THREE.Vector3(
          center.x + Math.cos(angle) * r,
          center.y + 0.2 + Math.random() * 0.8,
          center.z + Math.sin(angle) * r
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          0.5 + Math.random() * 0.8,
          (Math.random() - 0.5) * 0.8
        ),
        color: 0x39ff14,
        size: 0.3 + Math.random() * 0.35,
        life: 0.8 + Math.random() * 0.6,
        maxLife: 1.4,
        gravity: -0.5 // float up
      });
    }
  }

  public spawnAcidPuddle(pos: THREE.Vector3, radius: number, duration: number, damagePerSec: number): void {
    const mesh = new THREE.Mesh(this.puddleGeometry, this.puddleMaterial.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0.04, pos.z);
    mesh.scale.set(radius, radius, 1);
    this.scene.add(mesh);

    this.puddles.push({
      position: pos.clone(),
      radius,
      duration,
      maxDuration: duration,
      damagePerSec,
      mesh
    });
  }

  public getActivePuddles(): AcidPuddle[] {
    return this.puddles;
  }

  public update(dt: number): void {
    // Update individual particles
    for (let i = this.particlesData.length - 1; i >= 0; i--) {
      const p = this.particlesData[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.particlesData.splice(i, 1);
        continue;
      }

      // Physics
      p.velocity.y -= (p.gravity ?? 9.8) * dt;
      p.velocity.x *= p.drag ?? 0.96;
      p.velocity.z *= p.drag ?? 0.96;

      p.position.addScaledVector(p.velocity, dt);

      // Floor bounce/stick
      if (p.position.y < 0.08) {
        p.position.y = 0.08;
        p.velocity.y = -p.velocity.y * 0.3;
      }
    }

    // Update InstancedMesh matrices & colors
    const activeCount = Math.min(this.particlesData.length, this.maxParticles);
    const colorHelper = new THREE.Color();

    for (let i = 0; i < this.maxParticles; i++) {
      if (i < activeCount) {
        const p = this.particlesData[i];
        const progress = 1 - p.life / p.maxLife;
        const scale = p.shrink ? Math.max(0.01, p.size * (1 - progress)) : p.size;

        this.dummy.position.copy(p.position);
        this.dummy.scale.set(scale, scale, scale);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);

        if (typeof p.color === 'number') {
          colorHelper.setHex(p.color);
        } else {
          colorHelper.copy(p.color);
        }
        this.instancedMesh.setColorAt(i, colorHelper);
      } else {
        this.dummy.position.set(0, -9999, 0);
        this.dummy.scale.set(0.001, 0.001, 0.001);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
      }
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }

    // Update Acid Puddles
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const puddle = this.puddles[i];
      puddle.duration -= dt;
      const progress = puddle.duration / puddle.maxDuration;

      const mat = puddle.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, progress * 0.6);

      if (puddle.duration <= 0) {
        this.scene.remove(puddle.mesh);
        puddle.mesh.geometry.dispose();
        mat.dispose();
        this.puddles.splice(i, 1);
      }
    }
  }

  public clear(): void {
    this.particlesData = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.dummy.position.set(0, -9999, 0);
      this.dummy.scale.set(0.001, 0.001, 0.001);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;

    for (const p of this.puddles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.puddles = [];
  }
}
