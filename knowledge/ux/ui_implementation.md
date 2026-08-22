# UI Implementation over a Three.js Canvas

The design system (`ui_design_system.md`) says what the interface must look like.
This file is how it is built: the DOM layer stack over the canvas, the screen
router, HUD updates that do not cost frames, and the four traps that break an
overlay UI on a phone.

No UI framework. A game overlay is a handful of screens and a HUD; React, its
reconciler and its bundle cost buy nothing here, and every portal counts the
bundle. Plain DOM, one CSS file of tokens, small component functions.

---

## 1. The layer stack, and the bug it prevents

The single most common defect in a generated game: a full-screen overlay `div`
sits above the canvas and silently eats every gameplay pointer, so the player
cannot steer. The rule is absolute — **containers never receive pointer events,
only leaf interactive elements do.**

```html
<div id="app">
  <canvas id="game"></canvas>          <!-- z: world -->
  <div id="hud"     class="layer"></div>   <!-- z: hud   — read-only, никогда не кликается -->
  <div id="touch"   class="layer"></div>   <!-- z: touch — тач-управление -->
  <div id="screens" class="layer"></div>   <!-- z: screen — меню, гараж, результаты -->
  <div id="modals"  class="layer"></div>   <!-- z: modal -->
  <div id="toasts"  class="layer"></div>   <!-- z: toast -->
</div>
```

```css
.layer {
  position: fixed; inset: 0;
  pointer-events: none;               /* контейнер прозрачен для ввода */
  padding: var(--safe-t) var(--safe-r) var(--safe-b) var(--safe-l);
}
.layer > * { pointer-events: none; }
.layer button, .layer .interactive { pointer-events: auto; }   /* только листья */

#hud     { z-index: var(--z-hud);   }
#touch   { z-index: var(--z-touch); }
#screens { z-index: var(--z-screen);}
#modals  { z-index: var(--z-modal); }
#toasts  { z-index: var(--z-toast); }
```

`#hud` never gets `pointer-events: auto` anywhere — a HUD is read-only by
definition. Pause and settings are buttons, and buttons live on the screen layer.

A screen that is meant to block gameplay (a menu, a pause overlay) turns its own
root back on explicitly: `.screen--blocking { pointer-events: auto; }`. That is a
deliberate, per-screen decision, never the default.

## 2. `theme.css` is the only place with values

One file defines every token from the design system and is imported once in
`main.ts`. Component files contain layout and states, never literals.

```
src/ui/
├── theme.css            # токены: цвета, шрифты, шкала отступов, длительности, слои
├── UiRoot.ts            # создаёт слои, меряет вьюпорт, держит роутер
├── ScreenRouter.ts      # конечный автомат экранов + переходы
├── Hud.ts               # привязка к узлам и обновление по изменению
├── components/          # Button, Panel, Modal, Meter, Stat, Toast, ...
├── screens/             # MainMenu.ts, Gameplay.ts, Results.ts, Settings.ts
└── icons.ts             # один SVG-спрайт, <use href="#icon-*">
```

A grep for `#[0-9a-fA-F]{6}` outside `theme.css` should return nothing. That is
the cheapest possible check that the design system is actually in force, and it
is worth running as part of the build.

## 3. Screen router: one visible screen, one transition

```typescript
export type ScreenId = 'boot' | 'menu' | 'game' | 'pause' | 'results' | 'settings'

export class ScreenRouter {
    #current: ScreenId | null = null
    #stack: ScreenId[] = []
    #views = new Map<ScreenId, ScreenView>()

    async go(id: ScreenId, opts: { replace?: boolean } = {}) {
        if (id === this.#current) return
        const prev = this.#current ? this.#views.get(this.#current) : null
        const next = this.#views.get(id)
        if (!next) throw new Error(`unknown screen ${id}`)

        if (prev) { prev.root.classList.add('is-leaving'); await wait(DUR_SCREEN) }
        prev?.hide()

        if (!opts.replace && this.#current) this.#stack.push(this.#current)
        this.#current = id
        next.show()
        next.root.classList.remove('is-leaving')
        // Фокус переносится на экран, иначе клавиатурная навигация остаётся
        // на кнопке уже скрытого меню.
        next.root.querySelector<HTMLElement>('[autofocus], button')?.focus()
    }

    back() { const prev = this.#stack.pop(); if (prev) this.go(prev, { replace: true }) }
}
```

