import * as THREE from 'three';
import { DestructibleConfig } from '../types';

export const PROPS_CONFIGS: Record<string, DestructibleConfig> = {
  barrel: {
    id: 'barrel',
    name: 'Бочка с элем',
    mass: 5,
    radius: 0.55,
    hp: 20,
    biomassValue: 5,
    dnaValue: 3,
    color: 0x8d6e63,
    debrisCount: 8
  },
  crate: {
    id: 'crate',
    name: 'Ящик с припасами',
    mass: 7,
    radius: 0.65,
    hp: 30,
    biomassValue: 8,
    dnaValue: 5,
    color: 0xa16207,
    debrisCount: 10
  },
  fence: {
    id: 'fence',
    name: 'Деревянный забор',
    mass: 12,
    radius: 0.9,
    hp: 50,
    biomassValue: 12,
    dnaValue: 8,
    color: 0x78350f,
    debrisCount: 12
  },
  stall: {
    id: 'stall',
    name: 'Рыночная палатка',
    mass: 22,
    radius: 1.4,
    hp: 100,
    biomassValue: 25,
    dnaValue: 18,
    color: 0xb91c1c,
    debrisCount: 16
  }
};

export class DestructibleProp {
  public id: number;
  public config: DestructibleConfig;
  public group: THREE.Group = new THREE.Group();
  public position: THREE.Vector3 = new THREE.Vector3();
  public hp: number;
  public isDestroyed: boolean = false;

  constructor(id: number, propType: string, pos: THREE.Vector3) {
    this.id = id;
    this.config = PROPS_CONFIGS[propType] || PROPS_CONFIGS['barrel'];
    this.hp = this.config.hp;
    this.position.copy(pos);

    this.buildMesh(propType);
    this.group.position.copy(this.position);
  }

  private buildMesh(type: string): void {
    const woodMat = new THREE.MeshStandardMaterial({
      color: this.config.color,
      roughness: 0.8
    });
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.8,
      roughness: 0.3
    });

    if (type === 'barrel') {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 0.9, 10), woodMat);
      barrel.position.y = 0.45;
      barrel.castShadow = true;
      this.group.add(barrel);

      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 4, 10), ironMat);
      ring1.position.y = 0.65;
      ring1.rotation.x = Math.PI / 2;
      this.group.add(ring1);

      const ring2 = ring1.clone();
      ring2.position.y = 0.25;
      this.group.add(ring2);
    } else if (type === 'crate') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), woodMat);
      box.position.y = 0.45;
      box.castShadow = true;
      this.group.add(box);
    } else if (type === 'fence') {
      const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), woodMat);
      post1.position.set(-0.6, 0.45, 0);
      post1.castShadow = true;
      this.group.add(post1);

      const post2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), woodMat);
      post2.position.set(0.6, 0.45, 0);
      post2.castShadow = true;
      this.group.add(post2);

      const plank1 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.15, 0.06), woodMat);
      plank1.position.set(0, 0.65, 0);
      this.group.add(plank1);

      const plank2 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.15, 0.06), woodMat);
      plank2.position.set(0, 0.3, 0);
      this.group.add(plank2);
    } else {
      // Market Stall
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.2), woodMat);
      base.position.y = 0.4;
      base.castShadow = true;
      this.group.add(base);

      const clothMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 1.4), clothMat);
      canopy.position.y = 1.6;
      canopy.rotation.x = 0.15;
      this.group.add(canopy);
    }
  }

  public takeDamage(dmg: number): boolean {
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.isDestroyed = true;
      return true;
    }
    return false;
  }

  public dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}
