import type * as THREE from 'three';
export type GameMode = 'menu' | 'aim' | 'flight' | 'won' | 'paused';
export interface Level { id: number; walls: Array<{ position: [number, number, number]; size: [number, number, number]; rotation?: number }>; targets: Array<{ position: [number, number, number]; kind: 'enemy' | 'barrel' }>; portals: Array<{ position: [number, number, number]; color: 'blue' | 'orange' }>; }
export interface AimSegment { from: THREE.Vector3; to: THREE.Vector3; normal?: THREE.Vector3; target?: 'enemy' | 'barrel'; }
export interface InputSnapshot { aimX: number; aimY: number; fire: boolean; boost: boolean; pause: boolean; }
export interface SaveData { version: number; unlockedLevel: number; stars: number[]; muted: boolean; }
