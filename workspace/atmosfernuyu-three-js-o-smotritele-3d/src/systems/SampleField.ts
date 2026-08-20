import * as THREE from 'three';
import { math, COLORS } from '../config/GameConfig';

interface Sample {
  mesh: THREE.Mesh;
  active: boolean;
  phase: number;
}

/**
 * Sample field (Gameplay Systems Layer). Glowing collectibles the player gathers
 * for "gears" (meta currency) and favor. Pooled meshes, proximity-collected.
 */
export class SampleField {
  private readonly samples: Sample[] = [];
  private readonly collectRadius = 2.6;

  constructor(
    private readonly scene: THREE.Scene,
    capacity = 60,
  ) {
    const geo = new THREE.IcosahedronGeometry(0.5, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.sample,
      emissive: new THREE.Color(COLORS.sample).multiplyScalar(0.9),
      roughness: 0.3,
    });
    for (let i = 0; i < capacity; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.castShadow = false;
      scene.add(mesh);
      this.samples.push({ mesh, active: false, phase: Math.random() * Math.PI * 2 });
    }
  }

  spawn(pos: THREE.Vector3): void {
    const s = this.samples.find((x) => !x.active);
    if (!s) return;
    s.active = true;
    s.phase = Math.random() * Math.PI * 2;
    s.mesh.position.copy(pos);
    s.mesh.visible = true;
  }

  update(dt: number, playerPos: THREE.Vector3, onCollect: (pos: THREE.Vector3) => void): void {
    for (const s of this.samples) {
      if (!s.active) continue;
      s.phase += dt * 2;
      s.mesh.rotation.y += dt * 1.5;
      s.mesh.position.y += Math.sin(s.phase) * dt * 0.4;
      if (s.mesh.position.distanceTo(playerPos) < this.collectRadius) {
        const p = s.mesh.position.clone();
        s.active = false;
        s.mesh.visible = false;
        onCollect(p);
      }
    }
  }

  clear(): void {
    for (const s of this.samples) {
      s.active = false;
      s.mesh.visible = false;
    }
  }

  /** Spawn a ring of samples (used for wave-clear / favor bonus bursts). */
  burst(center: THREE.Vector3, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 3 + (i % 3);
      this.spawn(new THREE.Vector3(center.x + Math.cos(a) * r, center.y + math.randRange(-2, 2), center.z + Math.sin(a) * r));
    }
  }
}
