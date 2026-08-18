import * as THREE from 'three';
export const neon = (color: number): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color, toneMapped: false });
