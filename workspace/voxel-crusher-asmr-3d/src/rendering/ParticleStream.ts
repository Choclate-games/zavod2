import * as THREE from 'three';
import { DetachedVoxel } from './VoxelModelObject';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class ParticleStream {
  public instancedMesh: THREE.InstancedMesh;
  public maxParticles = 1000;
  public activeCount = 0;

  private physicsWorld = PhysicsWorld.getInstance();
  private dummy = new THREE.Object3D();
  private colorHelper = new THREE.Color();
  private zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

  public onParticleCollected?: (color: number, worldX: number, worldY: number) => void;

  constructor(scene: THREE.Scene) {
    this.maxParticles = this.physicsWorld.maxDebris;
    const cubeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const cubeMat = new THREE.MeshLambertMaterial();

    this.instancedMesh = new THREE.InstancedMesh(cubeGeo, cubeMat, this.maxParticles);
    // Debris is short-lived and numerous; excluding it from the shadow map keeps
    // the expensive shadow pass focused on the static machine and active model.
    this.instancedMesh.castShadow = false;
    this.instancedMesh.receiveShadow = false;

    for (let i = 0; i < this.maxParticles; i++) {
      this.instancedMesh.setMatrixAt(i, this.zeroMatrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    scene.add(this.instancedMesh);

    // Forward physics world particle collection event to our listener
    this.physicsWorld.onParticleCollected = (color: number, worldX: number, worldY: number) => {
      if (this.onParticleCollected) {
        this.onParticleCollected(color, worldX, worldY);
      }
    };
  }

  public spawnParticles(voxels: DetachedVoxel[], isTurbo: boolean): void {
    const count = voxels.length;
    if (count === 0) return;

    let colorNeedsUpdate = false;

    for (let i = 0; i < count; i++) {
      const v = voxels[i];
      const sideSign = v.worldX > 0 ? -1 : 1;
      const speedMult = isTurbo ? 1.6 : 1.0;

      const velX = v.impulseX !== undefined ? v.impulseX : (sideSign * (0.8 + Math.random() * 1.5)) * speedMult;
      const velY = v.impulseY !== undefined ? v.impulseY : (-2.5 - Math.random() * 3.5) * speedMult;
      const velZ = v.impulseZ !== undefined ? v.impulseZ : (Math.random() * 1.6 - 0.8) * speedMult;

      const idx = this.physicsWorld.spawnDebris(
        v.worldX + (Math.random() * 0.06 - 0.03),
        v.worldY - 0.04,
        v.worldZ + (Math.random() * 0.06 - 0.03),
        velX,
        velY,
        velZ,
        v.color,
        isTurbo
      );

      if (idx >= 0) {
        this.colorHelper.setHex(v.color);
        this.instancedMesh.setColorAt(idx, this.colorHelper);
        colorNeedsUpdate = true;
      }
    }

    if (colorNeedsUpdate && this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  public update(dt: number): void {
    // Step Rapier3D physics world
    this.physicsWorld.step(dt);
    this.activeCount = this.physicsWorld.activeDebrisCount;

    if (this.activeCount === 0 && this.physicsWorld.freeDebrisIndices.length === this.maxParticles) {
      return;
    }

    let matrixNeedsUpdate = false;
    const pool = this.physicsWorld.debrisPool;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = pool[i];
      if (p.active) {
        const trans = p.body.translation();
        const rot = p.body.rotation();

        this.dummy.position.set(trans.x, trans.y, trans.z);
        this.dummy.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        this.dummy.scale.set(p.scale, p.scale, p.scale);
        this.dummy.updateMatrix();

        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        matrixNeedsUpdate = true;
      } else {
        // If inactive, ensure matrix is collapsed to zero
        this.instancedMesh.setMatrixAt(i, this.zeroMatrix);
      }
    }

    if (matrixNeedsUpdate) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public reset(): void {
    this.physicsWorld.resetAllDebris();
    for (let i = 0; i < this.maxParticles; i++) {
      this.instancedMesh.setMatrixAt(i, this.zeroMatrix);
    }
    this.activeCount = 0;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }
}
