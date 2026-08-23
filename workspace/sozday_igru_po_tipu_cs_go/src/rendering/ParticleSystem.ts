import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
}

export class ParticleSystem {
  private static instance: ParticleSystem;
  private scene: THREE.Scene | null = null;
  private particles: Particle[] = [];
  private sparksPool: THREE.Mesh[] = [];
  private helmetFlying: { mesh: THREE.Mesh; vel: THREE.Vector3; rotVel: THREE.Vector3; life: number } | null = null;

  public static get(): ParticleSystem {
    if (!ParticleSystem.instance) {
      ParticleSystem.instance = new ParticleSystem();
    }
    return ParticleSystem.instance;
  }

  public setScene(scene: THREE.Scene): void {
    this.scene = scene;
    // Prewarm spark pool
    const sparkGeo = new THREE.SphereGeometry(0.03, 4, 4);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xF1C40F });
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(sparkGeo, sparkMat);
      m.visible = false;
      this.scene.add(m);
      this.sparksPool.push(m);
    }
  }

  public spawnSparks(origin: THREE.Vector3, count: number = 20): void {
    if (!this.scene) return;

    for (let i = 0; i < count; i++) {
      const mesh = this.sparksPool.find((p) => !p.visible) || this.sparksPool[0];
      mesh.position.copy(origin);
      mesh.visible = true;

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 5 + 2,
        (Math.random() - 0.5) * 6
      );

      this.particles.push({
        mesh,
        velocity: vel,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.25,
        gravity: 12.0
      });
    }
  }

  public spawnTracer(start: THREE.Vector3, end: THREE.Vector3): void {
    if (!this.scene) return;

    const dir = end.clone().sub(start);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(0.015, 0.015, len, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0xF39C12 });
    const tracer = new THREE.Mesh(geo, mat);

    tracer.position.copy(start.clone().add(end).multiplyScalar(0.5));
    tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

    this.scene.add(tracer);

    setTimeout(() => {
      if (this.scene) {
        this.scene.remove(tracer);
        geo.dispose();
        mat.dispose();
      }
    }, 60);
  }

  public spawnFlyingHelmet(origin: THREE.Vector3, impulseMagnitude: number = 18.5): void {
    if (!this.scene) return;

    const helmetGeo = new THREE.SphereGeometry(0.14, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.7);
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x95A5A6, metalness: 0.4, roughness: 0.3 });
    const mesh = new THREE.Mesh(helmetGeo, helmetMat);
    mesh.position.copy(origin);
    this.scene.add(mesh);

    // Cinematic parabolic trajectory towards the sunset
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      impulseMagnitude * 0.4,
      -impulseMagnitude * 0.6
    );

    this.helmetFlying = {
      mesh,
      vel,
      rotVel: new THREE.Vector3(10, 15, 5),
      life: 0
    };
  }

  public update(dt: number): void {
    // Update sparks
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.mesh.visible = false;
        this.particles.splice(i, 1);
        continue;
      }
      p.velocity.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
    }

    // Update flying helmet
    if (this.helmetFlying) {
      this.helmetFlying.life += dt;
      this.helmetFlying.vel.y -= 14.0 * dt;
      this.helmetFlying.mesh.position.addScaledVector(this.helmetFlying.vel, dt);
      this.helmetFlying.mesh.rotation.x += this.helmetFlying.rotVel.x * dt;
      this.helmetFlying.mesh.rotation.y += this.helmetFlying.rotVel.y * dt;

      if (this.helmetFlying.life > 2.5 || this.helmetFlying.mesh.position.y < -30) {
        if (this.scene) {
          this.scene.remove(this.helmetFlying.mesh);
        }
        this.helmetFlying = null;
      }
    }
  }
}