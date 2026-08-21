import * as THREE from 'three';
import {
  BloomEffect, ChromaticAberrationEffect, DepthOfFieldEffect, NoiseEffect,
  OutlineEffect, ScanlineEffect, VignetteEffect, KernelSize, BlendFunction,
  type Effect,
} from 'postprocessing';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';

type EffectId = 'bloom' | 'dof' | 'outline' | 'scanline';

/**
 * postprocessing: один EffectPass на все эффекты, бюджет по тирам и импульсные
 * эффекты без пересборки прохода.
 *
 * Прямая проверка knowledge/stack/postprocessing.md. Главное, что показывает
 * демо: включение эффекта пересобирает проход (видимый фриз в первый раз), а
 * импульсный «удар» — нет, потому что живёт в конвейере постоянно.
 */
export class PostFxDemo implements Demo {
  readonly id = 'postfx';
  readonly title = ['✨ Постобработка по тирам', '✨ Post FX by tier'] as const;
  readonly hint = [
    '<b>1</b> bloom · <b>2</b> depth of field · <b>3</b> контур · <b>4</b> сканлайны · <b>Space</b> импульс удара (без пересборки прохода) · тир качества — в шапке',
    '<b>1</b> bloom · <b>2</b> depth of field · <b>3</b> outline · <b>4</b> scanlines · <b>Space</b> hit impulse (no pass rebuild) · quality tier is in the header',
  ] as const;
  readonly category = ['✨ Графика и VFX', '✨ Graphics & VFX'] as const;
  readonly tags = ['постобработка', 'postprocessing', 'bloom', 'dof', 'шейдеры', 'эффекты', 'outline', 'scanlines'] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.5, 200);

  private ctx!: DemoContext;
  private enabled = new Set<EffectId>(['bloom']);
  private effectCache = new Map<EffectId, Effect>();

  /**
   * Импульсные эффекты созданы ОДИН раз и всегда в конвейере: их прозрачность
   * анимируется. Пересборка EffectPass во время боя компилирует шейдер и даёт
   * фриз на пол-секунды (§3 документа).
   */
  private hitAberration!: ChromaticAberrationEffect;
  private hitNoise!: NoiseEffect;
  private hitTimer = 0;

  private pillars: THREE.Mesh[] = [];
  private spin = 0;
  private unsubscribe: (() => void) | null = null;
  private statusTimer = 0;
  private lastRebuildMs = 0;

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.scene.background = new THREE.Color(0x0b0d16);
    this.scene.fog = new THREE.Fog(0x0b0d16, 30, 110);

    this.scene.add(new THREE.HemisphereLight(0x4a5a8a, 0x0a0a12, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(12, 20, 14);
    key.castShadow = ctx.tier === 'high';
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key, key.target);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 0.75, metalness: 0.2 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Яркие эмиссивные объекты: без них bloom нечему подсвечивать, и демо
    // выглядит как «эффект не работает».
    const colors = [0xff3d81, 0x3dd6ff, 0xffd166, 0x8cff5c, 0xc084fc];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = 9 + (i % 3) * 5;
      const mesh = new THREE.Mesh(
        i % 2 === 0
          ? new THREE.TorusKnotGeometry(1.2, 0.4, 96, 16)
          : new THREE.IcosahedronGeometry(1.6, 1),
        new THREE.MeshStandardMaterial({
          color: 0x111318,
          emissive: colors[i % colors.length],
          emissiveIntensity: 2.4,
          roughness: 0.35,
          metalness: 0.6,
        }),
      );
      mesh.position.set(Math.cos(a) * r, 2 + (i % 4) * 1.6, Math.sin(a) * r);
      mesh.castShadow = true;
      this.pillars.push(mesh);
      this.scene.add(mesh);
    }

    this.camera.position.set(0, 8, 26);
    this.camera.lookAt(0, 3, 0);

    this.hitAberration = new ChromaticAberrationEffect({ radialModulation: true, modulationOffset: 0.3 });
    this.hitNoise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
    this.hitAberration.blendMode.opacity.value = 0;
    this.hitNoise.blendMode.opacity.value = 0;
  }

  enter(): void {
    this.unsubscribe = this.ctx.input.onKey((code) => {
      const map: Record<string, EffectId | undefined> = {
        Digit1: 'bloom', Digit2: 'dof', Digit3: 'outline', Digit4: 'scanline',
      };
      const id = map[code];
      if (id) this.toggle(id);
      if (code === 'Space') this.hit();
    });
  }

  exit(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /**
   * Эффекты демо. Хост складывает их в ОДИН `EffectPass` вместе с эффектами
   * тира: пять проходов по одному эффекту сводят на нет весь смысл библиотеки.
   */
  effects(): Effect[] {
    const list: Effect[] = [];
    for (const id of this.enabled) list.push(this.effectFor(id));
    // Импульсные всегда в конвейере, даже когда «выключены» (opacity = 0).
    list.push(this.hitAberration, this.hitNoise);
    return list;
  }

  fixedUpdate(dt: number): void {
    if (this.hitTimer <= 0) return;
    this.hitTimer = Math.max(0, this.hitTimer - dt);
    const k = this.hitTimer / HIT_DURATION;
    this.hitAberration.blendMode.opacity.value = k * 0.9;
    this.hitNoise.blendMode.opacity.value = k * 0.55;
  }

  update(dt: number): void {
    this.spin += dt * 0.35;
    this.pillars.forEach((m, i) => {
      m.rotation.x += dt * (0.3 + i * 0.02);
      m.rotation.y += dt * (0.4 - i * 0.015);
    });
    this.camera.position.x = Math.sin(this.spin) * 26;
    this.camera.position.z = Math.cos(this.spin) * 26;
    this.camera.lookAt(0, 3, 0);

    this.statusTimer += dt;
    if (this.statusTimer > 0.25) { this.statusTimer = 0; this.pushStatus(); }
  }

  dispose(): void {
    this.effectCache.forEach((e) => e.dispose());
    this.effectCache.clear();
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  // ─────────────────────────────────────────────────────────── управление
  private toggle(id: EffectId): void {
    if (this.enabled.has(id)) this.enabled.delete(id);
    else this.enabled.add(id);

    // Пересборка прохода измеряется и показывается: это и есть аргумент за то,
    // чтобы НЕ пересобирать конвейер в геймплее.
    const t0 = performance.now();
    this.ctx.rebuildPostFx();
    this.lastRebuildMs = performance.now() - t0;
    this.ctx.audio.playButtonClick();
  }

  private hit(): void {
    // Никакой пересборки: только анимация прозрачности уже собранных эффектов.
    this.hitTimer = HIT_DURATION;
    this.ctx.addTrauma(0.4);
    this.ctx.audio.playExplosion(0.4);
  }

  private effectFor(id: EffectId): Effect {
    const cached = this.effectCache.get(id);
    if (cached) return cached;

    let effect: Effect;
    switch (id) {
      case 'bloom':
        effect = new BloomEffect({
          intensity: 1.6, luminanceThreshold: 0.55, luminanceSmoothing: 0.25,
          kernelSize: this.ctx.tier === 'high' ? KernelSize.LARGE : KernelSize.SMALL,
        });
        break;
      case 'dof':
        effect = new DepthOfFieldEffect(this.camera, {
          focusDistance: 0.02, focalLength: 0.045, bokehScale: 4,
        });
        break;
      case 'outline': {
        const outline = new OutlineEffect(this.scene, this.camera, {
          edgeStrength: 4, pulseSpeed: 0.3, visibleEdgeColor: 0xffffff, hiddenEdgeColor: 0x22090a,
        });
        this.pillars.forEach((m) => outline.selection.add(m));
        effect = outline;
        break;
      }
      default:
        effect = new ScanlineEffect({ density: 1.1 });
        (effect as ScanlineEffect).blendMode.opacity.value = 0.25;
        break;
    }
    this.effectCache.set(id, effect);
    return effect;
  }

  private pushStatus(): void {
    const list = [...this.enabled].map((id) => LABEL[id]).join(', ') || 'нет';
    const tier = this.ctx.tier;
    this.ctx.setStatus(
      `Тир <b>${tier}</b>${tier === 'low' ? ' (композер отключён — рисуем напрямую)' : ''}`
      + ` · включено: <b>${list}</b>`
      + ` · всё это ОДИН EffectPass`
      + (this.lastRebuildMs > 0 ? ` · последняя пересборка прохода: <span class="hp">${this.lastRebuildMs.toFixed(1)} мс</span>` : '')
      + ` · импульс удара (<b>Space</b>) идёт без пересборки`,
    );
  }
}

const HIT_DURATION = 0.35;

const LABEL: Record<EffectId, string> = {
  bloom: 'bloom',
  dof: 'depth of field',
  outline: 'контур',
  scanline: 'сканлайны',
};
