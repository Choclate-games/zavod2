import * as THREE from 'three';
import { ActiveDebrisParticle } from '../core/Types';
import { DetachedVoxel } from './VoxelModelObject';

export class ParticleStream {
  public instancedMesh: THREE.InstancedMesh;
  public maxParticles = 1500;
  public activeCount = 0;

  private particles: ActiveDebrisParticle[];
  private freeIndices: number[] = [];
  private dummy = new THREE.Object3D();
  private colorHelper = new THREE.Color();
  private zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

  public onParticleCollected?: (color: number, worldX: number, worldY: number) => void;

  constructor(scene: THREE.Scene) {
    const cubeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const cubeMat = new THREE.MeshLambertMaterial();

    this.instancedMesh = new THREE.InstancedMesh(cubeGeo, cubeMat, this.maxParticles);
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = false;

    this.particles = new Array(this.maxParticles);
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles[i] = {
        active: false,
        posX: 0,
        posY: 0,
        posZ: 0,
        velX: 0,
        velY: 0,
        velZ: 0,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        rotVelX: 0,
        rotVelY: 0,
        rotVelZ: 0,
        scale: 1,
        color: 0xffffff,
        life: 0,
        maxLife: 2.0,
        bounces: 0
      };
      this.freeIndices.push(i);
      this.instancedMesh.setMatrixAt(i, this.zeroMatrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    scene.add(this.instancedMesh);
  }

  public spawnParticles(voxels: DetachedVoxel[], isTurbo: boolean): void {
    const count = voxels.length;
    if (count === 0) return;

    let matrixNeedsUpdate = false;
    let colorNeedsUpdate = false;

    for (let i = 0; i < count; i++) {
      let idx: number;
      if (this.freeIndices.length > 0) {
        idx = this.freeIndices.pop()!;
      } else {
        // Recycle oldest particle
        idx = Math.floor(Math.random() * this.maxParticles);
      }

      const v = voxels[i];
      const p = this.particles[idx];

      p.active = true;
      p.posX = v.worldX + (Math.random() * 0.08 - 0.04);
      p.posY = v.worldY - 0.05;
      p.posZ = v.worldZ + (Math.random() * 0.08 - 0.04);

      // Inward pull then outward ejection from teeth
      const sideSign = p.posX > 0 ? 1 : -1;
      const speedMult = isTurbo ? 1.6 : 1.0;

      p.velX = (sideSign * (0.8 + Math.random() * 1.5) + (Math.random() * 0.6 - 0.3)) * speedMult;
      p.velY = (-2.5 - Math.random() * 3.5) * speedMult; // Strong downward momentum
      p.velZ = (Math.random() * 1.6 - 0.8) * speedMult;

      p.rotX = Math.random() * Math.PI * 2;
      p.rotY = Math.random() * Math.PI * 2;
      p.rotZ = Math.random() * Math.PI * 2;

      p.rotVelX = (Math.random() * 12 - 6) * speedMult;
      p.rotVelY = (Math.random() * 12 - 6) * speedMult;
      p.rotVelZ = (Math.random() * 12 - 6) * speedMult;

      p.scale = 1.0;
      p.color = v.color;
      p.life = 0;
      p.maxLife = 1.8 + Math.random() * 0.8;
      p.bounces = 0;

      this.colorHelper.setHex(v.color);
      this.instancedMesh.setColorAt(idx, this.colorHelper);
      colorNeedsUpdate = true;

      this.dummy.position.set(p.posX, p.posY, p.posZ);
      this.dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
      this.dummy.scale.set(p.scale, p.scale, p.scale);
      this.dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(idx, this.dummy.matrix);
      matrixNeedsUpdate = true;
      this.activeCount++;
    }

    if (matrixNeedsUpdate) this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (colorNeedsUpdate && this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true;
  }

  public update(dt: number): void {
    if (this.activeCount === 0) return;

    const gravity = -14.0;
    const basketFloorY = -3.4;
    const basketBoundsX = 1.8;
    const basketBoundsZ = 1.6;

    let matrixNeedsUpdate = false;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        this.recycleParticle(i);
        matrixNeedsUpdate = true;
        continue;
      }

      // Physics integration
      p.velY += gravity * dt;
      p.posX += p.velX * dt;
      p.posY += p.velY * dt;
      p.posZ += p.velZ * dt;

      p.rotX += p.rotVelX * dt;
      p.rotY += p.rotVelY * dt;
      p.rotZ += p.rotVelZ * dt;

      // Basket floor collision & restitution bounce
      if (p.posY <= basketFloorY) {
        p.posY = basketFloorY;
        p.velY = -p.velY * 0.35; // Inelastic dampening bounce
        p.velX *= 0.6;
        p.velZ *= 0.6;
        p.bounces++;

        // Notify collector on first good bounce
        if (p.bounces === 1 && this.onParticleCollected) {
          this.onParticleCollected(p.color, p.posX, p.posY);
        }

        // Fast decay once settled in basket
        if (p.bounces >= 3 || Math.abs(p.velY) < 0.2) {
          p.scale = Math.max(0, p.scale - dt * 2.5);
          if (p.scale <= 0.05) {
            this.recycleParticle(i);
            matrixNeedsUpdate = true;
            continue;
          }
        }
      }

      // Funnel side bounce
      if (Math.abs(p.posX) > basketBoundsX && p.posY < -1.0) {
        p.velX = -p.velX * 0.5;
        p.posX = Math.sign(p.posX) * basketBoundsX;
      }
      if (Math.abs(p.posZ) > basketBoundsZ && p.posY < -1.0) {
        p.velZ = -p.velZ * 0.5;
        p.posZ = Math.sign(p.posZ) * basketBoundsZ;
      }

      // Sync to InstancedMesh matrix
      this.dummy.position.set(p.posX, p.posY, p.posZ);
      this.dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
      this.dummy.scale.set(p.scale, p.scale, p.scale);
      this.dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
      matrixNeedsUpdate = true;
    }

    if (matrixNeedsUpdate) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private recycleParticle(index: number): void {
    const p = this.particles[index];
    p.active = false;
    this.freeIndices.push(index);
    this.instancedMesh.setMatrixAt(index, this.zeroMatrix);
    this.activeCount = Math.max(0, this.activeCount - 1);
  }

  public reset(): void {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles[i].active = false;
      this.freeIndices.push(i);
      this.instancedMesh.setMatrixAt(i, this.zeroMatrix);
    }
    this.activeCount = 0;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }
}
