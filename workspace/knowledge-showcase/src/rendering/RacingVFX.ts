import * as THREE from 'three';

const MAX_SKID_QUADS = 1800; // Up to 1800 segments of persistent tire rubber
const MAX_PARTICLES = 160;

interface SkidPoint {
  x: number;
  y: number;
  z: number;
  alpha: number;
}

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  scaleGrowth: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
  type: 'smoke' | 'fire' | 'spark' | 'dirt';
}

export class RacingVFX {
  // Skidmarks Mesh & Geometry
  private readonly skidGeom = new THREE.BufferGeometry();
  private readonly skidPositions = new Float32Array(MAX_SKID_QUADS * 4 * 3);
  private readonly skidAlphas = new Float32Array(MAX_SKID_QUADS * 4);
  private readonly skidIndices = new Uint32Array(MAX_SKID_QUADS * 6);
  private skidQuadCount = 0;
  private skidMesh: THREE.Mesh;

  // Last wheel positions for continuous skid strip ribbons
  private readonly lastWheelPos: Array<{ left: THREE.Vector3; right: THREE.Vector3; active: boolean }> = [];

  // Particle System (Smoke, Backfire flames, Sparks, Dirt)
  private readonly particles: Particle[] = [];
  private readonly smokeMesh: THREE.InstancedMesh;
  private readonly fireMesh: THREE.InstancedMesh;
  private readonly sparkMesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();

