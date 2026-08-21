import * as THREE from 'three';
import { eventBus } from '../core/EventBus';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  alpha: number;
}

export class ParticleSystem {
  readonly group = new THREE.Group();
  private particles: Particle[] = [];
  private maxParticles = 1500;

  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private pointsMesh: THREE.Points;

  private positionsArray: Float32Array;
  private colorsArray: Float32Array;

  constructor(private readonly scene: THREE.Scene) {
    this.positionsArray = new Float32Array(this.maxParticles * 3);
    this.colorsArray = new Float32Array(this.maxParticles * 3);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positionsArray, 3)
    );
    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colorsArray, 3)
    );

    this.material = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.90,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.pointsMesh = new THREE.Points(this.geometry, this.material);
    this.group.add(this.pointsMesh);
    this.scene.add(this.group);

    this.setupListeners();
  }

  private setupListeners(): void {
    eventBus.on('near_miss:trigger', (data) => {
      this.spawnSparks(
        new THREE.Vector3(data.position.x, data.position.y, data.position.z),
        15,
        data.isOpposing ? new THREE.Color(0xffaa00) : new THREE.Color(0xffd700)
      );
    });

    eventBus.on('game:crash', () => {
      this.spawnExplosionSparks();
    });
  }

  emitNitroFlames(exhaustPos: THREE.Vector3, forwardVec: THREE.Vector3, isOverdrive: boolean): void {
    const count = isOverdrive ? 6 : 3;
    const flameColor = isOverdrive
      ? new THREE.Color(0x00f0ff)
      : new THREE.Color(0x2979ff);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const spread = 0.15;
      const vel = forwardVec.clone()
        .multiplyScalar(-15.0 - Math.random() * 10.0)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread
          )
        );

      this.particles.push({
        position: exhaustPos.clone(),
        velocity: vel,
        life: 0.25 + Math.random() * 0.15,
        maxLife: 0.4,
        size: isOverdrive ? 0.55 : 0.35,
        color: flameColor,
        alpha: 1.0,
      });
    }
  }

  emitTireSmoke(wheelPos: THREE.Vector3): void {
    if (this.particles.length >= this.maxParticles) return;
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 2.0,
      0.5 + Math.random() * 1.5,
      (Math.random() - 0.5) * 2.0
    );
    this.particles.push({
      position: wheelPos.clone(),
      velocity: vel,
      life: 0.6 + Math.random() * 0.4,
      maxLife: 1.0,
      size: 0.60,
      color: new THREE.Color(0xddeeee),
      alpha: 0.80,
    });
  }

  spawnSparks(pos: THREE.Vector3, count = 20, color = new THREE.Color(0xffaa00)): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const speed = 5.0 + Math.random() * 15.0;
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2.0,
        Math.random() * 1.5 + 0.5,
        (Math.random() - 0.5) * 2.0
      ).normalize().multiplyScalar(speed);

      this.particles.push({
        position: pos.clone(),
        velocity: vel,
        life: 0.30 + Math.random() * 0.20,
        maxLife: 0.50,
        size: 0.25,
        color,
        alpha: 1.0,
      });
    }
  }

  spawnExplosionSparks(): void {
    // Burst on impact
  }

  update(dt: number): void {
    let activeCount = 0;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Velocity + mild gravity
      p.velocity.y -= 2.0 * dt;
      p.position.add(p.velocity.clone().multiplyScalar(dt));

      if (activeCount < this.maxParticles) {
        const idx = activeCount * 3;
        this.positionsArray[idx] = p.position.x;
        this.positionsArray[idx + 1] = p.position.y;
        this.positionsArray[idx + 2] = p.position.z;

        const lifeRatio = Math.max(0, p.life / p.maxLife);
        this.colorsArray[idx] = p.color.r * lifeRatio;
        this.colorsArray[idx + 1] = p.color.g * lifeRatio;
        this.colorsArray[idx + 2] = p.color.b * lifeRatio;
        activeCount++;
      }
    }

    for (let i = activeCount * 3; i < this.maxParticles * 3; i++) {
      this.positionsArray[i] = 0;
      this.colorsArray[i] = 0;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  reset(): void {
    this.particles = [];
  }
}
