# postprocessing — графические эффекты (`postprocessing@^6.39.4`)

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/` (вкладка *«✨
> Постобработка по тирам»*). Оно показывает цену пересборки прохода в
> миллисекундах и то, что импульсный эффект удара её не требует.


Библиотека pmndrs вместо `three/examples/jsm/postprocessing/*`. Ключевое отличие:
`EffectPass` **сливает несколько эффектов в один шейдер и один проход**, тогда как
цепочка `ShaderPass` из примеров three.js делает по полноэкранному проходу на каждый
эффект. На мобильном GPU это разница между 60 и 25 FPS.

Свои `UnrealBloomPass`-подобные цепочки не пишем — это ровно тот случай, где готовое
решение и быстрее, и корректнее (правильный sRGB, единый AA, депт-буфер).

---

## 1. Базовая настройка

```typescript
import { WebGLRenderer, HalfFloatType, NoToneMapping, SRGBColorSpace } from 'three';
import {
  EffectComposer, RenderPass, EffectPass,
  BloomEffect, VignetteEffect, SMAAEffect, ToneMappingEffect,
  BlendFunction, KernelSize, ToneMappingMode,
} from 'postprocessing';

const renderer = new WebGLRenderer({
  powerPreference: 'high-performance',
  antialias: false,     // AA делает SMAAEffect; renderer.antialias с композером бесполезен
  stencil: false,
  depth: false,
});
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = NoToneMapping;         // тонмаппинг — последним эффектом

const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType });
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new EffectPass(
  camera,
  new BloomEffect({ intensity: 0.9, luminanceThreshold: 0.75, luminanceSmoothing: 0.2, kernelSize: KernelSize.MEDIUM }),
  new VignetteEffect({ offset: 0.32, darkness: 0.55 }),
  new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
  new SMAAEffect(),
));

// в кадре:
composer.render();          // ВМЕСТО renderer.render(scene, camera)
// на ресайзе:
composer.setSize(width, height);
```

Обязательные детали, каждая из которых была багом:

1. **`renderer.render()` больше не вызывается.** Оставленный вместе с `composer.render()`
   он рисует сцену дважды: −40 % FPS и мерцание.
2. **`antialias: false`.** MSAA контекста не работает с рендер-таргетами композера, но
   продолжает стоить памяти. AA даёт `SMAAEffect` (дёшево) или
   `composer.multisampling = 2..4` (WebGL2, дороже).
3. **`toneMapping = NoToneMapping` на рендерере.** Иначе цвет сжимается в `[0,1]` в
   начале конвейера и bloom не за что зацепиться — эффект «есть, но не светится».
4. **`HalfFloatType`** нужен для HDR-подобного bloom. На очень слабых устройствах —
   вернуть значение по умолчанию (`UnsignedByteType`) вместе с отключением bloom.
5. **`composer.setSize()`, а не только `renderer.setSize()`.** Забытый вызов даёт
   мыло после поворота экрана и после выхода из полноэкранного режима
   (`CRITICAL_RULES` §35).
6. **Один `EffectPass` на все эффекты.** Пять `EffectPass` по одному эффекту = пять
   проходов и потерянный смысл библиотеки. Отдельный проход нужен только тем эффектам,
   которым он требуется по природе (`DepthOfFieldEffect`, `GodRaysEffect`,
   `SelectiveBloomEffect`).

---

## 2. Бюджет по тирам устройств

Постобработка — первое, что режется при просадке. Интеграция с адаптивным качеством
(`knowledge/threejs/adaptive_quality.md`): **набор эффектов пересобирается на смене
тира, а не включается «навсегда»**.

| Тир | Эффекты | Комментарий |
|---|---|---|
| `low` (слабый телефон) | нет композера вообще, `renderer.render()` | ветка должна существовать и быть протестирована |
| `medium` | `SMAAEffect` + `VignetteEffect` | почти бесплатно, картинка уже «дороже» |
| `high` | `+ BloomEffect(KernelSize.MEDIUM)` + `ToneMappingEffect` | базовый вид игры |
| `ultra` (десктоп) | `+ DepthOfField` / `ChromaticAberration` / `Outline` | только там, где это часть арт-дирекшена |

```typescript
function rebuildComposer(tier: Tier): void {
  composer.removeAllPasses();
  composer.addPass(new RenderPass(scene, camera));
  const effects: Effect[] = [];
  if (tier !== 'low') effects.push(new VignetteEffect({ darkness: 0.5 }), new SMAAEffect());
  if (tier === 'high' || tier === 'ultra') effects.push(new BloomEffect({ intensity: 0.8 }));
  if (effects.length) composer.addPass(new EffectPass(camera, ...effects));
}
```

Пересборка делается **до** `render()` того кадра, в котором применяется
(`CRITICAL_RULES` §54), и старые эффекты диспоузятся (`removeAllPasses()` не
освобождает GPU-ресурсы сам — `pass.dispose()`).

---

## 3. Эффекты под геймплейные задачи

| Задача | Эффект |
|---|---|
| Неон, лава, выстрелы, «сочность» | `BloomEffect` (порог `luminanceThreshold` 0.7–0.9) |
| Подсветка выделенного юнита / интерактива | `OutlineEffect` + `selection.add(mesh)` |
| Только один объект светится (артефакт, портал) | `SelectiveBloomEffect` |
| Фокус на герое, размытый фон в катсцене | `DepthOfFieldEffect` (дорого, только десктоп) |
| Удар, оглушение, критический урон | `ChromaticAberrationEffect` + `NoiseEffect` на 0.2 с |
| Ретро/CRT арт-дирекшн | `ScanlineEffect` + `NoiseEffect` |
| Лучи солнца сквозь листву | `GodRaysEffect` (свой проход, дорого) |

Импульсные эффекты (удар, урон) **не пересобирают проход**: держим эффект в конвейере
постоянно и анимируем его `blendMode.opacity.value` от 0 — пересборка `EffectPass` во
время боя компилирует шейдер и даёт фриз на пол-секунды.

```typescript
hitEffect.blendMode.opacity.value = 0;      // создан один раз при старте
function onPlayerHit() { tween(hitEffect.blendMode.opacity, { value: 0.8 }, 0.06).then(fadeOut); }
```

---

## 4. Взаимодействие с остальным стеком

* **Bloom и `InstancedMesh`-орда** дружат: bloom работает по экрану и не зависит от
  количества объектов. Это дешёвый способ сделать 800 ECS-врагов «дорогой» картинкой.
* **`OutlineEffect` в стратегии/TD** — готовая замена дублирующим «подсветочным» мешам:
  меньше draw call'ов и корректная работа с перекрытием.
* **Депт-зависимые эффекты** (`DepthOfField`, `GodRays`, SSAO) требуют буфера глубины;
  `depth: false` в конструкторе рендерера им не мешает (композер держит свой), но
  прозрачные объекты в глубину не пишут — туман и DoF их «не видят». Это ограничение,
  а не баг.
* **Мобильная политика** из `knowledge/threejs/mobile_shaders.md` остаётся в силе: SSAO
  и DoF на телефоне не включаются никогда, bloom — только с `KernelSize.SMALL/MEDIUM`.