  constructor(private readonly scene: THREE.Scene, wheelCount = 24) {
    // 1. Initialize Skidmarks Buffer
    for (let i = 0; i < MAX_SKID_QUADS; i++) {
      const v = i * 4;
      const idx = i * 6;
      this.skidIndices[idx] = v;
      this.skidIndices[idx + 1] = v + 1;
      this.skidIndices[idx + 2] = v + 2;
      this.skidIndices[idx + 3] = v + 1;
      this.skidIndices[idx + 4] = v + 3;
      this.skidIndices[idx + 5] = v + 2;
    }

    this.skidGeom.setAttribute('position', new THREE.BufferAttribute(this.skidPositions, 3));
    this.skidGeom.setAttribute('alpha', new THREE.BufferAttribute(this.skidAlphas, 1));
    this.skidGeom.setIndex(new THREE.BufferAttribute(this.skidIndices, 1));
    this.skidGeom.setDrawRange(0, 0);

    const skidMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(0.08, 0.08, 0.09, vAlpha * 0.72);
        }
      `,
    });

    this.skidMesh = new THREE.Mesh(this.skidGeom, skidMat);
    this.skidMesh.frustumCulled = false;
    scene.add(this.skidMesh);

    for (let i = 0; i < wheelCount; i++) {
      this.lastWheelPos.push({
        left: new THREE.Vector3(),
        right: new THREE.Vector3(),
        active: false,
      });
    }

    // 2. Initialize Instanced Particle Meshes
    // Smoke Mesh (Soft white spheres)
    const smokeGeom = new THREE.DodecahedronGeometry(0.35, 1);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xeeeeee,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.smokeMesh = new THREE.InstancedMesh(smokeGeom, smokeMat, 90);
    this.smokeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.smokeMesh);

    // Fire / Backfire Exhaust Mesh (Bright Orange/Yellow)
    const fireGeom = new THREE.ConeGeometry(0.12, 0.4, 6);
    fireGeom.rotateX(Math.PI / 2);
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xff7711,
      transparent: true,
      opacity: 0.9,
    });
    this.fireMesh = new THREE.InstancedMesh(fireGeom, fireMat, 30);
    this.fireMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.fireMesh);

    // Sparks Mesh (Bright yellow points)
    const sparkGeom = new THREE.BoxGeometry(0.06, 0.06, 0.2);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffea44 });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeom, sparkMat, 40);
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.sparkMesh);
  }

  addSkid(wheelId: number, pos: THREE.Vector3, forward: THREE.Vector3, halfWidth = 0.16, alpha = 0.8): void {
    const state = this.lastWheelPos[wheelId];
    if (!state) return;

    // Right vector perpendicular to vehicle forward
    const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
    const curLeft = pos.clone().addScaledVector(right, -halfWidth);
    const curRight = pos.clone().addScaledVector(right, halfWidth);

    if (state.active) {
      const dist = pos.distanceTo(state.left);
      if (dist > 0.35 && dist < 5.0) {
        // Lay a new skid quad
        const quad = this.skidQuadCount % MAX_SKID_QUADS;
        const v = quad * 4 * 3;
        const a = quad * 4;

        // V0: lastLeft
        this.skidPositions[v] = state.left.x;
        this.skidPositions[v + 1] = state.left.y + 0.025;
        this.skidPositions[v + 2] = state.left.z;
        this.skidAlphas[a] = alpha;

        // V1: lastRight
        this.skidPositions[v + 3] = state.right.x;
        this.skidPositions[v + 4] = state.right.y + 0.025;
        this.skidPositions[v + 5] = state.right.z;
        this.skidAlphas[a + 1] = alpha;

        // V2: curLeft
        this.skidPositions[v + 6] = curLeft.x;
        this.skidPositions[v + 7] = curLeft.y + 0.025;
        this.skidPositions[v + 8] = curLeft.z;
        this.skidAlphas[a + 2] = alpha;

        // V3: curRight
        this.skidPositions[v + 9] = curRight.x;
        this.skidPositions[v + 10] = curRight.y + 0.025;
        this.skidPositions[v + 11] = curRight.z;
        this.skidAlphas[a + 3] = alpha;

        this.skidQuadCount++;
        const totalDrawn = Math.min(this.skidQuadCount, MAX_SKID_QUADS);
        this.skidGeom.setDrawRange(0, totalDrawn * 6);
        this.skidGeom.attributes.position.needsUpdate = true;
        this.skidGeom.attributes.alpha.needsUpdate = true;
      }
    }

    state.left.copy(curLeft);
    state.right.copy(curRight);
    state.active = true;
  }

  breakSkid(wheelId: number): void {
    const state = this.lastWheelPos[wheelId];
    if (state) state.active = false;
  }

  emitTireSmoke(pos: THREE.Vector3, forward: THREE.Vector3, intensity = 1.0): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    const p: Particle = {
      pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.1, (Math.random() - 0.5) * 0.3)),
      vel: new THREE.Vector3(
        -forward.x * 1.5 + (Math.random() - 0.5) * 2.0,
        0.8 + Math.random() * 1.2,
        -forward.z * 1.5 + (Math.random() - 0.5) * 2.0,
      ),
      scale: 0.4 * intensity,
      scaleGrowth: 1.6,
      alpha: 0.55 * intensity,
      life: 0,
      maxLife: 0.75 + Math.random() * 0.35,
      color: new THREE.Color(0xdde2e8),
      type: 'smoke',
    };
    this.particles.push(p);
  }

  emitExhaustFlame(pos: THREE.Vector3, forward: THREE.Vector3): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    const p: Particle = {
      pos: pos.clone(),
      vel: forward.clone().multiplyScalar(-6.0 + Math.random() * 2.0),
      scale: 0.6 + Math.random() * 0.4,
      scaleGrowth: -0.4,
      alpha: 1.0,
      life: 0,
      maxLife: 0.14,
      color: new THREE.Color(0xff6600),
      type: 'fire',
    };
    this.particles.push(p);
  }

  emitSparks(pos: THREE.Vector3, forward: THREE.Vector3): void {
    for (let i = 0; i < 3; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;
      const p: Particle = {
        pos: pos.clone(),
        vel: new THREE.Vector3(
          -forward.x * 4.0 + (Math.random() - 0.5) * 4.0,
          1.2 + Math.random() * 2.0,
          -forward.z * 4.0 + (Math.random() - 0.5) * 4.0,
        ),
        scale: 0.15,
        scaleGrowth: -0.1,
        alpha: 1.0,
        life: 0,
        maxLife: 0.25 + Math.random() * 0.15,
        color: new THREE.Color(0xffe033),
        type: 'spark',
      };
      this.particles.push(p);
    }
  }

  update(dt: number): void {
    let smokeIdx = 0;
    let fireIdx = 0;
    let sparkIdx = 0;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics integration
      p.pos.addScaledVector(p.vel, dt);
      p.vel.y += (p.type === 'smoke' ? 0.3 : -9.8) * dt;
      p.scale += p.scaleGrowth * dt;
      const lifeRatio = 1 - p.life / p.maxLife;

      this.dummy.position.copy(p.pos);
      this.dummy.scale.setScalar(Math.max(0.01, p.scale));
      this.dummy.quaternion.identity();
      this.dummy.updateMatrix();

      if (p.type === 'smoke' && smokeIdx < 90) {
        this.smokeMesh.setMatrixAt(smokeIdx++, this.dummy.matrix);
      } else if (p.type === 'fire' && fireIdx < 30) {
        this.fireMesh.setMatrixAt(fireIdx++, this.dummy.matrix);
      } else if (p.type === 'spark' && sparkIdx < 40) {
        this.sparkMesh.setMatrixAt(sparkIdx++, this.dummy.matrix);
      }
    }

    // Hide inactive instances
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    while (smokeIdx < 90) this.smokeMesh.setMatrixAt(smokeIdx++, this.dummy.matrix);
    while (fireIdx < 30) this.fireMesh.setMatrixAt(fireIdx++, this.dummy.matrix);
    while (sparkIdx < 40) this.sparkMesh.setMatrixAt(sparkIdx++, this.dummy.matrix);

    this.smokeMesh.instanceMatrix.needsUpdate = true;
    this.fireMesh.instanceMatrix.needsUpdate = true;
    this.sparkMesh.instanceMatrix.needsUpdate = true;
  }
}
