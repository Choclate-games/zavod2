import * as THREE from "three";
import { MathUtils } from "../utils/MathUtils";

export interface PointCloudSample {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  size?: number;
  lifetime?: number;
}

export class PointCloudRenderer {
  private maxPoints: number;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  public pointsMesh: THREE.Points;

  // CPU Buffers
  private positions: Float32Array;
  private colors: Float32Array;
  private alphas: Float32Array;
  private sizes: Float32Array;
  private ages: Float32Array;
  private lifetimes: Float32Array;

  private headIndex: number = 0;
  private activeCount: number = 0;

  constructor(maxPoints: number = 65000) {
    this.maxPoints = maxPoints;

    this.positions = new Float32Array(maxPoints * 3);
    this.colors = new Float32Array(maxPoints * 3);
    this.alphas = new Float32Array(maxPoints);
    this.sizes = new Float32Array(maxPoints);
    this.ages = new Float32Array(maxPoints);
    this.lifetimes = new Float32Array(maxPoints);

    // Initialize with 0 alpha
    for (let i = 0; i < maxPoints; i++) {
      this.alphas[i] = 0.0;
      this.lifetimes[i] = 6.0;
      this.ages[i] = 999.0;
      this.sizes[i] = 2.5;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("customColor", new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute("alpha", new THREE.BufferAttribute(this.alphas, 1));
    this.geometry.setAttribute("size", new THREE.BufferAttribute(this.sizes, 1));

    // Custom High-Performance Shader for PointCloud
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        pointTexture: { value: this.createPointTexture() }
      },
      vertexShader: `
        attribute float alpha;
        attribute float size;
        attribute vec3 customColor;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = customColor;
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (220.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D pointTexture;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          if (vAlpha <= 0.01) discard;
          vec4 texColor = texture2D(pointTexture, gl_PointCoord);
          gl_FragColor = vec4(vColor, vAlpha * texColor.a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.pointsMesh = new THREE.Points(this.geometry, this.material);
    this.pointsMesh.frustumCulled = false;
  }

  private createPointTexture(): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d")!;

    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.3, "rgba(255,255,255,0.85)");
    gradient.addColorStop(0.7, "rgba(255,255,255,0.3)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    return texture;
  }

  public setMaxPoints(newLimit: number): void {
    // If increased by meta-upgrade
    this.maxPoints = Math.min(newLimit, this.positions.length / 3);
  }

  public addSample(sample: PointCloudSample): void {
    const idx = this.headIndex;
    const p3 = idx * 3;

    this.positions[p3] = sample.x;
    this.positions[p3 + 1] = sample.y;
    this.positions[p3 + 2] = sample.z;

    this.colors[p3] = sample.r;
    this.colors[p3 + 1] = sample.g;
    this.colors[p3 + 2] = sample.b;

    this.sizes[idx] = sample.size ?? 2.8;
    this.lifetimes[idx] = sample.lifetime ?? 6.0;
    this.ages[idx] = 0.0;
    this.alphas[idx] = 1.0;

    this.headIndex = (this.headIndex + 1) % this.maxPoints;
    if (this.activeCount < this.maxPoints) {
      this.activeCount++;
    }
  }

  public addBatch(samples: PointCloudSample[]): void {
    for (let i = 0; i < samples.length; i++) {
      this.addSample(samples[i]);
    }
  }

  public update(dt: number): void {
    let needsPosUpdate = false;
    let needsAlphaUpdate = false;

    for (let i = 0; i < this.maxPoints; i++) {
      if (this.alphas[i] > 0.0) {
        this.ages[i] += dt;
        const lt = this.lifetimes[i];
        const age = this.ages[i];

        if (age >= lt) {
          this.alphas[i] = 0.0;
        } else {
          // Exact specification formula:
          // particle_alpha(t_age) = clamp(1.0 - (t_age / particle_lifetime)^1.8, 0.0, 1.0)
          const ratio = MathUtils.clamp(age / lt, 0, 1);
          this.alphas[i] = MathUtils.clamp(1.0 - Math.pow(ratio, 1.8), 0.0, 1.0);
        }
        needsAlphaUpdate = true;
      }
    }

    if (needsAlphaUpdate) {
      const alphaAttr = this.geometry.getAttribute("alpha") as THREE.BufferAttribute;
      alphaAttr.needsUpdate = true;

      const posAttr = this.geometry.getAttribute("position") as THREE.BufferAttribute;
      posAttr.needsUpdate = true;

      const colAttr = this.geometry.getAttribute("customColor") as THREE.BufferAttribute;
      colAttr.needsUpdate = true;
    }
  }

  public clear(): void {
    for (let i = 0; i < this.maxPoints; i++) {
      this.alphas[i] = 0.0;
      this.ages[i] = 999.0;
    }
    this.headIndex = 0;
    this.activeCount = 0;
    (this.geometry.getAttribute("alpha") as THREE.BufferAttribute).needsUpdate = true;
  }
}
