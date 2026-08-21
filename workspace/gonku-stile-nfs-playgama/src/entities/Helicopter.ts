import * as THREE from 'three';
import { ProceduralModels } from '../rendering/ProceduralModels';

export class Helicopter {
  readonly root: THREE.Group;
  private mainRotor: THREE.Mesh;
  private tailRotor: THREE.Mesh;
  private spotlight: THREE.SpotLight;

  readonly position = new THREE.Vector3();
  active = false;
  private hoverOffset = new THREE.Vector3(0, 18, -6);

  constructor(scene: THREE.Scene) {
    const data = ProceduralModels.createHelicopter();
    this.root = data.root;
    this.mainRotor = data.mainRotor;
    this.tailRotor = data.tailRotor;
    this.spotlight = data.spotlight;

    this.root.visible = false;
    scene.add(this.root);
  }

  spawn(playerPos: THREE.Vector3): void {
    this.active = true;
    this.root.visible = true;
    this.position.copy(playerPos).add(this.hoverOffset);
    this.root.position.copy(this.position);
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (!this.active) return;

    // Spin Rotors
    this.mainRotor.rotation.y += 28.0 * dt;
    this.tailRotor.rotation.x += 35.0 * dt;

    // Smooth Chase & Hover above player
    const targetPos = playerPos.clone().add(this.hoverOffset);
    this.position.lerp(targetPos, 2.5 * dt);
    this.root.position.copy(this.position);

    // Look at player with banking tilt
    this.root.lookAt(playerPos.x, this.position.y - 4, playerPos.z);

    // Aim searchlight directly at player
    this.spotlight.target.position.copy(playerPos);
  }

  hide(): void {
    this.active = false;
    this.root.visible = false;
  }
}
