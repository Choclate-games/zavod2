import * as THREE from 'three';
import { COLORS } from '../config/GameConfig';

/**
 * Material & shader helpers (Rendering Layer). Keeps draw calls and shader cost
 * down: MeshStandardMaterial with tuned roughness, shared instances, and an
 * additive spark material for hit feedback. All fragment work stays on `mediump`
 * where the driver allows.
 */
export const Shaders = {
  /** Dark, slightly emissive hull material for the player submersible. */
  createPlayerMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: COLORS.player,
      emissive: new THREE.Color(COLORS.player).multiplyScalar(0.18),
      roughness: 0.45,
      metalness: 0.55,
    });
  },

  /** Creature material — emissive so it reads against the dark. */
  createCreatureMaterial(colorHex: number = COLORS.enemy): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: new THREE.Color(colorHex).multiplyScalar(0.4),
      roughness: 0.8,
      metalness: 0.0,
    });
  },

  /** Glowing sample material (additive-ish via emissive). */
  createSampleMaterial(colorHex: number = COLORS.sample): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: new THREE.Color(colorHex).multiplyScalar(0.9),
      roughness: 0.3,
      metalness: 0.1,
    });
  },

  /** Additive spark/particle material (depth-write off to avoid sorting cost). */
  createSparkMaterial(colorHex: number = 0xffe066): THREE.PointsMaterial {
    return new THREE.PointsMaterial({
      color: colorHex,
      size: 0.35,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
  },

  /** Simple water volume material for the trench floor/walls. */
  createRockMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: 0x0a2233,
      roughness: 0.95,
      metalness: 0.0,
    });
  },
};
