import * as THREE from 'three';

export class InstancedMeshPool {
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly quaternion = new THREE.Quaternion();

  constructor(readonly mesh: THREE.InstancedMesh, readonly capacity: number) {
    for (let i = 0; i < capacity; i += 1) this.mesh.setMatrixAt(i, this.hiddenMatrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  set(index: number, x: number, y: number, z: number, scale: number): void {
    this.position.set(x, y, z);
    this.scale.setScalar(scale);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.mesh.setMatrixAt(index, this.matrix);
  }

  hide(index: number): void {
    this.mesh.setMatrixAt(index, this.hiddenMatrix);
  }

  flush(): void {
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
