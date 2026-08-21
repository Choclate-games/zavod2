import * as THREE from 'three';
import { RollerBVH } from '../physics/RollerBVH';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class RollerMechanism {
  public group: THREE.Group;
  private leftRollerGroup: THREE.Group;
  private rightRollerGroup: THREE.Group;

  private leftCylinderMesh!: THREE.Mesh;
  private rightCylinderMesh!: THREE.Mesh;
  private leftTeethMesh!: THREE.InstancedMesh;
  private rightTeethMesh!: THREE.InstancedMesh;

  private standardMetalMaterial!: THREE.MeshStandardMaterial;
  private teethMaterial!: THREE.MeshStandardMaterial;
  private goldSkinMaterial!: THREE.MeshStandardMaterial;
  private goldTeethMaterial!: THREE.MeshStandardMaterial;

  private hasGoldSkin = false;
  private rollerRadius = 0.75;
  private baseWidth = 3.2;
  private currentWidthMultiplier = 1.0;
  private separation = 1.62; // Distance between roller center axes

  private rotationAngle = 0;
  private currentSpeedMultiplier = 1;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.leftRollerGroup = new THREE.Group();
    this.rightRollerGroup = new THREE.Group();

    this.group.add(this.leftRollerGroup);
    this.group.add(this.rightRollerGroup);

    this.leftRollerGroup.position.set(-this.separation / 2, 0, 0);
    this.rightRollerGroup.position.set(this.separation / 2, 0, 0);

    this.initMaterials();
    this.buildRollers();

    scene.add(this.group);
  }

  private initMaterials(): void {
    // Industrial steel body
    this.standardMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      metalness: 0.85,
      roughness: 0.35
    });

    // Hardened teeth material
    this.teethMaterial = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.9,
      roughness: 0.25
    });

    // Gold skin materials
    this.goldSkinMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.95,
      roughness: 0.2
    });

    this.goldTeethMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff07c,
      metalness: 0.95,
      roughness: 0.15
    });
  }

  private buildRollers(): void {
    // Roller Cylinders along Z axis
    const cylinderGeo = new THREE.CylinderGeometry(this.rollerRadius, this.rollerRadius, this.baseWidth, 24);
    // Orient cylinder along Z axis
    cylinderGeo.rotateX(Math.PI / 2);

    this.leftCylinderMesh = new THREE.Mesh(cylinderGeo, this.standardMetalMaterial);
    this.leftCylinderMesh.castShadow = true;
    this.leftCylinderMesh.receiveShadow = true;
    this.leftRollerGroup.add(this.leftCylinderMesh);

    this.rightCylinderMesh = new THREE.Mesh(cylinderGeo, this.standardMetalMaterial);
    this.rightCylinderMesh.castShadow = true;
    this.rightCylinderMesh.receiveShadow = true;
    this.rightRollerGroup.add(this.rightCylinderMesh);

    // Build Interlocking Sharp Teeth via InstancedMesh
    const toothGeo = new THREE.ConeGeometry(0.16, 0.36, 4);
    toothGeo.rotateZ(-Math.PI / 2); // Point outward radially

    const rings = 12;
    const teethPerRing = 10;
    const totalTeeth = rings * teethPerRing;

    this.leftTeethMesh = new THREE.InstancedMesh(toothGeo, this.teethMaterial, totalTeeth);
    this.rightTeethMesh = new THREE.InstancedMesh(toothGeo, this.teethMaterial, totalTeeth);

    this.leftTeethMesh.castShadow = true;
    this.rightTeethMesh.castShadow = true;

    const dummy = new THREE.Object3D();
    const ringSpacing = (this.baseWidth * 0.88) / rings;

    let index = 0;
    for (let r = 0; r < rings; r++) {
      const zPos = -this.baseWidth * 0.44 + r * ringSpacing + ringSpacing / 2;
      const angleOffset = (r % 2) * (Math.PI / teethPerRing);

      for (let t = 0; t < teethPerRing; t++) {
        const theta = (t / teethPerRing) * Math.PI * 2 + angleOffset;
        const xPos = Math.cos(theta) * this.rollerRadius;
        const yPos = Math.sin(theta) * this.rollerRadius;

        dummy.position.set(xPos, yPos, zPos);
        dummy.rotation.set(0, 0, theta);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        this.leftTeethMesh.setMatrixAt(index, dummy.matrix);
        this.rightTeethMesh.setMatrixAt(index, dummy.matrix);
        index++;
      }
    }

    this.leftTeethMesh.instanceMatrix.needsUpdate = true;
    this.rightTeethMesh.instanceMatrix.needsUpdate = true;

    this.leftRollerGroup.add(this.leftTeethMesh);
    this.rightRollerGroup.add(this.rightTeethMesh);
  }

  public setGoldSkin(enabled: boolean): void {
    this.hasGoldSkin = enabled;
    const bodyMat = enabled ? this.goldSkinMaterial : this.standardMetalMaterial;
    const toothMat = enabled ? this.goldTeethMaterial : this.teethMaterial;

    this.leftCylinderMesh.material = bodyMat;
    this.rightCylinderMesh.material = bodyMat;
    this.leftTeethMesh.material = toothMat;
    this.rightTeethMesh.material = toothMat;
  }

  public setWidthMultiplier(multiplier: number): void {
    this.currentWidthMultiplier = multiplier;
    // Scale on Z axis for width
    this.leftRollerGroup.scale.set(1, 1, multiplier);
    this.rightRollerGroup.scale.set(1, 1, multiplier);
  }

  public getWidthMultiplier(): number {
    return this.currentWidthMultiplier;
  }

  public getNipPointY(): number {
    return 0.0;
  }

  public getDamageMultiplier(): number {
    return this.currentSpeedMultiplier;
  }

  public getContactMinX(): number {
    return -1.55;
  }

  public getContactMaxX(): number {
    return 1.55;
  }

  public getContactMinZ(): number {
    return -(this.baseWidth * this.currentWidthMultiplier) / 2;
  }

  public getContactMaxZ(): number {
    return (this.baseWidth * this.currentWidthMultiplier) / 2;
  }

  public getContactBounds(): { minX: number; maxX: number; minZ: number; maxZ: number; nipY: number } {
    return {
      minX: this.getContactMinX(),
      maxX: this.getContactMaxX(),
      minZ: this.getContactMinZ(),
      maxZ: this.getContactMaxZ(),
      nipY: 0.0
    };
  }

  public update(dt: number, speedMultiplier: number): void {
    // Inward counter-rotation:
    // Left roller rotates clockwise (around +Z) to push downward at X = 0
    // Right roller rotates counter-clockwise (around -Z) to push downward at X = 0
    this.currentSpeedMultiplier = speedMultiplier;
    const deltaRot = 4.0 * speedMultiplier * dt;
    this.rotationAngle = (this.rotationAngle + deltaRot) % (Math.PI * 2);

    this.leftRollerGroup.rotation.z = -this.rotationAngle;
    this.rightRollerGroup.rotation.z = this.rotationAngle;

    this.leftRollerGroup.updateMatrixWorld(true);
    this.rightRollerGroup.updateMatrixWorld(true);

    // Synchronize BVH spatial matrices for teeth collision calculation
    RollerBVH.getInstance().updateMatrices(
      this.leftRollerGroup.matrixWorld,
      this.rightRollerGroup.matrixWorld
    );

    // Synchronize Rapier3D kinematic roller rotations
    PhysicsWorld.getInstance().updateRollersKinematics(
      -this.rotationAngle,
      this.rotationAngle
    );
  }
}
