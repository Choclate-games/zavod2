// src/rendering/VisionConeMesh.ts
import * as THREE from 'three';
import { physicsWorld } from '@/physics/PhysicsWorld';

export type VisionState = 'patrol' | 'suspicious' | 'alert';

export class VisionConeMesh {
  public mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.MeshBasicMaterial;

  private readonly maxSegments: number = 32;
  private positions: Float32Array;
  private colors: Float32Array;
  private indices: Uint16Array;

  private fovRad: number = (65 * Math.PI) / 180;
  private viewDistance: number = 6.5;

  private currentColor: THREE.Color = new THREE.Color(0x2ecc71);
  private targetColor: THREE.Color = new THREE.Color(0x2ecc71);

  constructor(fovDeg: number = 65, viewDistance: number = 6.5) {
    this.fovRad = (fovDeg * Math.PI) / 180;
    this.viewDistance = viewDistance;

    // Triangle fan structure: 1 center vertex + (maxSegments + 1) perimeter vertices
    const maxVerts = this.maxSegments + 2;
    this.positions = new Float32Array(maxVerts * 3);
    this.colors = new Float32Array(maxVerts * 4); // RGBA vertex colors

    // Indices for triangles (center, i, i+1)
    this.indices = new Uint16Array(this.maxSegments * 3);
    for (let i = 0; i < this.maxSegments; i++) {
      this.indices[i * 3] = 0;
      this.indices[i * 3 + 1] = i + 1;
      this.indices[i * 3 + 2] = i + 2;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
    this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));

    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.renderOrder = 2; // Render above ground
    this.mesh.frustumCulled = false;
  }

  public setVisionState(state: VisionState): void {
    if (state === 'patrol') {
      this.targetColor.setHex(0x2ecc71); // Soft glowing emerald green
    } else if (state === 'suspicious') {
      this.targetColor.setHex(0xf39c12); // Amber warning yellow
    } else if (state === 'alert') {
      this.targetColor.setHex(0xe74c3c); // Intense alert red
    }
  }

  public update(
    originX: number,
    originY: number,
    originZ: number,
    facingAngle: number,
    numSegments: number = 20
  ): void {
    const clampedSegments = Math.min(this.maxSegments, Math.max(8, numSegments));

    // Smoothly lerp color
    this.currentColor.lerp(this.targetColor, 0.15);

    // Center vertex (local coordinates 0,0,0 relative to dog or mesh at height 0.08)
    this.positions[0] = 0;
    this.positions[1] = 0.08;
    this.positions[2] = 0;

    // Center color: slightly more opaque
    this.colors[0] = this.currentColor.r;
    this.colors[1] = this.currentColor.g;
    this.colors[2] = this.currentColor.b;
    this.colors[3] = 0.7;

    const startAngle = facingAngle - this.fovRad / 2;
    const angleStep = this.fovRad / clampedSegments;

    for (let i = 0; i <= clampedSegments; i++) {
      const angle = startAngle + i * angleStep;
      const dirX = Math.sin(angle);
      const dirZ = Math.cos(angle);

      // Raycast against static walls/fences to clip cone
      const rayRes = physicsWorld.castRay(
        originX,
        originY + 0.3,
        originZ,
        dirX,
        0,
        dirZ,
        this.viewDistance
      );

      const hitDist = rayRes.hit ? rayRes.distance : this.viewDistance;
      const localX = dirX * hitDist;
      const localZ = dirZ * hitDist;

      const idx = (i + 1) * 3;
      this.positions[idx] = localX;
      this.positions[idx + 1] = 0.08;
      this.positions[idx + 2] = localZ;

      const cIdx = (i + 1) * 4;
      this.colors[cIdx] = this.currentColor.r;
      this.colors[cIdx + 1] = this.currentColor.g;
      this.colors[cIdx + 2] = this.currentColor.b;
      // Edge color fades to transparent
      this.colors[cIdx + 3] = 0.1;
    }

    // Set draw range for geometry based on current segments
    this.geometry.setDrawRange(0, clampedSegments * 3);

    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    posAttr.needsUpdate = true;

    const colAttr = this.geometry.attributes.color as THREE.BufferAttribute;
    colAttr.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
