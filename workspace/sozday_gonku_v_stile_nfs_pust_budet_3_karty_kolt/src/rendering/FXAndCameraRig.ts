import * as THREE from 'three';
import { GAME_BALANCE } from '../core/Constants';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
  scaleStart: number;
  scaleEnd: number;
}

export class FXAndCameraRig {
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;

  // Chase Camera state
  private currentCameraPos = new THREE.Vector3();
  private currentLookTarget = new THREE.Vector3();
  private targetFov = 60.0;
  private currentFov = 60.0;
  private trauma = 0; // Shake strength

  // Garage Orbit camera angle
  private garageOrbitAngle = 0;

  // Particle Pools
  private smokeParticles: Particle[] = [];
  private sparkParticles: Particle[] = [];
  private flameParticles: Particle[] = [];

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;

    this.initParticlePools();
  }

  private initParticlePools(): void {
    // 1. Smoke Pool (30 particles)
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const smokeGeo = new THREE.PlaneGeometry(0.8, 0.8);

    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(smokeGeo, smokeMat.clone());
      mesh.visible = false;
      this.scene.add(mesh);
      this.smokeParticles.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.6,
        active: false,
        scaleStart: 0.4,
        scaleEnd: 2.2,
      });
    }

    // 2. Sparks Pool (30 particles)
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.9,
    });
    const sparkGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);

    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sparkParticles.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.4,
        active: false,
        scaleStart: 1.0,
        scaleEnd: 0.1,
      });
    }

    // 3. Nitro Flame Pool (12 particles)
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.85,
    });
    const flameGeo = new THREE.ConeGeometry(0.15, 0.6, 6);
    flameGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(flameGeo, flameMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.flameParticles.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.15,
        active: false,
        scaleStart: 1.0,
        scaleEnd: 0.2,
      });
    }
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  spawnDriftSmoke(rearWheelPos: THREE.Vector3, slipRatio: number): void {
    if (Math.random() > 0.4) return;
    const p = this.smokeParticles.find((item) => !item.active);
    if (!p) return;

    p.active = true;
    p.life = 0;
    p.maxLife = 0.5 + Math.random() * 0.3;
    p.mesh.position.copy(rearWheelPos).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.1, (Math.random() - 0.5) * 0.3));
    p.mesh.visible = true;
    p.mesh.scale.setScalar(p.scaleStart);
    p.velocity.set((Math.random() - 0.5) * 1.5, 1.2 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5);
  }

  spawnSparks(contactPos: THREE.Vector3): void {
    for (let i = 0; i < 4; i++) {
      const p = this.sparkParticles.find((item) => !item.active);
      if (!p) break;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.25 + Math.random() * 0.2;
      p.mesh.position.copy(contactPos);
      p.mesh.visible = true;
      p.mesh.scale.setScalar(1.0);
      p.velocity.set(
        (Math.random() - 0.5) * 8.0,
        2.0 + Math.random() * 6.0,
        (Math.random() - 0.5) * 8.0
      );
    }
  }

  spawnNitroFlame(exhaustPos: THREE.Vector3, forwardDir: THREE.Vector3): void {
    const p = this.flameParticles.find((item) => !item.active);
    if (!p) return;

    p.active = true;
    p.life = 0;
    p.maxLife = 0.12;
    p.mesh.position.copy(exhaustPos);
    p.mesh.lookAt(exhaustPos.clone().add(forwardDir));
    p.mesh.visible = true;
    p.mesh.scale.setScalar(0.8 + Math.random() * 0.6);
    p.velocity.copy(forwardDir).multiplyScalar(-8.0);
  }

  update(
    dt: number,
    carPos: THREE.Vector3,
    carRot: THREE.Quaternion,
    speedKmh: number,
    slipAngleRad: number,
    isBoosting: boolean,
    isMenuMode: boolean = false
  ): void {
    // 1. Update Particles
    this.updateParticles(this.smokeParticles, dt);
    this.updateParticles(this.sparkParticles, dt, true);
    this.updateParticles(this.flameParticles, dt);

    if (isMenuMode) {
      // Orbital Turntable Camera in Garage
      this.garageOrbitAngle += 0.25 * dt;
      const radius = 6.8;
      const camY = 2.2;
      const x = carPos.x + Math.sin(this.garageOrbitAngle) * radius;
      const z = carPos.z + Math.cos(this.garageOrbitAngle) * radius;

      this.camera.position.set(x, carPos.y + camY, z);
      this.camera.lookAt(carPos.x, carPos.y + 0.6, carPos.z);
      this.camera.fov = 55;
      this.camera.updateProjectionMatrix();
      return;
    }

    // 2. Gameplay Chase Camera
    this.targetFov = isBoosting ? GAME_BALANCE.nitro.nitroFovDeg : GAME_BALANCE.nitro.baseFovDeg;
    this.currentFov += (this.targetFov - this.currentFov) * Math.min(1.0, dt * 6.0);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    // Chase distance and height adjust slightly with speed
    const chaseDist = 6.2 + Math.min(2.0, (speedKmh / 200) * 1.5);
    const chaseHeight = 2.3 - Math.min(0.4, (speedKmh / 200) * 0.3);

    // Compute ideal camera position in car's local space
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(carRot);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(carRot);

    // Drift lag offset
    const driftOffset = -Math.sin(slipAngleRad) * 1.8;
    const idealCamPos = carPos.clone()
      .addScaledVector(fwd, -chaseDist)
      .addScaledVector(right, driftOffset)
      .add(new THREE.Vector3(0, chaseHeight, 0));

    const idealLookTarget = carPos.clone()
      .addScaledVector(fwd, 4.0)
      .add(new THREE.Vector3(0, 0.8, 0));

    // Smooth exponential lag lerp: 1 - exp(-k * dt)
    const kPos = 12.0;
    const kLook = 15.0;
    const posAlpha = 1.0 - Math.exp(-kPos * dt);
    const lookAlpha = 1.0 - Math.exp(-kLook * dt);

    this.currentCameraPos.lerp(idealCamPos, posAlpha);
    this.currentLookTarget.lerp(idealLookTarget, lookAlpha);

    // Trauma shake decay
    let shakeX = 0;
    let shakeY = 0;
    if (this.trauma > 0) {
      const shakeMag = this.trauma * this.trauma * 0.35;
      shakeX = (Math.random() - 0.5) * shakeMag;
      shakeY = (Math.random() - 0.5) * shakeMag;
      this.trauma = Math.max(0, this.trauma - dt * 2.5);
    }

    this.camera.position.copy(this.currentCameraPos).add(new THREE.Vector3(shakeX, shakeY, 0));
    this.camera.lookAt(this.currentLookTarget);
  }

  private updateParticles(particles: Particle[], dt: number, applyGravity: boolean = false): void {
    particles.forEach((p) => {
      if (!p.active) return;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        return;
      }

      if (applyGravity) {
        p.velocity.y -= 14.0 * dt;
      }

      p.mesh.position.addScaledVector(p.velocity, dt);
      const progress = p.life / p.maxLife;
      const curScale = p.scaleStart + (p.scaleEnd - p.scaleStart) * progress;
      p.mesh.scale.setScalar(curScale);

      const mat = p.mesh.material as THREE.Material;
      mat.opacity = 1.0 - progress;
    });
  }
}
