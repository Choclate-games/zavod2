// src/entities/Gate.ts
import * as THREE from 'three';
import { ProceduralModels } from '@/rendering/ProceduralModels';
import { eventBus } from '@/core/EventBus';
import { particleSystem } from '@/rendering/ParticleSystem';
import { sceneManager } from '@/rendering/SceneManager';

export class Gate {
  public mesh: THREE.Group;
  private leftDoor: THREE.Mesh;
  private rightDoor: THREE.Mesh;
  private beacon: THREE.Mesh;
  private padlock: THREE.Mesh;

  public isOpen: boolean = false;
  private openAnimProgress: number = 0;
  private isAnimatingOpen: boolean = false;

  constructor(x: number, z: number, rotationY: number = 0) {
    const gateRig = ProceduralModels.createFarmGate();
    this.mesh = gateRig.root;
    this.leftDoor = gateRig.leftDoor;
    this.rightDoor = gateRig.rightDoor;
    this.beacon = gateRig.beacon;
    this.padlock = gateRig.padlock;

    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = rotationY;
  }

  public getPosition(): { x: number; y: number; z: number } {
    return {
      x: this.mesh.position.x,
      y: this.mesh.position.y,
      z: this.mesh.position.z
    };
  }

  public unlockAndOpen(): void {
    if (this.isOpen || this.isAnimatingOpen) return;
    this.isAnimatingOpen = true;
    this.isOpen = true;
    this.openAnimProgress = 0;

    // Padlock drops off
    this.padlock.visible = false;
    this.beacon.visible = true;

    eventBus.emit('audio:playSfx', { name: 'gate_open', volume: 0.9 });
    sceneManager.triggerScreenShake(0.2, 0.5);
    particleSystem.spawnGrainSparkles(this.mesh.position.x, 1.0, this.mesh.position.z);

    eventBus.emit('gate:unlocked', {
      gatePosition: { x: this.mesh.position.x, z: this.mesh.position.z }
    });
  }

  public update(dt: number): void {
    if (this.isAnimatingOpen && this.openAnimProgress < 1.0) {
      this.openAnimProgress += dt * 1.5;
      const t = Math.min(1.0, this.openAnimProgress);
      const angle = (t * Math.PI) / 2.2; // Swing doors open outward

      this.leftDoor.rotation.y = -angle;
      this.rightDoor.rotation.y = angle;

      if (t >= 1.0) {
        this.isAnimatingOpen = false;
      }
    }

    // Beacon beam pulse
    if (this.isOpen && this.beacon.visible) {
      const mat = this.beacon.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.25 + Math.sin(performance.now() * 0.005) * 0.15;
    }
  }

  public checkPlayerExit(playerX: number, playerZ: number): boolean {
    if (!this.isOpen) return false;

    const dist = Math.hypot(this.mesh.position.x - playerX, this.mesh.position.z - playerZ);
    return dist < 1.4;
  }

  public reset(): void {
    this.isOpen = false;
    this.isAnimatingOpen = false;
    this.openAnimProgress = 0;
    this.leftDoor.rotation.y = 0;
    this.rightDoor.rotation.y = 0;
    this.padlock.visible = true;
    this.beacon.visible = false;
  }
}