Rules the router enforces so screens cannot drift apart:

- Exactly one screen is visible. Hiding is `display: none` after the exit
  transition — an invisible-but-present screen keeps its buttons tappable.
- Screens do not navigate each other directly; they emit intents and the router
  decides. Otherwise the back path becomes unrepresentable.
- Entering `pause` or any modal pauses the game clock and the audio bus; leaving
  resumes them. This is the same pause used by the ad and visibility handlers —
  one implementation, not three.
- The touch layer is visible only on `game` and is **reset** when hidden (see
  `touch_controls.md`): a held throttle otherwise survives into the menu.

### Меню не гасит сцену

Экран меню — это слой над работающим канвасом, а не замена ему. Заливка на весь
экран (`background` без прозрачности на корне экрана или полноэкранная
`rgba(...)`) закрывает игру ровно в тот момент, когда игрок решает, играть ли:

```css
/* Экран меню: сцена видна, подложка только под содержимым */
.screen            { background: none; }
.screen__panel     { background: var(--color-panel-glass); }   /* полупрозрачная */
```

Что делает роутер при входе в меню:

- **не останавливает рендер**: цикл продолжает крутиться, иначе за меню
  застывший кадр, который выдаёт себя на первом же повороте телефона;
- **снижает нагрузку**: симуляция и физика на паузе или на пониженной частоте,
  частицы и тени — на минимум, `renderer.setPixelRatio` на ступень ниже. Меню
  не должно греть телефон;
- **ставит свою камеру**: медленный облёт, дрейф или проезд по сцене из
  `ART_DIRECTION.md` («Сцена за меню»). Камера меню и камера игры — два разных
  объекта, переключение между ними идёт одним переходом;
- **возвращает всё обратно** при выходе в игру, включая `setPixelRatio`.

На слабом устройстве (или при `prefers-reduced-motion: reduce`) движение камеры
меню останавливается — но сцена остаётся видимой. Подменять её статичной
картинкой не нужно: кадр той же сцены дешевле любого загруженного изображения.

## 4. HUD: bind once, write on change

The HUD is the only UI touched every frame, so it is the only place where DOM
cost matters. Rebuilding markup per frame — `innerHTML = ...`, or recreating
elements — parses HTML, drops focus, and produces a measurable frame spike on a
mid-range phone.

```typescript
export class Hud {
    #score = document.querySelector<HTMLElement>('#hud-score')!
    #health = document.querySelector<HTMLElement>('#hud-health-fill')!
    #last = { score: -1, health: -1 }

    update(s: { score: number; health: number }) {
        if (s.score !== this.#last.score) {
            this.#score.textContent = String(s.score)   // textContent, не innerHTML
            this.#last.score = s.score
        }
        if (s.health !== this.#last.health) {
            // transform, а не width: width пересчитывает раскладку всего слоя
            this.#health.style.transform = `scaleX(${clamp01(s.health)})`
            this.#last.health = s.health
        }
    }
}
```

- Cache the nodes once in the constructor. `querySelector` in the loop is a tree
  walk per frame.
- Compare against the last written value and skip the write. Most frames change
  nothing.
- Meters animate with `transform: scaleX()` on a fill element with
  `transform-origin: left`, never with `width`.
- Never read layout (`offsetWidth`, `getBoundingClientRect`) inside the render
  loop — it forces a synchronous reflow and stalls the frame.
- Numbers get `font-variant-numeric: tabular-nums` and a fixed slot, or the row
  reflows on every tick.

