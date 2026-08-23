/**
 * TunnelVisuals: Simulates rapid movement through the subway tunnel outside windows.
 * Renders moving tunnel lights, cable conduits, and warning semaphores.
 */

import * as THREE from 'three';

export class TunnelVisuals {
  private container: THREE.Group;
  private tunnelElements: THREE.Mesh[] = [];
  private semaphores: THREE.PointLight[] = [];

  constructor() {
    this.container = new THREE.Group();
    this.container.name = 'tunnel_visuals';
    this.buildTunnelEnvironment();
  }

  public getContainer(): THREE.Group {
    return this.container;
  }

  private buildTunnelEnvironment(): void {
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xFFF0AA });
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x222222 });

    // Moving tunnel lamp fixtures on both sides
    for (let i = 0; i < 12; i++) {
      const z = (i - 6) * 4.0;

      // Left light
      const lampGeo = new THREE.BoxGeometry(0.1, 0.1, 0.4);
      const lampLeft = new THREE.Mesh(lampGeo, lightMat);
      lampLeft.position.set(-1.8, 1.8, z);
      this.container.add(lampLeft);
      this.tunnelElements.push(lampLeft);

      // Right light
      const lampRight = new THREE.Mesh(lampGeo, lightMat);
      lampRight.position.set(1.8, 1.8, z + 2.0);
      this.container.add(lampRight);
      this.tunnelElements.push(lampRight);
    }

    // Tunnel cables
    const cableGeo = new THREE.CylinderGeometry(0.02, 0.02, 30, 6);
    const cableLeft = new THREE.Mesh(cableGeo, cableMat);
    cableLeft.rotation.x = Math.PI / 2;
    cableLeft.position.set(-1.85, 1.6, 0);
    this.container.add(cableLeft);

    const cableRight = new THREE.Mesh(cableGeo, cableMat);
    cableRight.rotation.x = Math.PI / 2;
    cableRight.position.set(1.85, 1.6, 0);
    this.container.add(cableRight);

    // Neon signal semaphores
    const leftSemLight = new THREE.PointLight(0x34C759, 1.5, 6.0);
    leftSemLight.position.set(-2.0, 1.2, -4.0);
    this.container.add(leftSemLight);
    this.semaphores.push(leftSemLight);

    const rightSemLight = new THREE.PointLight(0xFF3B30, 1.5, 6.0);
    rightSemLight.position.set(2.0, 1.2, -4.0);
    this.container.add(rightSemLight);
    this.semaphores.push(rightSemLight);
  }

  public update(dt: number, speedMps: number, isCurving: boolean, curveDirection: number): void {
    const travelStep = speedMps * dt * 2.0;

    // Scroll tunnel light fixtures backwards
    for (const elem of this.tunnelElements) {
      elem.position.z += travelStep;
      if (elem.position.z > 14.0) {
        elem.position.z -= 36.0;
      }
    }

    // Update semaphore lights based on curve warnings
    if (isCurving) {
      if (curveDirection > 0) {
        this.semaphores[0].color.setHex(0xFF3B30); // Red left
        this.semaphores[1].color.setHex(0x00F0FF); // Blue/Cyan right
      } else {
        this.semaphores[0].color.setHex(0x00F0FF); // Blue/Cyan left
        this.semaphores[1].color.setHex(0xFF3B30); // Red right
      }
    } else {
      this.semaphores[0].color.setHex(0x34C759); // Green
      this.semaphores[1].color.setHex(0x34C759); // Green
    }
  }
}
