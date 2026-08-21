import * as THREE from 'three';
import { VoxelModelData } from '../core/Types';
import { RollerBVH, CollisionResult } from '../physics/RollerBVH';

export interface DetachedVoxel {
  worldX: number;
  worldY: number;
  worldZ: number;
  color: number;
  impulseX?: number;
  impulseY?: number;
  impulseZ?: number;
}

export class VoxelModelObject {
  public group: THREE.Group;
  public modelData: VoxelModelData;
  public totalVoxels: number;
  public remainingVoxels: number;

  private instancedMesh!: THREE.InstancedMesh;
  private voxelSize = 0.13;
  private dummy = new THREE.Object3D();
  private zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

  // Voxel State Arrays
  private voxelPositions: Float32Array; // local [x, y, z]
  private voxelColors: Uint32Array;
  private voxelActive: Uint8Array;
  private voxelHealth: Float32Array;
  private voxelMaxHealth: Float32Array;
  private detachedVoxels: DetachedVoxel[] = [];
  private worldPosition = new THREE.Vector3();
  private minActiveLy = 0;

  // BVH Collision Query Objects (reused per frame, zero allocations)
  private rollerBVH = RollerBVH.getInstance();
  private queryBox = new THREE.Box3();
  private colResult: CollisionResult = {
    collided: false,
    rollerSide: 'none',
    impactVelocityX: 0,
    impactVelocityY: 0,
    impactVelocityZ: 0,
    depth: 0
  };

  public posY = 3.8;
  public targetY = 3.8;
  public wobbleAngle = 0;
  private fallVelocity = 0;
  private previousPosY = 3.8;

  constructor(scene: THREE.Scene, modelData: VoxelModelData) {
    this.group = new THREE.Group();
    this.modelData = modelData;
    this.totalVoxels = modelData.voxels.length;
    this.remainingVoxels = this.totalVoxels;

    const count = this.totalVoxels;
    this.voxelPositions = new Float32Array(count * 3);
    this.voxelColors = new Uint32Array(count);
    this.voxelActive = new Uint8Array(count);
    this.voxelHealth = new Float32Array(count);
    this.voxelMaxHealth = new Float32Array(count);

    this.buildInstancedMesh();
    this.group.position.set(0, this.posY, 0);
    scene.add(this.group);
  }

  private buildInstancedMesh(): void {
    const cubeGeo = new THREE.BoxGeometry(this.voxelSize, this.voxelSize, this.voxelSize);
    const cubeMat = new THREE.MeshLambertMaterial();

    this.instancedMesh = new THREE.InstancedMesh(cubeGeo, cubeMat, this.totalVoxels);
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = true;

    const colorHelper = new THREE.Color();
    const voxels = this.modelData.voxels;

    // Center the model in local space
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < voxels.length; i++) {
      const v = voxels[i];
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
      if (v.z < minZ) minZ = v.z;
      if (v.z > maxZ) maxZ = v.z;
    }

    const centerX = (minX + maxX) / 2;
    const centerY = minY; // Sit at local bottom Y = 0
    const centerZ = (minZ + maxZ) / 2;

    const hardness = this.modelData.hardness;
    // Substantial base health per voxel (scaled by hardness)
    const baseHealth = 24.0 * Math.pow(hardness, 1.25);

    for (let i = 0; i < voxels.length; i++) {
      const v = voxels[i];
      const lx = (v.x - centerX) * this.voxelSize;
      const ly = (v.y - centerY) * this.voxelSize;
      const lz = (v.z - centerZ) * this.voxelSize;

      this.voxelPositions[i * 3] = lx;
      this.voxelPositions[i * 3 + 1] = ly;
      this.voxelPositions[i * 3 + 2] = lz;
      this.voxelColors[i] = v.color;
      this.voxelActive[i] = 1;

      // Deterministic per-voxel variation for organic, non-uniform chipping
      const hash = Math.abs(Math.sin((v.x + 11) * 12.9898 + (v.y + 19) * 78.233 + (v.z + 23) * 45.164)) % 1;
      const health = Math.round((baseHealth * (0.85 + 0.30 * hash)) * 10) / 10;
      this.voxelMaxHealth[i] = health;
      this.voxelHealth[i] = health;

      this.dummy.position.set(lx, ly, lz);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);

