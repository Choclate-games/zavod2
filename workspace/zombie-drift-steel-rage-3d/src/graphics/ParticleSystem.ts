import * as THREE from 'three';

interface Particle {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  scale: number;
  maxLife: number;
  life: number;
  growth: number;
  gravity: number;
  drag: number;
  rotation: number;
  rotSpeed: number;
  colorEnd?: THREE.Color;
}

function createParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = 32;
    const cy = 32;
    const radius = 30;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.98)');
    grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.72)');
    grad.addColorStop(0.88, 'rgba(255, 255, 255, 0.22)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export class ParticleSystem {
  public group = new THREE.Group();
  private pool: Particle[] = [];
  private maxParticles = 1600;
  private instancedMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private colorAttribute: THREE.InstancedBufferAttribute;

  private _scratchColor = new THREE.Color();

  constructor() {
    // Quad billboard geometry with soft circular organic particle texture
    const particleTex = createParticleTexture();
    const geom = new THREE.PlaneGeometry(0.8, 0.8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: particleTex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.instancedMesh = new THREE.InstancedMesh(geom, mat, this.maxParticles);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Instance colors
    const colors = new Float32Array(this.maxParticles * 3);
    this.colorAttribute = new THREE.InstancedBufferAttribute(colors, 3);
    geom.setAttribute('color', this.colorAttribute);

    this.group.add(this.instancedMesh);

    // Pre-allocate particle pool
    for (let i = 0; i < this.maxParticles; i++) {
      this.pool.push({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(),
        scale: 0.4,
        maxLife: 1.0,
        life: 0,
        growth: 0,
        gravity: 0,
        drag: 0.95,
        rotation: 0,
        rotSpeed: 0,
      });
    }
  }

  private allocParticle(): Particle | null {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        this.pool[i].active = true;
        this.pool[i].life = 0;
        this.pool[i].colorEnd = undefined;
        return this.pool[i];
      }
    }
    return null;
  }

  public emitSmoke(x: number, y: number, z: number, count = 2): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      const gray = 0.65 + Math.random() * 0.25;
      p.position.set(x + (Math.random() - 0.5) * 0.4, y + 0.15, z + (Math.random() - 0.5) * 0.4);
      p.velocity.set((Math.random() - 0.5) * 1.5, Math.random() * 1.8 + 0.5, (Math.random() - 0.5) * 1.5);
      p.color.setRGB(gray, gray, gray);
      p.scale = 0.4 + Math.random() * 0.3;
      p.maxLife = 0.7 + Math.random() * 0.4;
      p.growth = 2.2;
      p.gravity = -0.2;
      p.drag = 0.94;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 3;
    }
  }

  public emitMuzzleFlash(x: number, y: number, z: number, dir: THREE.Vector3): void {
    // 1. High-intensity bright core burst
    const p = this.allocParticle();
    if (p) {
      p.color.setHex(0xffffff);
      p.position.set(x + dir.x * 0.15, y + dir.y * 0.15, z + dir.z * 0.15);
      p.velocity.set(dir.x * 2.0, dir.y * 2.0, dir.z * 2.0);
      p.scale = 0.65;
      p.maxLife = 0.07;
      p.growth = 0.5;
      p.gravity = 0;
      p.drag = 0.8;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = 0;
    }

    // 2. Fiery expanding star flare
    for (let i = 0; i < 3; i++) {
      const sp = this.allocParticle();
      if (!sp) break;
      sp.color.setHex(0xffaa00);
      sp.position.set(x, y, z);
      sp.velocity.set(
        dir.x * 6.0 + (Math.random() - 0.5) * 3.0,
        dir.y * 6.0 + (Math.random() - 0.5) * 2.0,
        dir.z * 6.0 + (Math.random() - 0.5) * 3.0
      );
      sp.scale = 0.35;
      sp.maxLife = 0.1;
      sp.growth = -0.8;
      sp.gravity = 0;
      sp.drag = 0.75;
      sp.rotation = Math.random() * Math.PI * 2;
      sp.rotSpeed = (Math.random() - 0.5) * 8;
    }
  }

  public emitFlameStream(origin: THREE.Vector3, forward: THREE.Vector3, count = 4): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;

      const spread = 0.35;
      const speed = 16.0 + Math.random() * 8.0;
      const r = Math.random();

      if (r < 0.45) {
        p.color.setHex(0xffd000); // Hot yellow
      } else if (r < 0.85) {
        p.color.setHex(0xff4500); // Fiery orange
      } else {
        p.color.setHex(0x990000); // Dark red
      }

      p.position.set(
        origin.x + (Math.random() - 0.5) * 0.3,
        origin.y + (Math.random() - 0.5) * 0.2,
        origin.z + (Math.random() - 0.5) * 0.3
      );

      p.velocity.set(
        forward.x * speed + (Math.random() - 0.5) * spread * speed,
        forward.y * speed + (Math.random() * 0.2 + 0.1) * speed,
        forward.z * speed + (Math.random() - 0.5) * spread * speed
      );

      p.scale = 0.3 + Math.random() * 0.25;
      p.maxLife = 0.45 + Math.random() * 0.25;
      p.growth = 2.4; // Expands outward as flame billows
      p.gravity = -2.5; // Natural thermal rise
      p.drag = 0.92;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 6;
    }
  }

  public emitLightningArc(start: THREE.Vector3, target: THREE.Vector3, segments = 5): void {
    const dir = new THREE.Vector3().subVectors(target, start);
    const len = dir.length();
    const step = 1.0 / segments;

    for (let i = 0; i <= segments; i++) {
      const p = this.allocParticle();
      if (!p) break;

      const t = i * step;
      const jitter = (1 - Math.abs(t - 0.5) * 2) * 0.6; // More jitter in center
      
      p.color.setHex(i % 2 === 0 ? 0x00f0ff : 0x70d6ff);
      p.position.set(
        start.x + dir.x * t + (Math.random() - 0.5) * jitter,
        start.y + dir.y * t + (Math.random() - 0.5) * jitter,
        start.z + dir.z * t + (Math.random() - 0.5) * jitter
      );
      p.velocity.set((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5);
      p.scale = 0.35 + Math.random() * 0.2;
      p.maxLife = 0.12 + Math.random() * 0.08;
      p.growth = -0.5;
      p.gravity = 0;
      p.drag = 0.9;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = 0;
    }
  }

  public emitNitroFire(x: number, y: number, z: number, dir: THREE.Vector3, count = 3): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      const isCyan = Math.random() > 0.35;
      if (isCyan) {
        p.color.setHex(0x00f0ff);
      } else {
        p.color.setHex(0x0077b6);
      }
      p.position.set(x, y + 0.2, z);
      p.velocity.set(
        dir.x * -16.0 + (Math.random() - 0.5) * 0.8,
        dir.y * -16.0 + (Math.random() - 0.5) * 0.6,
        dir.z * -16.0 + (Math.random() - 0.5) * 0.8
      );
      p.scale = 0.5 + Math.random() * 0.35;
      p.maxLife = 0.28 + Math.random() * 0.15;
      p.growth = -1.0;
      p.gravity = 0;
      p.drag = 0.92;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 6;
    }
  }

  public emitBloodSplatter(x: number, y: number, z: number, count = 16, isToxic = false): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      const shade = Math.random();
      if (isToxic) {
        if (shade < 0.4) {
          p.color.setHex(0x76ff03); // Toxic lime
        } else if (shade < 0.75) {
          p.color.setHex(0x38b000); // Acid bile
        } else {
          p.color.setHex(0x007200); // Dark toxic sludge
        }
      } else {
        if (shade < 0.35) {
          p.color.setHex(0xd90429); // Vivid arterial red
        } else if (shade < 0.65) {
          p.color.setHex(0x9d0208); // Rich crimson
        } else if (shade < 0.85) {
          p.color.setHex(0x6a040f); // Deep gore
        } else {
          p.color.setHex(0x370617); // Dark coagulated blood
        }
      }
      p.position.set(
        x + (Math.random() - 0.5) * 0.3,
        y + (Math.random() - 0.5) * 0.2,
        z + (Math.random() - 0.5) * 0.3
      );
      p.velocity.set(
        (Math.random() - 0.5) * 12,
        Math.random() * 8 + 3.0,
        (Math.random() - 0.5) * 12
      );
      p.scale = 0.4 + Math.random() * 0.4;
      p.maxLife = 0.65 + Math.random() * 0.45;
      p.growth = -0.25;
      p.gravity = 15.0;
      p.drag = 0.94;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 6;
    }
  }

  /**
   * Directional arterial blood spurt in trajectory of bullet/impact
   */
  public emitBloodSpurt(
    x: number,
    y: number,
    z: number,
    dir: THREE.Vector3,
    count = 18,
    isToxic = false
  ): void {
    const dLen = Math.max(0.1, dir.length());
    const nx = dir.x / dLen;
    const ny = Math.max(0.1, dir.y / dLen);
    const nz = dir.z / dLen;

    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;

      const shade = Math.random();
      if (isToxic) {
        p.color.setHex(shade < 0.5 ? 0x76ff03 : 0x2dc653);
      } else {
        if (shade < 0.4) {
          p.color.setHex(0xef233c); // Bright spurting blood
        } else if (shade < 0.75) {
          p.color.setHex(0xd90429); // Rich crimson
        } else {
          p.color.setHex(0x6a040f); // Dark gore
        }
      }

      p.position.set(
        x + (Math.random() - 0.5) * 0.2,
        y + (Math.random() - 0.5) * 0.2,
        z + (Math.random() - 0.5) * 0.2
      );

      const speed = 12.0 + Math.random() * 10.0;
      p.velocity.set(
        nx * speed + (Math.random() - 0.5) * 7.0,
        ny * speed + Math.random() * 5.0 + 2.0,
        nz * speed + (Math.random() - 0.5) * 7.0
      );

      p.scale = 0.45 + Math.random() * 0.4;
      p.maxLife = 0.55 + Math.random() * 0.35;
      p.growth = -0.3;
      p.gravity = 16.0;
      p.drag = 0.93;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 8;
    }
  }

  /**
   * Explosive 360 degree radial blood geyser for rams, explosions, and critical finishes
   */
  public emitBloodBurst(
    x: number,
    y: number,
    z: number,
    count = 28,
    speedMult = 1.0,
    isToxic = false
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;

      const shade = Math.random();
      if (isToxic) {
        p.color.setHex(shade < 0.4 ? 0xccff33 : shade < 0.8 ? 0x70e000 : 0x007200);
      } else {
        if (shade < 0.3) {
          p.color.setHex(0xff0a54); // Hot arterial spray
        } else if (shade < 0.6) {
          p.color.setHex(0xd90429); // Pure crimson
        } else if (shade < 0.85) {
          p.color.setHex(0x9d0208); // Dark blood
        } else {
          p.color.setHex(0x370617); // Coagulated gore
        }
      }

      p.position.set(
        x + (Math.random() - 0.5) * 0.4,
        y + (Math.random() - 0.5) * 0.3,
        z + (Math.random() - 0.5) * 0.4
      );

      const angle = Math.random() * Math.PI * 2;
      const horizSpeed = (Math.random() * 12 + 4.0) * speedMult;
      const vertSpeed = (Math.random() * 9 + 3.5) * speedMult;

      p.velocity.set(
        Math.cos(angle) * horizSpeed,
        vertSpeed,
        Math.sin(angle) * horizSpeed
      );

      p.scale = 0.48 + Math.random() * 0.45;
      p.maxLife = 0.7 + Math.random() * 0.4;
      p.growth = -0.3;
      p.gravity = 14.0;
      p.drag = 0.94;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 6;
    }
  }

  /**
   * Expanding aerosol cloud of bloody mist hanging over impact area
   */
  public emitBloodMist(x: number, y: number, z: number, count = 6, isToxic = false): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;

      if (isToxic) {
        p.color.setHex(0x38b000);
      } else {
        p.color.setHex(Math.random() > 0.4 ? 0xa4161a : 0x660708);
      }

      p.position.set(
        x + (Math.random() - 0.5) * 0.5,
        y + 0.2 + (Math.random() - 0.5) * 0.3,
        z + (Math.random() - 0.5) * 0.5
      );

      p.velocity.set(
        (Math.random() - 0.5) * 3.0,
        Math.random() * 1.5 + 0.4,
        (Math.random() - 0.5) * 3.0
      );

      p.scale = 0.8 + Math.random() * 0.5;
      p.maxLife = 0.9 + Math.random() * 0.5;
      p.growth = 2.6; // Expands outward as a soft billowing cloud
      p.gravity = -0.2; // Slowly hangs in air
      p.drag = 0.92;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 2;
    }
  }

  /**
   * Heavy flying meat chunks and clotted gore
   */
  public emitBloodChunks(x: number, y: number, z: number, count = 8, vel?: THREE.Vector3): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;

      const shade = Math.random();
      p.color.setHex(shade < 0.6 ? 0x4a0e0e : 0x200505);

      p.position.set(
        x + (Math.random() - 0.5) * 0.3,
        y + 0.3,
        z + (Math.random() - 0.5) * 0.3
      );

      const vx = vel ? vel.x * 0.5 + (Math.random() - 0.5) * 8 : (Math.random() - 0.5) * 10;
      const vy = vel ? Math.max(3, vel.y * 0.6) + Math.random() * 5 : Math.random() * 7 + 3;
      const vz = vel ? vel.z * 0.5 + (Math.random() - 0.5) * 8 : (Math.random() - 0.5) * 10;

      p.velocity.set(vx, vy, vz);
      p.scale = 0.35 + Math.random() * 0.3;
      p.maxLife = 0.8 + Math.random() * 0.4;
      p.growth = -0.4;
      p.gravity = 18.0;
      p.drag = 0.96;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 10;
    }
  }

  public emitSparks(x: number, y: number, z: number, count = 8): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      if (Math.random() > 0.5) {
        p.color.setHex(0xffd166);
      } else {
        p.color.setHex(0xff9f1c);
      }
      p.position.set(x, y + 0.3, z);
      p.velocity.set(
        (Math.random() - 0.5) * 9,
        Math.random() * 6 + 2,
        (Math.random() - 0.5) * 9
      );
      p.scale = 0.22 + Math.random() * 0.2;
      p.maxLife = 0.3 + Math.random() * 0.2;
      p.growth = -0.8;
      p.gravity = 10.0;
      p.drag = 0.94;
      p.rotation = 0;
      p.rotSpeed = 0;
    }
  }

  public emitDriftSparks(x: number, y: number, z: number, count = 3): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      p.color.setHex(Math.random() > 0.4 ? 0xffbb00 : 0xff5500);
      p.position.set(x + (Math.random() - 0.5) * 0.3, 0.15, z + (Math.random() - 0.5) * 0.3);
      p.velocity.set(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 4
      );
      p.scale = 0.2;
      p.maxLife = 0.2 + Math.random() * 0.15;
      p.growth = -0.8;
      p.gravity = 8.0;
      p.drag = 0.92;
      p.rotation = 0;
      p.rotSpeed = 0;
    }
  }

  public emitExplosion(x: number, y: number, z: number, count = 28): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      const r = Math.random();
      if (r < 0.35) {
        p.color.setHex(0xffffff); // White-hot flash center
      } else if (r < 0.65) {
        p.color.setHex(0xff5500); // Fiery orange
      } else if (r < 0.85) {
        p.color.setHex(0xffaa00); // Yellow flame
      } else {
        p.color.setHex(0x222222); // Black explosive smoke
      }
      p.position.set(x, y + 0.5, z);
      p.velocity.set(
        (Math.random() - 0.5) * 16,
        Math.random() * 9 + 3.5,
        (Math.random() - 0.5) * 16
      );
      p.scale = 0.7 + Math.random() * 0.7;
      p.maxLife = 0.55 + Math.random() * 0.4;
      p.growth = 1.8;
      p.gravity = 2.5;
      p.drag = 0.91;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 7;
    }
  }

  public emitAcidSplash(x: number, y: number, z: number, count = 8): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      p.color.setHex(Math.random() > 0.3 ? 0x76ff03 : 0x00e676);
      p.position.set(x, y + 0.3, z);
      p.velocity.set(
        (Math.random() - 0.5) * 6,
        Math.random() * 5 + 1.5,
        (Math.random() - 0.5) * 6
      );
      p.scale = 0.4;
      p.maxLife = 0.55;
      p.growth = 0.6;
      p.gravity = 9.0;
      p.drag = 0.94;
      p.rotation = 0;
      p.rotSpeed = 0;
    }
  }

  public emitWoodSplinters(x: number, y: number, z: number, count = 12): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      const shade = Math.random() > 0.5 ? 0x8b5a2b : 0xcd853f;
      p.color.setHex(shade);
      p.position.set(x + (Math.random() - 0.5) * 0.4, y + 0.4, z + (Math.random() - 0.5) * 0.4);
      p.velocity.set(
        (Math.random() - 0.5) * 9,
        Math.random() * 7 + 2,
        (Math.random() - 0.5) * 9
      );
      p.scale = 0.3 + Math.random() * 0.25;
      p.maxLife = 0.45 + Math.random() * 0.3;
      p.growth = -0.4;
      p.gravity = 11.0;
      p.drag = 0.94;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 9;
    }
  }

  public emitToxicBubbles(x: number, y: number, z: number, count = 4): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      p.color.setHex(0x39ff14);
      p.position.set(x + (Math.random() - 0.5) * 0.6, y + 0.1, z + (Math.random() - 0.5) * 0.6);
      p.velocity.set(
        (Math.random() - 0.5) * 1.5,
        Math.random() * 2.2 + 0.8,
        (Math.random() - 0.5) * 1.5
      );
      p.scale = 0.25 + Math.random() * 0.2;
      p.maxLife = 0.4 + Math.random() * 0.25;
      p.growth = 0.8;
      p.gravity = -1.5;
      p.drag = 0.96;
      p.rotation = 0;
      p.rotSpeed = 0;
    }
  }

  public emitBoostTrail(x: number, y: number, z: number, dir: THREE.Vector3, count = 4): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      p.color.setHex(Math.random() > 0.3 ? 0xff9100 : 0xffea00);
      p.position.set(x + (Math.random() - 0.5) * 0.4, y + 0.2, z + (Math.random() - 0.5) * 0.4);
      p.velocity.set(
        dir.x * -8.0 + (Math.random() - 0.5) * 2,
        Math.random() * 2 + 0.5,
        dir.z * -8.0 + (Math.random() - 0.5) * 2
      );
      p.scale = 0.45 + Math.random() * 0.25;
      p.maxLife = 0.35;
      p.growth = -0.5;
      p.gravity = 0;
      p.drag = 0.93;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 6;
    }
  }

  public update(dt: number, camera: THREE.Camera): void {
    let activeIndex = 0;

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }

      // Physics
      p.velocity.y -= p.gravity * dt;
      p.velocity.x *= p.drag;
      p.velocity.y *= p.drag;
      p.velocity.z *= p.drag;

      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.position.z += p.velocity.z * dt;

      if (p.position.y < 0.1) {
        p.position.y = 0.1;
        p.velocity.y = 0;
      }

      p.rotation += p.rotSpeed * dt;
      const progress = p.life / p.maxLife;
      const currentScale = Math.max(0.01, p.scale + p.growth * progress);

      // Billboard orientation towards camera
      this.dummy.position.copy(p.position);
      this.dummy.quaternion.copy(camera.quaternion);
      this.dummy.scale.set(currentScale, currentScale, currentScale);
      this.dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(activeIndex, this.dummy.matrix);
      this.instancedMesh.setColorAt(activeIndex, p.color);
      activeIndex++;
    }

    this.instancedMesh.count = activeIndex;
    if (activeIndex > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      if (this.instancedMesh.instanceColor) {
        this.instancedMesh.instanceColor.needsUpdate = true;
      }
    }
  }
}
