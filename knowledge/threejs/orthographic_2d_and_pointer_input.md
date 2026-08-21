# 2D на Three.js: ортографическая камера, указатель, сплайны, перетаскивание

> ⚠️ **Статус: выпуск 2D-игр временно отключён** (`config/factory.yaml` →
> `pipeline.enable_2d: false`). Концепт, запрошенный как 2D, поднимается до 3D.
> Файл остаётся активным знанием: ортокамера и перевод «указатель → мир» нужны
> в 3D-играх для миникарт, слоёв UI и жестового ввода. Прежние рецепты на
> PixiJS не удалены — они лежат в `knowledge_archive/pixijs/` и не загружаются
> фабрикой; порядок возврата описан в `knowledge_archive/README.md`.

Когда 2D включат обратно, «двумерный» проект — это **та же сцена с
ортографической камерой**, а не второй рендерер. Практическая выгода: один
бандл, одна система качества, тот же Rapier для физики, та же постобработка, тот же
код тач-управления и Playgama Bridge. Плата — нужно один раз правильно настроить
камеру и перевод координат; всё это ниже.

Файл заменяет прежние рецепты на PixiJS (рисование пути, слайсер, доска улик).

---

## 1. Ортографическая камера, привязанная к «игровым единицам»

Ошибка №1 в 2D-на-three — считать в пикселях. Считаем в **игровых единицах** и держим
фиксированную видимую высоту мира; ширина следует за соотношением сторон.

```typescript
const WORLD_HEIGHT = 20;           // сколько единиц влезает по вертикали

function makeCamera(w: number, h: number): THREE.OrthographicCamera {
  const aspect = w / h;
  const halfH = WORLD_HEIGHT / 2;
  const halfW = halfH * aspect;
  const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, -100, 100);
  cam.position.set(0, 0, 10);
  return cam;
}

function onResize(w: number, h: number): void {
  const halfH = WORLD_HEIGHT / 2, halfW = halfH * (w / h);
  cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;
  cam.updateProjectionMatrix();          // без этого ничего не изменится
  renderer.setSize(w, h, false);
  composer?.setSize(w, h);
}
```

* **Фиксируем высоту, а не ширину**: на узком телефоне игрок видит столько же по
  вертикали, сколько на десктопе, — иначе вертикальный геймплей ломается на мобильных.
* Критичный по геймплею контент держим внутри «безопасного» прямоугольника самого
  узкого поддерживаемого аспекта (9:20), а фон рисуем шире.
* Порядок отрисовки в 2D задаётся `z` или `renderOrder` + `material.depthTest = false`
  для UI-слоя. Смешивать оба подхода в одной сцене — гарантированные «пропадающие»
  спрайты.

---

## 2. Указатель → мир

Единственный корректный перевод экранных координат в мир идёт через
нормализованные координата устройства (NDC) и `Raycaster`. «Ручная» формула
`x / width * worldWidth` ломается при пиксель-рейшио, безопасных зонах и после выхода
из полноэкранного режима.

```typescript
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);   // плоскость игры z=0
const hit = new THREE.Vector3();

function pointerToWorld(ev: PointerEvent, out: THREE.Vector3): THREE.Vector3 {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(plane, out);
  return out;
}
```

`getBoundingClientRect()` вместо `window.innerWidth` — обязательно: канвас в платформенном
iframe не занимает всё окно, и на баннере VK/OK смещение достигает десятков пикселей.

Ввод строим на **Pointer Events** с `setPointerCapture` и учётом `pointerId`
(`CRITICAL_RULES` §56–59, `knowledge/ux/touch_controls.md`). `mousedown`/`touchstart`
в новых проектах не используем.

---

## 3. Рисование пути жестом и движение по сплайну

Сглаживание — `THREE.CatmullRomCurve3`, свою реализацию Catmull-Rom писать не нужно.
Кривая сразу даёт равномерную выборку точек и касательную для поворота юнита.

```typescript
const raw: THREE.Vector3[] = [];
let curve: THREE.CatmullRomCurve3 | null = null;

function onPointerMove(ev: PointerEvent): void {
  if (!drawing) return;
  const p = pointerToWorld(ev, hit).clone();
  const last = raw[raw.length - 1];
  if (!last || last.distanceTo(p) > 0.25) {   // прореживание: без него 400 точек за жест
    raw.push(p);
    rebuild();
  }
}

function rebuild(): void {
  if (raw.length < 2) return;
  curve = new THREE.CatmullRomCurve3(raw, false, 'centripetal', 0.5);
  const pts = curve.getSpacedPoints(Math.min(256, raw.length * 8));
  pathLine.geometry.dispose();
  pathLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
}
```

