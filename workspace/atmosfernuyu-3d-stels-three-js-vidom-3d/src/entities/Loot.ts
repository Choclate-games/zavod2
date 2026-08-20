import * as THREE from 'three';
import { eventBus } from '../core/EventBus';
import { audioManager } from '../audio/AudioManager';

export enum LootType {
  GEAR = 'gear',
  SCROLL = 'scroll',
  EXP_ORB = 'orb',
  HEAL = 'heal',
}

export interface LootItem {
  mesh: THREE.Mesh;
  type: LootType;
  value: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  isActive: boolean;
  bobOffset: number;
}

export class LootManager {
  private items: LootItem[] = [];
  private readonly maxItems = 60;

  private gearGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.12, 8);
  private gearMat = new THREE.MeshStandardMaterial({ color: '#ffd54f', metalness: 0.8, roughness: 0.2 });

  private scrollGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.6, 8);
  private scrollMat = new THREE.MeshStandardMaterial({ color: '#ffe082', roughness: 0.6 });

  private orbGeo = new THREE.SphereGeometry(0.25, 8, 8);
  private orbMat = new THREE.MeshBasicMaterial({ color: '#29b6f6' });

  private healGeo = new THREE.OctahedronGeometry(0.3);
  private healMat = new THREE.MeshStandardMaterial({ color: '#66bb6a', emissive: '#43a047', emissiveIntensity: 0.6 });

  constructor(private scene: THREE.Scene) {
    for (let i = 0; i < this.maxItems; i++) {
      const mesh = new THREE.Mesh(this.gearGeo, this.gearMat);
      mesh.visible = false;
      this.scene.add(mesh);

      this.items.push({
        mesh,
        type: LootType.GEAR,
        value: 1,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        isActive: false,
        bobOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  spawnLoot(pos: THREE.Vector3, type: LootType, value = 1): void {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (!item.isActive) {
        item.isActive = true;
        item.type = type;
        item.value = value;
        item.position.copy(pos);
        item.position.y = 0.5;
        item.velocity.set(
          (Math.random() - 0.5) * 5,
          Math.random() * 4 + 2,
          (Math.random() - 0.5) * 5
        );

        // Update visual mesh
        switch (type) {
          case LootType.GEAR:
            item.mesh.geometry = this.gearGeo;
            item.mesh.material = this.gearMat;
            break;
          case LootType.SCROLL:
            item.mesh.geometry = this.scrollGeo;
            item.mesh.material = this.scrollMat;
            break;
          case LootType.EXP_ORB:
            item.mesh.geometry = this.orbGeo;
            item.mesh.material = this.orbMat;
            break;
          case LootType.HEAL:
            item.mesh.geometry = this.healGeo;
            item.mesh.material = this.healMat;
            break;
        }

        item.mesh.position.copy(item.position);
        item.mesh.visible = true;
        break;
      }
    }
  }

  update(dt: number, playerPos: THREE.Vector3, magnetRadius: number): void {
    const time = performance.now() * 0.003;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (!item.isActive) continue;

      // Initial jump arc
      if (item.velocity.lengthSq() > 0.01) {
        item.velocity.y -= 15 * dt;
        item.position.addScaledVector(item.velocity, dt);
        if (item.position.y <= 0.4) {
          item.position.y = 0.4;
          item.velocity.set(0, 0, 0);
        }
      }

      // Magnetic pull to player
      const dist = item.position.distanceTo(playerPos);
      if (dist <= magnetRadius) {
        const pullDir = new THREE.Vector3().subVectors(playerPos, item.position).normalize();
        const pullSpeed = 16 * (1 - dist / magnetRadius) + 8;
        item.position.addScaledVector(pullDir, pullSpeed * dt);

        // Collect radius
        if (dist <= 0.9) {
          this.collectItem(item);
          continue;
        }
      }

      // Hover bob & spin
      item.mesh.position.copy(item.position);
      item.mesh.position.y = item.position.y + Math.sin(time + item.bobOffset) * 0.15;
      item.mesh.rotation.y += dt * 3;
    }
  }

  private collectItem(item: LootItem): void {
    item.isActive = false;
    item.mesh.visible = false;

    audioManager.playLootPickup();
    eventBus.emit('player:loot_collected', {
      type: item.type,
      amount: item.value,
    });
  }

  clearAll(): void {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      item.isActive = false;
      item.mesh.visible = false;
    }
  }
}
