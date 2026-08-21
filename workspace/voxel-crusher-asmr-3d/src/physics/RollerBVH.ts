import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface CollisionResult {
  collided: boolean;
  rollerSide: 'left' | 'right' | 'none';
  impactVelocityX: number;
  impactVelocityY: number;
  impactVelocityZ: number;
  depth: number;
}

export class RollerBVH {
  private static instance: RollerBVH | null = null;

  public teethGeometry!: THREE.BufferGeometry;
  public bvhTree!: MeshBVH;

  private rollerRadius = 0.75;
  private baseWidth = 3.2;
  private rings = 12;
  private teethPerRing = 10;

  // Reusable matrices and vectors to avoid per-frame allocations
  private invLeftMatrix = new THREE.Matrix4();
  private invRightMatrix = new THREE.Matrix4();
  private localBox = new THREE.Box3();
  private tempVec = new THREE.Vector3();

  public static getInstance(): RollerBVH {
    if (!RollerBVH.instance) {
      RollerBVH.instance = new RollerBVH();
    }
    return RollerBVH.instance;
  }

  constructor() {
    this.buildBVHTree();
  }

  private buildBVHTree(): void {
    const singleToothGeo = new THREE.ConeGeometry(0.16, 0.36, 4);
    singleToothGeo.rotateZ(-Math.PI / 2); // Point outward radially

    const geometries: THREE.BufferGeometry[] = [];
    const ringSpacing = (this.baseWidth * 0.88) / this.rings;

    for (let r = 0; r < this.rings; r++) {
      const zPos = -this.baseWidth * 0.44 + r * ringSpacing + ringSpacing / 2;
      const angleOffset = (r % 2) * (Math.PI / this.teethPerRing);

      for (let t = 0; t < this.teethPerRing; t++) {
        const theta = (t / this.teethPerRing) * Math.PI * 2 + angleOffset;
        const xPos = Math.cos(theta) * this.rollerRadius;
        const yPos = Math.sin(theta) * this.rollerRadius;

        const toothInstance = singleToothGeo.clone();
        toothInstance.rotateZ(theta);
        toothInstance.translate(xPos, yPos, zPos);
        geometries.push(toothInstance);
      }
    }

    // Merge all individual teeth into a single geometry for BVH tree construction
    const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
    singleToothGeo.dispose();
    geometries.forEach((g) => g.dispose());

    if (!merged) {
      throw new Error('[RollerBVH] Failed to merge teeth geometries.');
    }

    this.teethGeometry = merged;
    this.bvhTree = new MeshBVH(this.teethGeometry, {
      strategy: 0, // CENTER split strategy
      maxDepth: 16
    });

    console.log('[RollerBVH] three-mesh-bvh tree constructed for 120 teeth.');
  }

  public updateMatrices(leftMatrixWorld: THREE.Matrix4, rightMatrixWorld: THREE.Matrix4): void {
    this.invLeftMatrix.copy(leftMatrixWorld).invert();
    this.invRightMatrix.copy(rightMatrixWorld).invert();
  }

  /**
   * Fast geometric check if a world-space voxel box intersects left or right roller teeth
   */
  public testVoxelCollision(
    voxelBox: THREE.Box3,
    rollerSpeed: number,
    isTurbo: boolean,
    result: CollisionResult
  ): boolean {
    result.collided = false;
    result.rollerSide = 'none';

    // 1. Test against Left Roller Teeth
    const hitsLeft = this.bvhTree.intersectsBox(voxelBox, this.invLeftMatrix);
    if (hitsLeft) {
      result.collided = true;
      result.rollerSide = 'left';
      this.calculateImpactVelocity(voxelBox, 'left', rollerSpeed, isTurbo, result);
      return true;
    }

    // 2. Test against Right Roller Teeth
    const hitsRight = this.bvhTree.intersectsBox(voxelBox, this.invRightMatrix);
    if (hitsRight) {
      result.collided = true;
      result.rollerSide = 'right';
      this.calculateImpactVelocity(voxelBox, 'right', rollerSpeed, isTurbo, result);
      return true;
    }

    return false;
  }

  private calculateImpactVelocity(
    voxelBox: THREE.Box3,
    side: 'left' | 'right',
    rollerSpeed: number,
    isTurbo: boolean,
    result: CollisionResult
  ): void {
    const turboMult = isTurbo ? 1.6 : 1.0;
    const speed = Math.max(1.0, rollerSpeed) * turboMult;

    // Center of voxel
    voxelBox.getCenter(this.tempVec);

    // Downward drag from counter-rotating teeth
    result.impactVelocityY = (-2.8 - Math.random() * 3.2) * speed;

    if (side === 'left') {
      // Left roller rotates clockwise (pushes particles down & rightward towards center)
      result.impactVelocityX = (1.0 + Math.random() * 1.5) * speed;
    } else {
      // Right roller rotates counter-clockwise (pushes particles down & leftward towards center)
      result.impactVelocityX = (-1.0 - Math.random() * 1.5) * speed;
    }

    result.impactVelocityZ = (Math.random() * 1.6 - 0.8) * speed;
    result.depth = 0.1;
  }

  public dispose(): void {
    if (this.teethGeometry) {
      this.teethGeometry.dispose();
    }
  }
}
