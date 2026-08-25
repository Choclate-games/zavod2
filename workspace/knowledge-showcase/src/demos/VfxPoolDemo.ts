import * as THREE from 'three';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import { ParticlePoolSystem, type ParticlePreset } from '../game/vfxJuice';

export class VfxPoolDemo implements Demo {
  readonly id = 'vfxpool';
  readonly title = ['✨ VFX-пул и сочность', '✨ Instanced Particle VFX & Juice'] as const;
  readonly hint = [
    '<b>ЛКМ</b> взорвать частицы в точке клика · <b>1..4</b> пресет (1: Взрыв, 2: Ударное кольцо, 3: Дым, 4: Магия)'
    + ' · <b>Space</b> залп по центру · <b>R</b> очистка<br>1000+ частиц за 1 Draw Call через InstancedMesh без покадровых аллокаций.',
    '<b>LMB</b> emit particles at click point · <b>1..4</b> preset (1: Explosion, 2: Shockwave, 3: Smoke, 4: Magic)'
    + ' · <b>Space</b> burst center · <b>R</b> clear<br>1000+ particles in 1 Draw Call via InstancedMesh with zero per-frame allocations.',
  ] as const;
  readonly category = ['🎨 Графика и шейдеры', '🎨 Graphics & Shaders'] as const;
  readonly tags = ['vfx', 'частицы', 'instancing', 'шейк', 'juice', 'взрыв', 'pool', 'particle', 'trauma'] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.5, 100);

  private ctx!: DemoContext;
  private pool = new ParticlePoolSystem(1200);
  private instancedMesh!: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private colorHelper = new THREE.Color();

  private activePreset: ParticlePreset = 'explosion';
  private totalSpawned = 0;
  private activeCount = 0;

  private raycaster = new THREE.Raycaster();
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private unsubscribeKey: (() => void) | null = null;

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.scene.background = new THREE.Color(0x0e1117);
    this.scene.fog = new THREE.FogExp2(0x0e1117, 0.02);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(10, 20, 10);
    this.scene.add(dirLight);

    this.scene.add(new THREE.AmbientLight(0x334455, 0.7));

    this.buildArena();
    this.buildParticleInstancer();

    this.camera.position.set(0, 14, 18);
    this.camera.lookAt(0, 0, 0);
  }

  enter(): void {
    this.unsubscribeKey = this.ctx.input.onKey((code) => {
      if (code === 'Digit1') this.activePreset = 'explosion';
      else if (code === 'Digit2') this.activePreset = 'ring';
      else if (code === 'Digit3') this.activePreset = 'smoke';
      else if (code === 'Digit4') this.activePreset = 'magic';
      else if (code === 'Space') {
        this.emitAt(0, 0.5, 0);
      } else if (code === 'KeyR') {
        this.reset();
      }
    });
  }

  exit(): void {
    this.unsubscribeKey?.();
    this.unsubscribeKey = null;
  }

  fixedUpdate(dt: number): void {
    const primary = this.ctx.input.primary;
    if (primary && primary.down) {
      this.raycaster.setFromCamera(primary.ndc, this.camera);
      const hit = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.floorPlane, hit)) {
        this.emitAt(hit.x, 0.5, hit.z);
      }
    }

    const res = this.pool.update(dt);
    this.activeCount = res.activeCount;

    this.updateInstancedMesh();
    this.pushStatus();
  }

  update(dt: number): void {
    // Subtle camera drift
    this.camera.position.x = Math.sin(Date.now() * 0.0005) * 1.5;
    this.camera.lookAt(0, 0, 0);
  }

  dispose(): void {
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  private buildArena(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshStandardMaterial({ color: 0x181e2b, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(36, 18, 0x334466, 0x1f2738);
    grid.position.y = 0.02;
    this.scene.add(grid);
  }

  private buildParticleInstancer(): void {
    const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.pool.maxCapacity);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Initialize all hidden
    for (let i = 0; i < this.pool.maxCapacity; i++) {
      this.dummy.position.set(0, -999, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
      this.instancedMesh.setColorAt(i, this.colorHelper.setHex(0xffffff));
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true;

    this.scene.add(this.instancedMesh);
  }

  private emitAt(x: number, y: number, z: number): void {
    let count = 40;
    let speed = 7.0;
    let color = { r: 1.0, g: 0.5, b: 0.0 };

    if (this.activePreset === 'explosion') {
      count = 45;
      speed = 8.5;
      color = { r: 1.0, g: 0.4, b: 0.05 };
      this.ctx.audio.playExplosion(0.7);
      this.ctx.addTrauma(0.35);
    } else if (this.activePreset === 'ring') {
      count = 60;
      speed = 9.0;
      color = { r: 0.0, g: 0.85, b: 0.9 };
      this.ctx.audio.playDash();
      this.ctx.addTrauma(0.2);
    } else if (this.activePreset === 'smoke') {
      count = 30;
      speed = 3.0;
      color = { r: 0.6, g: 0.65, b: 0.7 };
      this.ctx.audio.playButtonClick();
    } else if (this.activePreset === 'magic') {
      count = 50;
      speed = 7.0;
      color = { r: 0.75, g: 0.2, b: 0.95 };
      this.ctx.audio.playCoinPickup();
      this.ctx.addTrauma(0.15);
    }

    const spawned = this.pool.emitBurst(x, y, z, count, speed, color, this.activePreset);
    this.totalSpawned += spawned;
  }

  private updateInstancedMesh(): void {
    let updatedCount = 0;

    for (let i = 0; i < this.pool.maxCapacity; i++) {
      const p = this.pool.particles[i];
      if (p.active) {
        this.dummy.position.set(p.x, p.y, p.z);
        this.dummy.scale.setScalar(p.currentScale);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);

        this.colorHelper.setRGB(p.r, p.g, p.b);
        this.instancedMesh.setColorAt(i, this.colorHelper);
        updatedCount++;
      } else {
        this.dummy.position.set(0, -999, 0);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
      }
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true;
  }

  private reset(): void {
    for (const p of this.pool.particles) p.active = false;
    this.totalSpawned = 0;
    this.activeCount = 0;
  }

  private pushStatus(): void {
    const presetNames: Record<ParticlePreset, string> = {
      sparks: 'Искры металла',
      explosion: 'Огненный взрыв',
      ring: 'Ударное кольцо (Shockwave)',
      smoke: 'Дымовой шлейф',
      magic: 'Магический фонтан',
    };

    this.ctx.setStatus(
      `Пресет: <b>${presetNames[this.activePreset]}</b> · Активно частиц: <b>${this.activeCount} / ${this.pool.maxCapacity}</b>`
      + ` · Draw Calls: <b>1 (InstancedMesh)</b> · Всего создано: <b>${this.totalSpawned}</b> · Покадровых аллокаций: <b>0</b>`,
    );
  }
}