## 5. Viewport, safe area and the banner reserve

`100vh` is wrong on mobile browsers: it includes the collapsing URL bar, so the
bottom row of buttons sits under the chrome. Measure instead, and publish the
result as tokens.

```typescript
function measureViewport() {
    const vv = window.visualViewport
    const h = vv ? vv.height : window.innerHeight
    const w = vv ? vv.width : window.innerWidth
    document.documentElement.style.setProperty('--vp-h', `${h}px`)
    document.documentElement.style.setProperty('--vp-w', `${w}px`)
}

// Размер приходит не сразу: после поворота, выхода из фуллскрина и закрытия
// рекламы первое значение часто устаревшее. Отсюда осадка в два кадра.
let settle = 0
function onResize() {
    clearTimeout(settle)
    settle = window.setTimeout(() => requestAnimationFrame(() =>
        requestAnimationFrame(measureViewport)), 120)
}
window.visualViewport?.addEventListener('resize', onResize)
window.addEventListener('orientationchange', onResize)
document.addEventListener('fullscreenchange', onResize)
```

Safe-area tokens are set once in CSS and consumed by every layer:

```css
:root {
  --safe-t: env(safe-area-inset-top,  0px);
  --safe-b: calc(env(safe-area-inset-bottom, 0px) + var(--banner-h, 0px));
  --safe-l: env(safe-area-inset-left, 0px);
  --safe-r: env(safe-area-inset-right,0px);
}
```

`--banner-h` is written from the measured sticky-banner height (see
`../playgama/banners_and_layout.md`). Because the bottom inset already folds it
in, no screen needs to know a banner exists — the reserve appears everywhere at
once.

## 6. Components without a framework

A component is a function that builds an element and returns a small handle. No
templates, no virtual DOM, no string HTML for anything containing player data.

```typescript
export function Button(o: {
    label: string
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    icon?: IconId
    onPress: () => void
}) {
    const el = document.createElement('button')
    el.className = `btn btn--${o.variant ?? 'secondary'}`
    el.type = 'button'
    if (o.icon) el.append(icon(o.icon))
    el.append(text(o.label))              // textContent — не innerHTML с данными игрока
    // Клик, а не pointerdown: click срабатывает и от клавиатуры, и от скринридера,
    // и не выстреливает, когда палец уехал с кнопки.
    el.addEventListener('click', () => { if (!el.disabled) o.onPress() })
    return {
        el,
        setLoading(v: boolean) { el.classList.toggle('is-loading', v); el.disabled = v },
        setDisabled(v: boolean) { el.disabled = v },
    }
}
```

- `<button type="button">`, not `<div onclick>`: a real button is focusable,
  keyboard-activatable and announced correctly, for free.
- `touch-action: manipulation` on every button removes the 300 ms tap delay
  without disabling scroll elsewhere.
- The pressed feel comes from CSS (`:active { transform: scale(.97) }`), not from
  a JS handler.
- Async actions call `setLoading(true)` before awaiting the bridge and clear it in
  a `finally`. The three-taps-on-a-slow-ad-button bug is exactly this missing.
- Never interpolate player-supplied strings (names from leaderboards, save data)
  into `innerHTML`.

### Icons

One inline SVG sprite injected at boot, referenced by `<use>`, coloured with
`currentColor`:

```html
<svg class="icon"><use href="#icon-sound-on"/></svg>
```

No emoji, no icon font, no per-icon network request. `currentColor` means an icon
follows its button's accent automatically.

### Modal

A modal traps focus, closes on `Escape` and on backdrop press, restores focus to
the element that opened it, and pauses the game while open. One implementation
used by every confirmation — this is what replaces `confirm()`.

## 7. Fonts

Self-host the two families as `woff2` next to the build; a portal build must not
depend on an external CDN. Declare a real fallback stack and
`font-display: swap`, so the first frame is never blank text:

