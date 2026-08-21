import * as THREE from 'three';
import {
  BloomEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect, VignetteEffect,
  ToneMappingEffect, ToneMappingMode, KernelSize, type Effect,
} from 'postprocessing';

export type QualityTier = 'low' | 'medium' | 'high';

/**
 * Тир качества и сборка конвейера постобработки.
 *
 * knowledge/stack/postprocessing.md §2: набор эффектов ПЕРЕСОБИРАЕТСЯ при смене
 * тира, а на `low` композера нет вообще — рисуем напрямую. Смена применяется
 * ДО render() того кадра, в котором она вступает в силу (CRITICAL_RULES §54).
 */
export function detectTier(): QualityTier {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency ?? 4;
  if (mobile && cores <= 4) return 'low';
  if (mobile) return 'medium';
  return 'high';
}

export function pixelRatioFor(tier: QualityTier): number {
  const dpr = window.devicePixelRatio || 1;
  if (tier === 'low') return Math.min(dpr, 1);
  if (tier === 'medium') return Math.min(dpr, 1.35);
  return Math.min(dpr, 1.75);
}

export class PostFx {
  composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private effectPass: EffectPass | null = null;
  private owned: Effect[] = [];

  constructor(private renderer: THREE.WebGLRenderer) {}

  /**
   * Собирает конвейер под сцену/камеру демо. `extra` — эффекты самого демо.
   * Возвращает false, если постобработка отключена (тир `low`).
   */
  build(
    tier: QualityTier,
    scene: THREE.Scene,
    camera: THREE.Camera,
    extra: Effect[] = [],
  ): boolean {
    this.dispose();
    if (tier === 'low' && extra.length === 0) return false;

    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    const effects: Effect[] = [...extra];
    if (tier !== 'low') {
      effects.push(new VignetteEffect({ offset: 0.3, darkness: 0.5 }));
      effects.push(new SMAAEffect());
    }
    if (tier === 'high') {
      effects.push(
        new BloomEffect({
          intensity: 0.75,
          luminanceThreshold: 0.72,
          luminanceSmoothing: 0.22,
          kernelSize: KernelSize.MEDIUM,
        }),
      );
      effects.push(new ToneMappingEffect({ mode: ToneMappingMode.AGX }));
    }

    // Один EffectPass на все эффекты: пять проходов по одному эффекту сводят
    // на нет весь смысл библиотеки (knowledge/stack/postprocessing.md §1).
    this.effectPass = new EffectPass(camera, ...effects);
    this.composer.addPass(this.effectPass);
    this.owned = effects.filter((e) => !extra.includes(e));
    return true;
  }

  setSize(w: number, h: number): void {
    this.composer?.setSize(w, h);
  }

  render(): boolean {
    if (!this.composer) return false;
    this.composer.render();
    return true;
  }

  dispose(): void {
    this.effectPass?.dispose();
    this.renderPass?.dispose();
    this.owned.forEach((e) => e.dispose());
    this.composer?.dispose();
    this.composer = null;
    this.renderPass = null;
    this.effectPass = null;
    this.owned = [];
  }
}