      colorHelper.setHex(v.color);
      this.instancedMesh.setColorAt(i, colorHelper);
    }

    this.minActiveLy = 0;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }

    this.group.add(this.instancedMesh);
  }

  private updateLowestActiveLy(): void {
    let minLy = Infinity;
    for (let i = 0; i < this.totalVoxels; i++) {
      if (this.voxelActive[i] === 1) {
        const ly = this.voxelPositions[i * 3 + 1];
        if (ly < minLy) {
          minLy = ly;
        }
      }
    }
    this.minActiveLy = minLy === Infinity ? 0 : minLy;
  }

  /**
   * Slice voxels that have passed through or reached the contact plane (nipThresholdY)
   * Calculates physical collision via three-mesh-bvh against rotating roller teeth.
   */
  public sliceVoxels(
    nipThresholdY: number,
    minContactX: number,
    maxContactX: number,
    minContactZ: number,
    maxContactZ: number,
    contactHalfHeight: number,
    damageThisFrame: number,
    rollerSpeed: number,
    isTurbo: boolean
  ): DetachedVoxel[] {
    this.detachedVoxels.length = 0;
    if (this.remainingVoxels <= 0) return this.detachedVoxels;

    let matrixNeedsUpdate = false;
    const minY = nipThresholdY - contactHalfHeight;
    const maxY = nipThresholdY + contactHalfHeight;
    const halfVoxel = this.voxelSize / 2;

    for (let idx = 0; idx < this.totalVoxels; idx++) {
      if (this.voxelActive[idx] === 0) continue;

      const lx = this.voxelPositions[idx * 3];
      const ly = this.voxelPositions[idx * 3 + 1];
      const lz = this.voxelPositions[idx * 3 + 2];

      const worldX = this.group.position.x + lx;
      const worldY = this.group.position.y + ly;
      const worldZ = this.group.position.z + lz;

      const inX = worldX >= minContactX && worldX <= maxContactX;
      const inZ = worldZ >= minContactZ && worldZ <= maxContactZ;
      if (!inX || !inZ) continue;

      const inY = worldY >= minY && worldY <= maxY;
      const crossedY = worldY < minY && (this.previousPosY + ly) >= minY;
      if (!inY && !crossedY) continue;

      // Construct bounding box for voxel in 3D world space
      this.queryBox.min.set(worldX - halfVoxel, worldY - halfVoxel, worldZ - halfVoxel);
      this.queryBox.max.set(worldX + halfVoxel, worldY + halfVoxel, worldZ + halfVoxel);

      // Accelerated geometric collision test against roller teeth via three-mesh-bvh
      const directToothHit = this.rollerBVH.testVoxelCollision(
        this.queryBox,
        rollerSpeed,
        isTurbo,
        this.colResult
      );

      // Tooth impact applies amplified physical damage
      const effectiveDamage = directToothHit ? damageThisFrame * 1.5 : damageThisFrame;
      this.voxelHealth[idx] -= effectiveDamage;

      if (this.voxelHealth[idx] > 0) {
        continue;
      }

      this.voxelHealth[idx] = 0;
      this.voxelActive[idx] = 0;
      this.remainingVoxels--;

      this.worldPosition.set(lx, ly, lz);
      this.group.localToWorld(this.worldPosition);

      // Ejection velocity computed from physics collision
      let impX: number, impY: number, impZ: number;
      if (directToothHit) {
        impX = this.colResult.impactVelocityX;
        impY = this.colResult.impactVelocityY;
        impZ = this.colResult.impactVelocityZ;
      } else {
        const sideSign = worldX > 0 ? -1 : 1;
        const speedMult = isTurbo ? 1.6 : 1.0;
        impX = (sideSign * (0.8 + Math.random() * 1.5) + (Math.random() * 0.6 - 0.3)) * speedMult;
        impY = (-2.5 - Math.random() * 3.5) * speedMult;
        impZ = (Math.random() * 1.6 - 0.8) * speedMult;
      }

      this.detachedVoxels.push({
        worldX: this.worldPosition.x,
        worldY: this.worldPosition.y,
        worldZ: this.worldPosition.z,
        color: this.voxelColors[idx],
        impulseX: impX,
        impulseY: impY,
        impulseZ: impZ
      });

      this.instancedMesh.setMatrixAt(idx, this.zeroMatrix);
      matrixNeedsUpdate = true;
    }

    if (matrixNeedsUpdate) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      this.updateLowestActiveLy();
    }

    return this.detachedVoxels;
  }

  public updateDescent(feedSpeed: number, dt: number, isTurbo: boolean, nipY: number): void {
    this.previousPosY = this.posY;
    const bottomWorldY = this.posY + this.minActiveLy;

    if (bottomWorldY > nipY) {
      // Free fall under gravity until reaching the top teeth of the rollers
      this.fallVelocity = Math.min(this.fallVelocity + 12.0 * dt, 4.5);
      this.posY -= this.fallVelocity * dt;
      if (this.posY + this.minActiveLy < nipY) {
        this.posY = nipY - this.minActiveLy;
        this.fallVelocity = 0;
      }
    } else {
      // Contact with rollers: pulled downward at controlled shredder feed rate
      this.fallVelocity = 0;
      const feedRate = feedSpeed * (isTurbo ? 2.2 : 1.0);
      this.posY -= feedRate * dt;

      // Rollers resist descent: the model sinks as bottom voxels are crushed
      const minAllowedPosY = (nipY - 0.22) - this.minActiveLy;
      if (this.posY < minAllowedPosY) {
        this.posY = minAllowedPosY;
      }
    }

    this.group.position.y = this.posY;
    this.group.rotation.set(0, 0, 0);
  }

  public getProgressPercent(): number {
    if (this.totalVoxels === 0) return 100;
    return Math.min(100, Math.floor(((this.totalVoxels - this.remainingVoxels) / this.totalVoxels) * 100));
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    if (this.instancedMesh) {
      this.instancedMesh.geometry.dispose();
      if (Array.isArray(this.instancedMesh.material)) {
        this.instancedMesh.material.forEach((m) => m.dispose());
      } else {
        this.instancedMesh.material.dispose();
      }
    }
  }
}
