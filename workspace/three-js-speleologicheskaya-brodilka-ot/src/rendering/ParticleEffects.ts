import * as THREE from "three";
import { MathUtils } from "../utils/MathUtils";

export interface SonicRing {
  mesh: THREE.Mesh;
  maxRadius: number;
  currentRadius: number;
  speed: number;
  maxLife: number;
  life: number;
  color: THREE.Color;
}

export interface SparkParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
  size: number;
}

export class ParticleEffects {
  private scene: THREE.Scene;
  private rings: SonicRing[] = [];
  private ringGeometry: THREE.RingGeometry;
  
  // Sparks
  private sparks: SparkParticle[] = [];
  private sparkMesh: THREE.Points;
  private sparkGeo: THREE.BufferGeometry;
  private sparkPositions: Float32Array;
  private sparkColors: Float32Array;
  private maxSparks: number = 1000;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.ringGeometry = new THREE.RingGeometry(0.92, 1.0, 32);
    this.ringGeometry.rotateX(-Math.PI / 2);

    // Setup spark points
    this.sparkPositions = new Float32Array(this.maxSparks * 3);
    this.sparkColors = new Float32Array(this.maxSparks * 3);
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkGeo.setAttribute("position", new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparkGeo.setAttribute("color", new THREE.BufferAttribute(this.sparkColors, 3));

    const sparkMat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    this.sparkMesh = new THREE.Points(this.sparkGeo, sparkMat);
    this.sparkMesh.frustumCulled = false;
    this.scene.add(this.sparkMesh);
  }

  public emitSonicRing(
    origin: THREE.Vector3,
    maxRadius: number = 35.0,
    speed: number = 28.0,
    colorHex: number = 0x00f0ff
  ): void {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Mesh(this.ringGeometry, mat);
    mesh.position.copy(origin);
    mesh.position.y += 0.2; // Slightly above ground
    mesh.scale.set(0.1, 0.1, 0.1);
    this.scene.add(mesh);

    this.rings.push({
      mesh,
      maxRadius,
      currentRadius: 0.1,
      speed,
      maxLife: maxRadius / speed,
      life: 0,
      color: new THREE.Color(colorHex)
    });
  }

  public emitCrystalSparks(origin: THREE.Vector3, colorHex: number = 0xbf55ec, count: number = 30): void {
    const col = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= this.maxSparks) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = MathUtils.randomRange(2.0, 7.0);
      const vy = MathUtils.randomRange(1.5, 6.0);

      this.sparks.push({
        position: origin.clone().add(new THREE.Vector3(0, 0.5, 0)),
        velocity: new THREE.Vector3(Math.cos(angle) * speed, vy, Math.sin(angle) * speed),
        life: 0,
        maxLife: MathUtils.randomRange(0.4, 0.9),
        color: col,
        size: 0.3
      });
    }
  }

  public emitStunShockwave(origin: THREE.Vector3): void {
    this.emitSonicRing(origin, 12.0, 20.0, 0xffd700);
    this.emitCrystalSparks(origin, 0xffd700, 40);
  }

  public update(dt: number): void {
    // 1. Update rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.life += dt;
      ring.currentRadius += ring.speed * dt;

      ring.mesh.scale.set(ring.currentRadius, ring.currentRadius, ring.currentRadius);
      const progress = ring.life / ring.maxLife;
      const alpha = MathUtils.clamp(1.0 - progress * progress, 0, 1);

      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = alpha * 0.75;

      if (ring.life >= ring.maxLife || ring.currentRadius >= ring.maxRadius) {
        this.scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        (ring.mesh.material as THREE.Material).dispose();
        this.rings.splice(i, 1);
      }
    }

    // 2. Update sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.life += dt;

      sp.position.addScaledVector(sp.velocity, dt);
      sp.velocity.y -= 12.0 * dt; // gravity
      sp.velocity.x *= 0.96;
      sp.velocity.z *= 0.96;

      if (sp.life >= sp.maxLife) {
        this.sparks.splice(i, 1);
      }
    }

    // Write to buffer
    for (let i = 0; i < this.maxSparks; i++) {
      const p3 = i * 3;
      if (i < this.sparks.length) {
        const sp = this.sparks[i];
        this.sparkPositions[p3] = sp.position.x;
        this.sparkPositions[p3 + 1] = sp.position.y;
        this.sparkPositions[p3 + 2] = sp.position.z;

        const fade = 1 - (sp.life / sp.maxLife);
        this.sparkColors[p3] = sp.color.r * fade;
        this.sparkColors[p3 + 1] = sp.color.g * fade;
        this.sparkColors[p3 + 2] = sp.color.b * fade;
      } else {
        this.sparkPositions[p3] = 0;
        this.sparkPositions[p3 + 1] = -1000;
        this.sparkPositions[p3 + 2] = 0;
      }
    }

    (this.sparkGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.sparkGeo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  }

  public clear(): void {
    for (let i = 0; i < this.rings.length; i++) {
      this.scene.remove(this.rings[i].mesh);
      (this.rings[i].mesh.material as THREE.Material).dispose();
    }
    this.rings = [];
    this.sparks = [];
  }
}
