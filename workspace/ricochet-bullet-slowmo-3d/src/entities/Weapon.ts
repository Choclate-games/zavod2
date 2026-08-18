import * as THREE from 'three';
export class Weapon { readonly muzzle = new THREE.Vector3(0, 1.35, 4.4); readonly direction = new THREE.Vector3(0, 0, -1); setAim(x: number, y: number): void { this.direction.set(x * .8, y * .55, -1).normalize(); } }