```css
@font-face {
  font-family: 'Display'; src: url('./fonts/display.woff2') format('woff2');
  font-display: swap; font-weight: 400 700;
}
:root { --font-display: 'Display', system-ui, sans-serif; }
```

Subset to the alphabets actually shipped (Latin + Cyrillic). A full-coverage face
is often larger than the rest of the game's UI code combined.

## 8. Localisation is wired into the components

Text lives in the dictionary, not in the markup. Every string node is tagged and
re-applied on language change:

```typescript
el.dataset.i18n = 'menu.play'
export function applyLanguage(root: ParentNode) {
    root.querySelectorAll<HTMLElement>('[data-i18n]')
        .forEach(n => { n.textContent = t(n.dataset.i18n!) })
}
```

Buttons size to content with `min-width`, never a fixed `width`: see
`localization_system.md` for the expansion factors and the parity audit.

## 9. Performance traps specific to the overlay

- **`backdrop-filter: blur()` over a full-screen layer** is the single most
  expensive property in a game overlay on mobile GPUs — it can cost more than the
  scene behind it. Use it on small panels only, or fake it with a static
  semi-transparent surface.
- Animate `transform` and `opacity` only; `width`, `top`, `filter` and
  `box-shadow` repaint or re-layout the layer every frame.
- Keep the HUD subtree small (tens of nodes, not hundreds). Long lists —
  leaderboards, inventories — are built when their screen opens, not kept alive
  underneath the game.
- `will-change` on a permanently visible element permanently costs memory. Add it
  before a transition, remove it after.
- Hidden screens are `display: none`, which removes them from layout entirely;
  `visibility: hidden` and `opacity: 0` still cost layout and still intercept
  nothing but still paint.

## 10. Acceptance, mechanically

These are checkable in a headless Playwright pass and worth wiring into the
project's own check script:

- Dragging across the middle of the canvas moves the camera/vehicle — no layer
  swallowed the pointer.
- `document.scrollingElement.scrollTop` stays `0` after a swipe on the page.
- Every visible button's `getBoundingClientRect()` is ≥ 64 px on its shortest
  side, and the primary one ≥ 96 px.
- No colour literal outside `theme.css` (`grep -rE '#[0-9a-fA-F]{3,8}' src/ui`
  minus the theme file).
- After `router.go('menu')`, no element of the previous screen is hit-testable at
  its former centre point.
- With `bridge.leaderboards.type === 'not_available'` forced, the leaderboard
  entry point is absent from the DOM — not merely hidden.
- A screenshot of each screen at 360×640 and 1280×720 shows no clipped text and
  no scrollbar.
- На экране меню канвас виден: скриншот меню и скриншот чёрного экрана не
  совпадают, а у корня экрана меню `getComputedStyle(...).backgroundColor`
  прозрачен или отсутствует.
- Ни одна подпись кнопки не содержит эмодзи (`grep -nP '[\x{1F300}-\x{1FAFF}]' src/ui`
  пуст).

---

## 11. Чек-лист «интерфейс собран»

- [ ] Слои разложены по контейнерам, контейнер прозрачен для ввода, `auto` только на листьях
- [ ] Перетаскивание по центру канваса управляет игрой: ни один слой не съел указатель
- [ ] `scrollTop` остаётся `0` после свайпа по странице
- [ ] Каждая видимая кнопка ≥ 64 px по короткой стороне, основная ≥ 96 px
- [ ] Ни одного литерала цвета вне `theme.css`
- [ ] После перехода экрана элементы предыдущего не кликаются в своих прежних точках
- [ ] Недоступная на площадке функция отсутствует в DOM, а не спрятана стилем
- [ ] Скриншоты каждого экрана на 360×640 и 1280×720 без обрезанного текста и полос прокрутки
- [ ] На экране меню виден канвас: корень экрана прозрачен, скриншот меню не совпадает с чёрным кадром
- [ ] Ни одной эмодзи в подписях кнопок
- [ ] HUD пишет в закэшированные узлы и только при изменении значения
