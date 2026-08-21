import * as THREE from 'three';
import type { Effect } from 'postprocessing';
import type { AudioManager } from '../audio/AudioManager';
import type { InputHub } from '../input/InputHub';
import type { QualityTier } from './Quality';

/**
 * Контекст, который стенд выдаёт каждому демо. Демо не создаёт свой рендерер,
 * свой цикл и свой звук — это общая инфраструктура (см. knowledge/stack/README.md §2).
 */
export interface DemoContext {
  readonly renderer: THREE.WebGLRenderer;
  readonly audio: AudioManager;
  readonly input: InputHub;
  readonly tier: QualityTier;
  /** Тряска камеры: 0..1, спадает нелинейно. */
  addTrauma(amount: number): void;
  /** Строка в HUD под заголовком (обновляется по требованию демо). */
  setStatus(html: string): void;
  /**
   * Пересобрать конвейер постобработки из `demo.effects()`.
   *
   * Вызывается ТОЛЬКО когда набор эффектов действительно изменился: пересборка
   * `EffectPass` компилирует шейдер и даёт фриз. Импульсные эффекты (удар, урон)
   * держатся в конвейере постоянно и анимируются через `blendMode.opacity`
   * (knowledge/stack/postprocessing.md §3).
   */
  rebuildPostFx(): void;
}

/**
 * Одна вкладка стенда.
 *
 * У каждого демо СВОЯ сцена и СВОЯ камера. Общая сцена с переключением
 * `visible` — источник половины багов старого стенда: забытый флаг оставлял
 * объекты предыдущего режима в кадре, а общий свет настраивался под грузовик.
 */
export interface Demo {
  readonly id: string;
  /** Подпись вкладки: [ru, en]. */
  readonly title: readonly [string, string];
  /** Подсказка по управлению: [ru, en]. HTML разрешён. */
  readonly hint: readonly [string, string];
  /** Категория демо для каталога: [ru, en]. */
  readonly category?: readonly [string, string];
  /** Ключевые слова для поиска. */
  readonly tags?: readonly string[];

  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

  /** Тяжёлая загрузка (WASM, генерация геометрии). Вызывается один раз, лениво. */
  init(ctx: DemoContext): Promise<void> | void;

  /** Вкладка стала активной. Сюда — сброс состояния и подписки на ввод. */
  enter?(): void;
  /** Вкладка ушла в фон. Сюда — остановка звуков и отписки. */
  exit?(): void;

  /** Логика с фиксированным шагом 1/60. Здесь физика, ИИ, фрейм-дата. */
  fixedUpdate?(dt: number): void;
  /** Кадровое обновление: интерполяция, камера, VFX. `alpha` — доля тика. */
  update(dt: number, alpha: number): void;

  /** Эффекты постобработки, которые добавляет само демо (поверх общих по тиру). */
  effects?(): Effect[];

  /** Реакция на изменение размера. По умолчанию хост чинит аспект сам. */
  resize?(w: number, h: number): void;

  dispose(): void;
}

/** Утилита: удалить и освободить всё поддерево. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
  root.removeFromParent();
}