`'centripetal'` — не косметика: `'catmullrom'` при близко лежащих точках даёт петли
(«юнит уезжает вбок и возвращается»), и жест пальцем как раз даёт близкие точки.

Движение по пути с постоянной скоростью и корректным поворотом:

```typescript
let travelled = 0;
function follow(dt: number): void {
  if (!curve) return;
  const len = curve.getLength();
  travelled = Math.min(travelled + speed * dt, len);
  const t = travelled / len;
  unit.position.copy(curve.getPointAt(t));            // getPointAt — по длине дуги
  const tan = curve.getTangentAt(t);
  unit.rotation.z = Math.atan2(tan.y, tan.x);
}
```

`getPointAt`/`getTangentAt` (по длине), а не `getPoint`/`getTangent` (по параметру):
иначе юнит ускоряется на прямых и ползёт на поворотах.

Для «толстой» линии пути (`Line` игнорирует `linewidth` почти везде) —
`three/examples/jsm/lines/Line2` или `TubeGeometry` по той же кривой.

---

## 4. Свайп-слайсер (разрезание)

Проверяем пересечение отрезка свайпа с окружностями цели — это дешевле и надёжнее, чем
рейкаст по мешам, и корректно работает на быстром движении пальца (когда цель между
кадрами «перепрыгивает» палец).

```typescript
function segmentHitsCircle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, r: number): boolean {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(c.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  return a.clone().addScaledVector(ab, t).distanceTo(c) <= r;
}
```

Скорость свайпа (`|b−a| / dt`) — это и есть порог «разрез засчитан»: медленное
проведение пальцем не должно резать, иначе игрок случайно рубит бонусы. Хвост клинка —
затухающая полоса из последних 8–12 точек, обновляемая на месте в `BufferAttribute`
(без пересоздания геометрии каждый кадр).

---

## 5. Перетаскивание объектов и «доска» связей

```typescript
let dragged: THREE.Object3D | null = null;
const grabOffset = new THREE.Vector3();

canvas.addEventListener('pointerdown', (ev) => {
  pointerToWorld(ev, hit);
  raycaster.setFromCamera(ndc, camera);
  const first = raycaster.intersectObjects(draggables, false)[0];
  if (!first) return;
  dragged = first.object;
  grabOffset.copy(dragged.position).sub(hit);
  dragged.renderOrder = ++topOrder;              // поднять «карточку» над остальными
  canvas.setPointerCapture(ev.pointerId);        // палец не теряется у края
});

canvas.addEventListener('pointermove', (ev) => {
  if (!dragged) return;
  dragged.position.copy(pointerToWorld(ev, hit)).add(grabOffset);
});

canvas.addEventListener('pointerup', (ev) => {
  canvas.releasePointerCapture(ev.pointerId);
  dragged = null;
});
```

Связующая «нить» с провисанием между двумя карточками — квадратичная кривая, третья
точка которой опущена пропорционально расстоянию:

```typescript
const mid = a.clone().add(b).multiplyScalar(0.5);
mid.y -= a.distanceTo(b) * 0.18;                       // провис
const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
line.geometry.setFromPoints(curve.getPoints(16));
```

**Текст карточек рисуем DOM-слоем, а не в канвасе.** Текстура с текстом — это мыло на
разных DPI, отдельная перерисовка на каждой смене языка и провал по локализации
(`CRITICAL_RULES` §39). Абсолютно позиционированный `<div>`, координаты которого
получены проекцией `object.position.project(camera)`, даёт чёткий, выделяемый (там, где
это разрешено) и переводимый текст:

```typescript
const v = obj.position.clone().project(camera);
el.style.transform = `translate(-50%,-50%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
```

Слой DOM-подписей обновляем **после** камеры и не чаще кадра; при большом количестве
подписей — только для видимых (`v.z < 1`).

---

## 6. Много спрайтов: инстансинг вместо тысячи мешей

Аналог «sprite batching» из 2D-движков — `InstancedMesh` с одной плоскостью и атласом:

```typescript
const quad = new THREE.PlaneGeometry(1, 1);
const mesh = new THREE.InstancedMesh(quad, atlasMaterial, MAX_SPRITES);
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
mesh.frustumCulled = false;
// смена кадра анимации — через instanced-атрибут UV-офсета, не через смену материала
```

Правила те же, что для 3D-орды (`knowledge/stack/bitecs.md` §3): один материал, один
атлас, `count` вместо скрытия нулевой матрицей, обновление `needsUpdate` один раз в
кадр. Прозрачные спрайты сортируются по `z`: включённый `depthWrite` на полупрозрачном
материале даёт чёрные прямоугольники вокруг спрайтов.
