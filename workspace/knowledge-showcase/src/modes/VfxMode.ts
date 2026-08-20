import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

interface InstancedParticle {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  scale: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

export class VfxMode {
  public group = new THREE.Group();

  // 1000+ InstancedMesh Particle Pool
  private maxParticles = 1200;
  private particles: InstancedParticle[] = [];
  private instancedMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  // Shockwave Ring
  private shockwaveMesh: THREE.Mesh;
  private shockwaveRadius = 0;
  private isShockwaveActive = false;

  constructor(
    private parentScene: THREE.Scene,
    private audio: AudioManager,
    private onCameraShake: (trauma: number) => void
  ) {
    this.group.visible = false;
    this.parentScene.add(this.group);

    this.buildGround();
    this.buildParticlePool();
    this.buildShockwaveMesh();
  }

  private buildGround(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshStandardMaterial({ color: 0x111625, roughness: 0.8, metalness: 0.3 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    const grid = new THREE.GridHelper(36, 18, 0xff771a, 0x222a38);
    grid.position.y = 0.01;
    this.group.add(grid);
  }

  private buildParticlePool(): void {
    const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxParticles);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.instancedMesh);

    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        scale: 1.0,
        life: 0,
        maxLife: 1.0,
        color: new THREE.Color(),
      });
      this.dummy.position.set(0, -999, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  private buildShockwaveMesh(): void {
    const ringGeo = new THREE.RingGeometry(0.1, 0.4, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00cec9,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    this.shockwaveMesh = new THREE.Mesh(ringGeo, ringMat);
    this.shockwaveMesh.position.y = 0.05;
    this.shockwaveMesh.visible = false;
    this.group.add(this.shockwaveMesh);
  }

  public emitBurst(type: 'explosion' | 'sparks' | 'confetti' | 'water' | 'smoke'): void {
    const pos = new THREE.Vector3(0, 0.2, 0);

    if (type === 'explosion') {
      this.spawnParticles(pos, 180, 0xff4757, 14.0, -12.0, 0.9);
      this.triggerShockwave();
      this.audio.playExplosion(1.0);
      this.onCameraShake(0.65);
    } else if (type === 'sparks') {
      this.spawnParticles(pos, 120, 0xffa502, 12.0, -18.0, 0.45);
      this.audio.playParryClang();
      this.onCameraShake(0.3);
    } else if (type === 'confetti') {
      this.spawnParticles(pos, 200, 0x2ed573, 9.0, -4.0, 1.8, true);
      this.audio.playLevelUp();
    } else if (type === 'water') {
      this.spawnParticles(pos, 140, 0x1e90ff, 10.0, -14.0, 0.7);
      this.audio.playDash();
    } else if (type === 'smoke') {
      this.spawnParticles(pos, 100, 0x747d8c, 4.0, 0.8, 2.0);
      this.audio.playSwordSlash();
    }
  }

  private spawnParticles(
    pos: THREE.Vector3,
    count: number,
    colorHex: number,
    speed: number,
    gravity: number,
    duration: number,
    multiColor = false
  ): void {
    let spawned = 0;
    const colors = [0xff4757, 0x2ed573, 0x1e90ff, 0xffa502, 0x9b59b6];

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.position.copy(pos);

        const angleH = Math.random() * Math.PI * 2;
        const angleV = Math.random() * Math.PI * 0.5;
        p.velocity.set(
          Math.cos(angleH) * Math.cos(angleV) * speed,
          Math.sin(angleV) * speed + 2.0,
          Math.sin(angleH) * Math.cos(angleV) * speed
        );

        p.life = 0;
        p.maxLife = duration * (0.6 + Math.random() * 0.8);
        p.scale = 0.8 + Math.random() * 0.6;
        p.color.setHex(multiColor ? colors[Math.floor(Math.random() * colors.length)] : colorHex);

        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  private triggerShockwave(): void {
    this.isShockwaveActive = true;
    this.shockwaveRadius = 0.2;
    this.shockwaveMesh.visible = true;
    this.shockwaveMesh.scale.set(1, 1, 1);
  }

  public update(dt: number): void {
    if (!this.group.visible) return;

    // 1. Update Instanced Particles
    let activeCount = 0;
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          this.dummy.position.set(0, -999, 0);
          this.dummy.updateMatrix();
          this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
          continue;
        }

        // Velocity & Drag
        p.velocity.y -= 12.0 * dt;
        p.position.addScaledVector(p.velocity, dt);

        if (p.position.y <= 0) {
          p.position.y = 0;
          p.velocity.y *= -0.35;
          p.velocity.x *= 0.85;
          p.velocity.z *= 0.85;
        }

        const progress = p.life / p.maxLife;
        const scale = (1.0 - progress) * p.scale;

        this.dummy.position.copy(p.position);
        this.dummy.scale.set(scale, scale, scale);
        this.dummy.updateMatrix();

        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        this.instancedMesh.setColorAt(i, p.color);
        activeCount++;
      }
    }

    if (activeCount > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      if (this.instancedMesh.instanceColor) {
        this.instancedMesh.instanceColor.needsUpdate = true;
      }
    }

    // 2. Update Shockwave Ring Expansion
    if (this.isShockwaveActive) {
      this.shockwaveRadius += 16.0 * dt;
      this.shockwaveMesh.scale.set(this.shockwaveRadius, this.shockwaveRadius, 1);
      const alpha = Math.max(0, 1.0 - this.shockwaveRadius / 14.0);
      (this.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = alpha;

      if (this.shockwaveRadius >= 14.0) {
        this.isShockwaveActive = false;
        this.shockwaveMesh.visible = false;
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
