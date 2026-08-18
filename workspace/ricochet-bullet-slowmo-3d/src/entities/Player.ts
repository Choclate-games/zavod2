import * as THREE from 'three';
import type { InputSnapshot } from '../types';
export class Player { readonly position = new THREE.Vector3(0, 1.35, 4.4); update(input: InputSnapshot, dt: number): void { this.position.x += input.aimX * dt * .5; this.position.x = THREE.MathUtils.clamp(this.position.x, -3.5, 3.5); } }
