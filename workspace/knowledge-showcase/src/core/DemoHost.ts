import * as THREE from 'three';
import type { Demo, DemoContext } from './Demo';
import { PostFx, detectTier, pixelRatioFor, type QualityTier } from './Quality';
import { InputHub } from '../input/InputHub';
import { AudioManager } from '../audio/AudioManager';

type DemoFactory = () => Demo;

interface Slot {
  id: string;
  factory: DemoFactory;
  instance: Demo | null;
  ready: boolean;
}

const TICK = 1 / 60;
const MAX_SUBSTEPS = 4;

/**
 * Хост стенда: рендерер, звук, ввод, качество и ЕДИНЫЙ порядок кадра.
 *
 * Порядок из knowledge/stack/README.md §2 живёт здесь и только здесь — демо не
 * имеет своего requestAnimationFrame. Логика идёт фиксированным шагом 1/60 с
 * потолком подшагов (CRITICAL_RULES S5), визуал интерполируется по `alpha`.
 */
export class DemoHost {
  readonly renderer: THREE.WebGLRenderer;
  readonly audio = new AudioManager();
  readonly input: InputHub;

  private readonly slots = new Map<string, Slot>();
  private readonly postFx: PostFx;
  private current: Demo | null = null;
  private currentId = '';
  private tier: QualityTier = detectTier();

  private acc = 0;
  private last = performance.now();
  private trauma = 0;
  private readonly shakeOffset = new THREE.Vector3();
  private readonly shakeEuler = new THREE.Euler();
  private switching = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      // AA даёт SMAAEffect: MSAA контекста не работает с рендер-таргетами
      // композера, но продолжает стоить памяти (stack/postprocessing.md §1).
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = this.tier !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(pixelRatioFor(this.tier));

    this.input = new InputHub(canvas);
    this.postFx = new PostFx(this.renderer);

    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  register(id: string, factory: DemoFactory): void {
    this.slots.set(id, { id, factory, instance: null, ready: false });
  }

  get demo(): Demo | null {
    return this.current;
  }

  get activeId(): string {
    return this.currentId;
  }

  listDemos(): Demo[] {
    // Заголовки вкладок нужны до загрузки: инстанцируем «пустышку» лениво,
    // но конструктор демо обязан быть дешёвым — вся тяжесть живёт в init().
    return [...this.slots.values()].map((s) => (s.instance ??= s.factory()));
  }

  async switchTo(id: string): Promise<void> {
    if (this.switching || id === this.currentId) return;
    const slot = this.slots.get(id);
    if (!slot) throw new Error(`Unknown demo: ${id}`);
    this.switching = true;

    try {
      this.current?.exit?.();
      this.input.clearSubscribers();
      this.input.releaseAll();
      this.audio.stopEngine();

      const demo = (slot.instance ??= slot.factory());
      if (!slot.ready) {
        await demo.init(this.context());
        slot.ready = true;
      }

      this.current = demo;
      this.currentId = id;
      this.resizeCurrent();
      this.rebuildPostFx();
      demo.enter?.();
      // Долг по времени за загрузку не отдаём в физику: иначе первый кадр
      // прокручивает секунды симуляции разом.
      this.acc = 0;
      this.last = performance.now();
    } finally {
      this.switching = false;
    }
  }

  setTier(tier: QualityTier): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.renderer.setPixelRatio(pixelRatioFor(tier));
    this.renderer.shadowMap.enabled = tier !== 'low';
    this.rebuildPostFx();
    this.onResize();
  }

  get qualityTier(): QualityTier {
    return this.tier;
  }

  start(): void {
    requestAnimationFrame(this.frame);
  }

  // ─────────────────────────────────────────────────────────────── внутреннее
  private context(): DemoContext {
    return {
      renderer: this.renderer,
      audio: this.audio,
      input: this.input,
      tier: this.tier,
      addTrauma: (a: number) => { this.trauma = Math.min(1, this.trauma + a); },
      setStatus: (html: string) => {
        const el = document.getElementById('demo-status');
        if (el) el.innerHTML = html;
      },
      rebuildPostFx: () => this.rebuildPostFx(),
    };
  }

  private rebuildPostFx(): void {
    if (!this.current) return;
    this.postFx.build(this.tier, this.current.scene, this.current.camera, this.current.effects?.() ?? []);
    this.postFx.setSize(window.innerWidth, window.innerHeight);
  }

  private readonly onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.postFx.setSize(w, h);
    this.resizeCurrent();
  };

  private resizeCurrent(): void {
    const demo = this.current;
    if (!demo) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (demo.resize) {
      demo.resize(w, h);
    } else if ((demo.camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const cam = demo.camera as THREE.PerspectiveCamera;
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
  }

  private readonly frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    const demo = this.current;
    if (!demo || this.switching) { this.last = now; return; }

    // Клампим dt: скрытая вкладка не должна прокручивать симуляцию разом.
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;

    // 1-5. Логика с фиксированным шагом.
    if (demo.fixedUpdate) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= TICK && steps < MAX_SUBSTEPS) {
        demo.fixedUpdate(TICK);
        this.acc -= TICK;
        steps++;
      }
      if (steps === MAX_SUBSTEPS) this.acc = 0;   // не смогли догнать — сбрасываем долг
    }

    // 6-7. Кадровое обновление: интерполяция, VFX, камера.
    demo.update(dt, demo.fixedUpdate ? this.acc / TICK : 0);

    // 8. Тряска камеры поверх того, что поставило демо.
    this.applyShake(demo.camera, dt);

    // 9. Постобработка вместо renderer.render() — вызывать оба значит рисовать дважды.
    if (!this.postFx.render()) {
      this.renderer.render(demo.scene, demo.camera);
    }
    this.restoreShake(demo.camera);
    this.input.endFrame();
  };

  private applyShake(camera: THREE.Camera, dt: number): void {
    if (this.trauma <= 0.001) { this.shakeOffset.set(0, 0, 0); return; }
    const s = this.trauma * this.trauma;              // нелинейный спад
    this.shakeOffset.set(
      (Math.random() * 2 - 1) * 0.25 * s,
      (Math.random() * 2 - 1) * 0.25 * s,
      0,
    );
    this.shakeEuler.set(
      (Math.random() * 2 - 1) * 0.05 * s,
      (Math.random() * 2 - 1) * 0.05 * s,
      0,
    );
    camera.position.add(this.shakeOffset);
    camera.rotation.x += this.shakeEuler.x;
    camera.rotation.y += this.shakeEuler.y;
    this.trauma = Math.max(0, this.trauma - dt * 2.2);
  }

  private restoreShake(camera: THREE.Camera): void {
    if (this.shakeOffset.lengthSq() === 0) return;
    // Возвращаем камеру: иначе смещение накапливается кадр за кадром и камера
    // уезжает — классический баг «после взрыва камера улетела».
    camera.position.sub(this.shakeOffset);
    camera.rotation.x -= this.shakeEuler.x;
    camera.rotation.y -= this.shakeEuler.y;
    this.shakeOffset.set(0, 0, 0);
    this.shakeEuler.set(0, 0, 0);
  }
}
