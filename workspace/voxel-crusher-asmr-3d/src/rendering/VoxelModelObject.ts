import * as THREE from 'three';
import { VoxelCoord, VoxelModelData } from '../core/Types';

export interface DetachedVoxel {
  worldX: number;
  worldY: number;
  worldZ: number;
  color: number;
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
  private sortedIndices: Uint32Array; // Sorted by local Y ascending for fast slicing

  public posY = 3.8;
  public targetY = 3.8;
  public wobbleAngle = 0;

  constructor(scene: THREE.Scene, modelData: VoxelModelData) {
    this.group = new THREE.Group();
    this.modelData = modelData;
    this.totalVoxels = modelData.voxels.length;
    this.remainingVoxels = this.totalVoxels;

    const count = this.totalVoxels;
    this.voxelPositions = new Float32Array(count * 3);
    this.voxelColors = new Uint32Array(count);
    this.voxelActive = new Uint8Array(count);
    this.sortedIndices = new Uint32Array(count);

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
      this.sortedIndices[i] = i;

      this.dummy.position.set(lx, ly, lz);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);

      colorHelper.setHex(v.color);
      this.instancedMesh.setColorAt(i, colorHelper);
    }

    // Sort indices by local Y ascending so we slice from the bottom up!
    this.sortedIndices.sort((a, b) => {
      return this.voxelPositions[a * 3 + 1] - this.voxelPositions[b * 3 + 1];
    });

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }

    this.group.add(this.instancedMesh);
  }

  /**
   * Slice voxels that have passed through or reached the contact plane (nipThresholdY)
   */
  public sliceVoxels(nipThresholdY: number, maxSliceCount: number): DetachedVoxel[] {
    const detached: DetachedVoxel[] = [];
    if (this.remainingVoxels <= 0) return detached;

    let matrixNeedsUpdate = false;

    for (let i = 0; i < this.totalVoxels; i++) {
      if (detached.length >= maxSliceCount) break;

      const idx = this.sortedIndices[i];
      if (this.voxelActive[idx] === 0) continue;

      const lx = this.voxelPositions[idx * 3];
      const ly = this.voxelPositions[idx * 3 + 1];
      const lz = this.voxelPositions[idx * 3 + 2];

      // Compute world position accounting for group position and wobble
      const worldY = this.group.position.y + ly;

      if (worldY <= nipThresholdY) {
        // Detach voxel!
        this.voxelActive[idx] = 0;
        this.remainingVoxels--;

        // Calculate world coordinates
        const worldPos = new THREE.Vector3(lx, ly, lz);
        this.group.localToWorld(worldPos);

        detached.push({
          worldX: worldPos.x,
          worldY: worldPos.y,
          worldZ: worldPos.z,
          color: this.voxelColors[idx]
        });

        // Hide detached instance in mesh
        this.instancedMesh.setMatrixAt(idx, this.zeroMatrix);
        matrixNeedsUpdate = true;
      }
    }

    if (matrixNeedsUpdate) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    return detached;
  }

  public updateDescent(feedSpeed: number, dt: number, isTurbo: boolean): void {
    // Descent rate towards rollers
    const speed = feedSpeed * (isTurbo ? 2.5 : 1.0);
    this.posY = Math.max(-1.5, this.posY - speed * dt);
    this.group.position.y = this.posY;

    // Gentle physical wobble while being crushed
    if (isTurbo) {
      this.wobbleAngle += dt * 15.0;
      this.group.rotation.z = Math.sin(this.wobbleAngle) * 0.035;
      this.group.rotation.x = Math.cos(this.wobbleAngle * 0.7) * 0.025;
    } else {
      this.wobbleAngle += dt * 5.0;
      this.group.rotation.z = Math.sin(this.wobbleAngle) * 0.015;
      this.group.rotation.x = 0;
    }
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
