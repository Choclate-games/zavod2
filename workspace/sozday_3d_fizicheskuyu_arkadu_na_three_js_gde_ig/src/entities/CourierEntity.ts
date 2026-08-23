/**
 * CourierEntity: Courier 3D character representation in Three.js.
 * Handles procedural posture animations: swaying feet, crouching, forward/backward leaning, and emergency grip arm reach.
 */

import * as THREE from 'three';
import { ProceduralModels } from '../rendering/ProceduralModels';

export class CourierEntity {
  private group: THREE.Group;
  private hips: THREE.Group | null = null;
  private leftLeg: THREE.Mesh | null = null;
  private rightLeg: THREE.Mesh | null = null;
  private leftArm: THREE.Mesh | null = null;
  private rightArm: THREE.Mesh | null = null;

  constructor() {
    this.group = ProceduralModels.createCourier();
    this.hips = this.group.getObjectByName('hips') as THREE.Group;
    this.leftLeg = this.group.getObjectByName('left_leg') as THREE.Mesh;
    this.rightLeg = this.group.getObjectByName('right_leg') as THREE.Mesh;
    this.leftArm = this.group.getObjectByName('left_arm') as THREE.Mesh;
    this.rightArm = this.group.getObjectByName('right_arm') as THREE.Mesh;
  }

  public getMesh(): THREE.Group {
    return this.group;
  }

  public update(baseX: number, crouchOffset: number, pitchAngleRad: number, isGripActive: boolean, isMenuIdle: boolean): void {
    if (isMenuIdle) {
      // Sitting / resting on bench animation
      this.group.position.set(0.75, 0.2, -1.0);
      this.group.rotation.set(0, -Math.PI / 2, 0);
      if (this.hips) {
        this.hips.position.y = 0.35 + Math.sin(Date.now() * 0.002) * 0.02;
        this.hips.rotation.x = 0;
      }
      return;
    }

    // Active gameplay standing posture
    this.group.position.set(baseX, 0, 0);
    this.group.rotation.set(0, 0, 0);

    if (this.hips) {
      this.hips.position.y = 0.55 - crouchOffset;
      this.hips.rotation.x = pitchAngleRad; // Lean forward/back

      // Step sway animation on legs
      const swaySpeed = Math.abs(baseX) * 8.0;
      if (this.leftLeg && this.rightLeg) {
        this.leftLeg.rotation.x = Math.sin(Date.now() * 0.01 + swaySpeed) * 0.3;
        this.rightLeg.rotation.x = -Math.sin(Date.now() * 0.01 + swaySpeed) * 0.3;
      }

      // Emergency grip reach to ceiling handrail
      if (this.rightArm) {
        if (isGripActive) {
          this.rightArm.rotation.set(-Math.PI * 0.8, 0, -0.2);
        } else {
          this.rightArm.rotation.set(Math.PI / 4, 0, 0);
        }
      }
      if (this.leftArm) {
        this.leftArm.rotation.set(Math.PI / 4, 0, 0);
      }
    }
  }
}
