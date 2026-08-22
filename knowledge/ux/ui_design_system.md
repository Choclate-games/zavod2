# Game UI Design System

How to give a browser game a UI that reads as one deliberate product rather than
a pile of screens. The palettes and numbers below are one shipped example; what
transfers is the **method** — tokens, one geometry, a finite component set,
capability gating, no scroll.

## 0. Why this file exists

A player judges the game before gameplay starts. The first screen is a menu, and
a menu assembled from default browser controls reads as unfinished no matter how
good the physics behind it are. The failure is never "the developer had no
taste" — it is that nobody wrote the system down, so every screen was invented
again from scratch.

The symptoms are always the same and they are recognisable at a glance: a purple
gradient behind a centred column, emoji standing in for icons, a different colour
per button, `alert()` for a confirmation, "Game Over" on a black plate. Section
11 lists them with the fix for each. Everything before that is the system that
prevents them.

## 1. Tokens first, never raw values

Every colour, font, radius, spacing step and duration is a CSS custom property.
A screen that hardcodes a colour is a screen that will not follow the next theme
change, and a game whose panels are `padding: 13px` in one place and `16px` in
another looks misaligned without anyone being able to say why.

> **Имена токенов — контракт. Значения — нет.**
> Всё, что ниже названо `--color-*`, `--font-*`, `--space-*`, `--dur-*`, обязано
> существовать под этими именами в любой игре: на них опирается весь остальной
> документ и весь код компонентов. А вот сами значения выводятся из мира
> конкретной игры по процедуре в разделе 12 — и **скопировать их из этого файла
> или из другой игры значит сделать ровно ту ошибку, ради которой файл написан.**
> Один интерфейс по умолчанию хуже, чем никакого: он выглядит осознанным
> решением, принятым не для этой игры. Рабочий пример полного набора значений
> вынесен в приложение в конце файла — как образец плотности, а не как заготовка.

Шаг отступов, длительности и порядок слоёв — единственное, что переносится между
играми без изменений: это эргономика и производительность, а не стиль.

```css
:root {
  /* Поверхности — три ступени глубины, значения из материала мира (раздел 12) */
  --color-bg:           /* самый дальний фон, за игровой сценой */;
  --color-panel-glass:  /* поверхность панели, полупрозрачная над сценой */;
  --color-panel-border: /* граница панели, контраст к её же поверхности */;

  /* Акценты — по одному смыслу на каждый, см. таблицу распределения в разделе 2 */
  --color-primary:   /* главный путь игрока */;
  --color-danger:    /* урон, риск, потеря */;
  --color-info:      /* нейтральное действие по умолчанию */;
  --color-neutral:   /* служебный интерфейс в покое */;

  /* Типографика — две гарнитуры, выбранные под мир, не «шрифт для игр» */
  --font-display: /* цифры, заголовки, HUD */, system-ui, sans-serif;
  --font-body:    /* подписи и текст */,      system-ui, sans-serif;

  --color-text-primary:   /* основной текст поверх панели */;
  --color-text-secondary: /* второстепенный, ~65% непрозрачности */;
  --color-text-muted:     /* подавленный, ~45% */;

  /* Один шаг сетки. Всё остальное — кратные ему. */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px; --space-12: 48px;

  /* Motion */
  --dur-press:  120ms;
  --dur-elem:   200ms;
  --dur-screen: 300ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:  cubic-bezier(0.7, 0, 0.84, 0);

  /* Слои. Порядок наложения задаётся здесь один раз, а не z-index: 9999 по месту. */
  --z-world: 0; --z-hud: 10; --z-touch: 20; --z-screen: 30;
  --z-modal: 40; --z-toast: 50;
}
```

### One scale variable for the whole UI

Phones range from 320 to 480 CSS px of width in landscape. Rebuilding the layout
per breakpoint is how a UI ends up with three different paddings. Instead scale
the whole interface from one variable and express every size in it:

```css
:root { --ui-scale: 1; }
@media (max-width: 720px)  { :root { --ui-scale: 0.86; } }
@media (max-width: 420px)  { :root { --ui-scale: 0.74; } }

.btn { padding: calc(var(--space-3) * var(--ui-scale)) calc(var(--space-6) * var(--ui-scale)); }
```

Touch target sizes are the one exception: they are absolute physical minimums
(section 5) and never shrink with the scale.

## 2. One accent per meaning — no rainbow

The most common failure in game UI is a different colour per button "so they're
distinguishable". The result reads as clutter. Assign colours to *meaning* and
write the table down:

| Element | Accent | Rationale |
|---|---|---|
| Hero / campaign mode | primary | the aspirational path |
| Standard match | info | the neutral default action |
| Endless / hardcore mode | danger | risk and loss |
| Secondary grid (shop, leaderboards, quests, achievements) | neutral at rest → primary on hover | one metallic family; colour only on intent |
| Destructive confirm | danger | never used decoratively elsewhere |

Secondary actions share **one** idle colour. They earn an accent only on hover or
selection. No screen shows more than two accents at once: if a third is needed,
the screen is doing two jobs and should be split.

## 3. One frame geometry everywhere

Pick a single silhouette and apply it to every button, card and modal. Mixing
them is what makes a UI look assembled from tutorials.

Силуэт — такое же решение под мир игры, как палитра, и выбирается тем же
вопросом из раздела 12: как в этом мире обрабатывают край? Варианты не
исчерпываются одним:

| Мир режет край так | Силуэт | Реализация |
|---|---|---|
| станок, броня, техника | фаска | `clip-path: polygon(...)` |
| штамповка, пластик, детская игрушка | крупное скругление | `border-radius` |
| бумага, чертёж, вывеска | прямой угол + линия | `border` |
| стекло, вода, органика | асимметричное скругление | разные радиусы по углам |
| вырубка, наклейка, талон | зубец или перфорация | `mask-image` |

Ниже разобрана фаска — просто потому, что она сложнее остальных в реализации;
взятая без вопроса «а как режет край мой мир», она даёт всем играм один и тот же
технический вид. Пример: восьмиточечная фаска со срезом 12 px.

```css
clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px),
                   calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px);
```

Because `clip-path` removes the border, build the frame from two pseudo-elements:
`::before` is the accent-coloured outer layer, `::after` is the dark inner fill
inset by 2 px with a 1 px smaller clip path, and content sits above both at
`z-index: 3`. Drive both from the same `--btn-accent` variable so a theme is one
line per card:

```css
.card-career { --btn-accent: var(--color-primary); }
```

Icons inside cards are **borderless** — no box, no outline, no background — and
carry a `drop-shadow` glow in the card's accent instead.

## 4. Type: two families, one scale, tabular numbers

Two font families, no more: a display face for headings, HUD and numbers, and a
body face for everything that is a sentence. A third family always reads as an
accident.

```css
:root {
  --text-hud:   clamp(16px, calc(18px * var(--ui-scale)), 22px);
  --text-body:  clamp(14px, calc(16px * var(--ui-scale)), 18px);
  --text-title: clamp(24px, calc(34px * var(--ui-scale)), 44px);
}
```

- **Every number that changes gets `font-variant-numeric: tabular-nums`** and a
  fixed-width slot (`min-width: 4ch; text-align: right`). Proportional digits
  make a score counter twitch left and right on every tick, and the whole HUD row
  reflows with it. This one property is the difference between a HUD that looks
  engineered and one that looks improvised.
- Body text never goes below 14 px after scaling. On a phone in landscape that is
  already near the readable floor.
- `text-transform: uppercase` is for short labels only. A Cyrillic sentence in
  caps loses its word shapes and becomes measurably slower to read; Russian is
  the primary language on Yandex Games and VK.
- Line height: 1.2 for headings, 1.45 for body. Letter-spacing only on uppercase
  labels (0.06em), never on body text.
- Reserve room for translation: Russian runs ~15–30 % longer than English. A
  button sized exactly to its English label breaks in the shipping language — see
  `localization_system.md`.

## 5. Layout: composition, not centring

A screen is not a centred column of buttons. Give every screen three zones and
put each element in exactly one:

1. **Identity** — what this screen is: title, mode name, the player's current
   state. Top, aligned with the safe area.
2. **The primary action** — exactly one per screen, the largest and the only
   element carrying the primary accent.
3. **The secondary rail** — everything else, one row or one grid, all at the same
   visual weight.

Rules that follow from that:

- One primary action per screen. Two "equally important" buttons means the design
  has not decided, and the player will not decide either.
- Everything aligns to the `--space-*` scale. No arbitrary offsets, no
  `position: absolute` outside the HUD anchors below.
- The HUD has exactly five anchors — four corners and centre-bottom. Every
  persistent element belongs to one anchor; nothing floats loose in the middle of
  the screen except transient feedback (damage numbers, pickups).
- Touch targets: primary action ≥ 96 px, secondary ≥ 64 px, spacing between
  targets ≥ 12 px. These are absolute, not scaled.

### Меню стоит на живой сцене, а не на заливке

Первое, что видит игрок, — это меню, и обычно оно же решает, будет ли вторая
минута. Меню, лежащее на непрозрачном прямоугольнике, прячет всё, ради чего игру
делали: игрок смотрит на список кнопок и не знает, во что ему предлагают играть.

Поэтому меню, пауза и экран итога сессии рисуются **поверх той же сцены**, что и
игра:

- Тот же рендерер и та же сцена — не картинка, не видео, не скриншот. Камера
  ставится отдельно: медленный облёт, статичный кадр с лёгким дрейфом, проезд
  вдоль объекта. Свет и эффекты работают.
- Игровой цикл в меню продолжает крутиться на сниженной нагрузке: меньше
  частиц, ниже частота обновления симуляции, тени можно выключить. Кадр не
  замирает.
- Подложка — только под текстовым блоком и кнопками, и она частично прозрачна.
  Полноэкранная заливка (`background: #111` на корне экрана, `rgba(...)` на весь
  вьюпорт) запрещена: она означает, что сцены за меню нет.
- Композиция кадра при этом остаётся композицией экрана (три зоны выше). Панель
  меню занимает свою зону, а не середину поверх всего.

Что именно стоит за меню, решает арт-дирекция проекта — в спецификации это поле
`menu_staging` («Сцена за меню» в `ART_DIRECTION.md`). Придумывать заново не
нужно; нужно поставить камеру так, как там написано.

### No scrolling in menus

Every main screen fits within the viewport height. A scrollbar in a game menu
looks broken on a phone and, on a portal, is also a moderation finding
(requirement 1.10.2 — the page must not scroll during play).

Size against the **measured** viewport, not `100vh`:

```css
.screen { height: calc(var(--vp-h, 100dvh) - var(--safe-t) - var(--safe-b)); }
```

Long content (an upgrade list, a leaderboard) goes into an explicitly scrollable
inner container — never the page.

## 6. A finite component set

Everything on screen is one of a dozen components, each in its own file, each
built only from tokens. A one-off `<div>` with inline styles is the bug this rule
exists to prevent: it is how the second screen stops matching the first.

| Component | Owns |
|---|---|
| `Button` | primary / secondary / ghost / destructive variants, all states |
| `IconButton` | square utility action, icon only, label in `aria-label` |
| `Panel` | the framed surface every group of content sits on |
| `Modal` | panel + backdrop + focus trap + one close path |
| `Toast` | transient message, auto-dismiss, never blocks input |
| `Meter` | health / fuel / progress bar with a fill and an optional ghost trail |
| `Stat` | label + tabular number, the HUD's only text primitive |
| `Toggle`, `Slider` | settings controls — **never** a bare `<input type=range>` |
| `SegmentedControl` | 2–4 exclusive options; replaces a `<select>` |
| `ListRow` | leaderboard entry, shop item, quest line |
| `Badge` | count or status marker attached to another element |
| `ScreenShell` | the three zones from section 5, safe-area insets, transitions |

Every interactive component implements five states: rest, hover, active/pressed,
disabled, `:focus-visible` — plus `loading` where the action is asynchronous
(buying, watching an ad, submitting a score). A button that does nothing visible
for the 400 ms an ad takes to open gets tapped three more times.

## 7. Every screen has five states

Designing only the happy path is why generated games show an empty framed box
where a leaderboard should be. Each screen declares what it renders for:

| State | Rule |
|---|---|
| `loading` | skeleton or spinner **inside** the panel; the screen frame is already drawn |
| `ready` | the normal content |
| `empty` | its own copy and a way out ("Никто ещё не проходил трассу — стань первым") — never an empty panel |
| `error` | what failed, in the player's terms, plus a retry that actually retries |
| `unavailable` | the platform does not support this feature → **the entry is not rendered at all** (section 8) |

Saves, leaderboards, purchases and ads are all network calls, and all four fail
routinely on these portals. Silence is the worst response: a save that failed and
said nothing costs the player their run.

## 8. Capability gating is a design rule

The platform decides which features exist. **A button for an unsupported action
must not be rendered at all** — not greyed out, not showing an error on tap.

| Feature | Check | If false |
|---|---|---|
| Leaderboard | `bridge.leaderboards.type !== 'not_available'` | remove the nav tab and panel |
| Purchases | `bridge.payments.isSupported` | show paid items as free — no locks, no prices |
| Rewarded | `bridge.advertisement.isRewardedSupported` | remove every "watch ad" button |
| Auth | `bridge.player.isAuthorizationSupported` | hide "Sign in", treat content as accessible |
| Social (share / rate / invite …) | per-action `isXSupported` | omit the entry entirely |

This is why the design must not assume a fixed menu grid: the same build ships to
a platform with six utility buttons and to one with two. The layout is a flow
container over a filtered list, not a hand-placed 3×2 grid.

## 9. Layout must survive the platform chrome

- Inset every UI layer by `env(safe-area-inset-*)`; let only the art layer reach
  the physical edge.
- A sticky banner can be drawn *over* the game — reserve the strip when measured
  (see `../playgama/banners_and_layout.md`), or the bottom row of buttons ends up
  unreachable.
- Re-measure after fullscreen exits; the first reported height is often stale.

## 10. Motion: short, causal, one pattern

- Durations come from the tokens: `--dur-press` for a press, `--dur-elem` for an
  element appearing, `--dur-screen` for a screen change. Nothing in the UI
  animates longer than 400 ms — a menu that takes half a second to answer feels
  broken, not polished.
- Entry uses `--ease-out`, exit uses `--ease-in`. One transition pattern for the
  whole game (for example: fade plus an 8 px rise), used by every screen.
- **Every tap gets a response in the same frame**, even when the action is slow:
  `transform: scale(0.97)` on `:active` costs nothing and is what makes a UI feel
  attached to the finger.
- Reserve motion for state changes the player caused. Idle animation in a menu
  competes with the game itself.
- Honour `prefers-reduced-motion: reduce` — keep opacity changes, drop transforms
  and parallax.
- Animate `transform` and `opacity` only. Animating `width`, `top` or
  `box-shadow` lays out or paints the whole overlay every frame and shows up as
  stutter in the game behind it.
- Always style `:focus-visible` identically to `:hover` — portals are played on
  desktop with a keyboard too.

## 11. HUD

The HUD is the one place where readability beats the design system.

- **Prefer the world over the overlay.** State that can be shown on the character
  or the vehicle — a cracking windshield, a glowing barrel, a limping gait — is
  worth more than another corner meter, and it is what separates a game HUD from
  a dashboard.
- Numbers in the display font, labels in the body font. Opponent and player bars
  keep opposing accents (danger vs. info) so they are never confused mid-fight.
- Any text drawn over gameplay gets a scrim, a shadow or an outline
  (`paint-order: stroke; -webkit-text-stroke: 3px rgba(0,0,0,.7)`). A bare white
  number disappears the moment the player drives onto snow. If a token fails
  contrast over gameplay, add the scrim rather than lightening the text.
- Budget: at most five persistent elements on a phone. Everything else is
  transient — damage numbers, pickup callouts, combo counters — and lives on the
  feedback layer, not the HUD.
- The HUD updates by writing to existing nodes, never by rebuilding markup per
  frame (see `ui_implementation.md`).

## 12. The theme comes from the game's world

A design system with no world behind it produces a competent, anonymous UI. Name
the material the interface is made of, and derive the tokens from it:

| The world is | The UI is made of | Tokens follow |
|---|---|---|
| a 1970s garage | painted steel, worn stencils, hazard tape | warm grey surfaces, one safety-orange accent, hard-edged frames |
| a deep-sea station | scratched acrylic over teal glow, rivets | dark cyan glass, mono display face, rounded viewport frames |
| a fairground | enamel signs, bulb rows, gold leaf | cream panels, red/gold accents, arched frames |

### Процедура: из мира в значения токенов

Этот раздел — не иллюстрация, а обязательный шаг перед первой строкой
`theme.css`. Шесть вопросов, шесть ответов, полный набор значений:

1. **Из какого физического предмета сделана панель интерфейса?** Не «тёмная
   стеклянная панель», а вещь: приборный щиток, эмалированная табличка, лист
   миллиметровки, кусок брезента. Отсюда `--color-panel-glass` и
   `--color-panel-border` — цвет самого материала и цвет его края.
2. **Где этот предмет лежит и при каком свете?** Отсюда `--color-bg`: не
   абстрактный тёмный, а темнота именно этого места — угольная, синяя от
   уличного фонаря, бурая от ламп накаливания.
3. **Каким цветом в этом мире помечают «сюда, это главное»?** Краска на станке,
   сигнальная лента, начищенная латунь. Отсюда `--color-primary`.
4. **Каким помечают опасность?** Красный — самый частый ответ, но не
   единственный: ржавчина, кислотный жёлтый, чёрно-жёлтая штриховка. Отсюда
   `--color-danger`.
5. **Чем в этом мире написаны цифры?** Трафарет, шкала прибора, вывеска от руки,
   кассовый чек. Отсюда `--font-display` — и это же отвечает на вопрос, уместны
   ли моноширинные цифры и прописные.
6. **Как в этом мире обрабатывают край?** Ответ выбирает силуэт из таблицы в
   разделе 3.

Ответы записываются в `UI_UX_SPECIFICATION.md` рядом со значениями: токен без
названной причины через месяц превращается в «просто цвет» и его меняют наугад.

The check: cover the game canvas and look only at the menu. If it could belong to
any other game, the theme is decoration rather than direction. This is also the
hand-off from art direction — the UI theme is decided there and implemented here,
not invented separately.

Обратная проверка, такая же обязательная: возьмите набор токенов другой игры,
сделанной по этому же файлу, и приложите к своей. Если разница только в оттенке
акцента — процедура выше была пропущена, и обе игры получили один интерфейс с
разными подписями.

## 13. Anti-patterns — the "generated UI" smell

| Smell | Why it is wrong | Instead |
|---|---|---|
| `alert()` / `confirm()` / `prompt()` | browser chrome breaks immersion, blocks the game loop, and is unstyleable | `Modal` component |
| Emoji as icons (🔊 🏆 ⚙️) | renders differently per OS, breaks the type scale, reads as a placeholder | inline SVG sprite, `currentColor` |
| Purple/blue gradient + system sans | the default look of generated pages; says nothing about the game | tokens derived from the world (section 12) |
| A different colour per button | reads as clutter, destroys hierarchy | one accent per meaning (section 2) |
| Everything centred in one column | no hierarchy, no composition | three zones (section 5) |
| Меню на непрозрачной заливке поверх канваса | прячет игру ровно в тот момент, когда игрок решает, играть ли; экран запуска перестаёт отличаться от чужого | живая сцена за меню (section 5) |
| Black plate with "GAME OVER" | generic, and usually wrong for the game's fiction | the session result in the game's own terms |
| Bare `<input type=range>` / `<select>` | platform-styled, tiny hit targets on mobile | `Slider` / `SegmentedControl` |
| `z-index: 9999` | the stacking order becomes unknowable | the `--z-*` tokens |
| Text over gameplay with no scrim | unreadable on bright scenes | scrim or text stroke (section 11) |
| Drop shadow on everything | flattens hierarchy; nothing stands out | shadow only on floating layers (modal, toast) |
| Fixed pixel positions per screen size | breaks on the next device | `--ui-scale` plus flow layout |
| A greyed-out button for an unsupported feature | the player taps it and nothing happens | do not render it (section 8) |

## 14. Acceptance checklist

- [ ] No hardcoded colour, font, radius or duration outside `theme.css`.
- [ ] За меню видна живая сцена игры; полноэкранной непрозрачной заливки нет.
- [ ] Every screen fits the measured viewport; the page itself does not scroll.
- [ ] One primary action per screen; at most two accents visible at once.
- [ ] Every button ≥ 64 px, primary ≥ 96 px, gaps ≥ 12 px, insets by safe area.
- [ ] Every changing number uses `tabular-nums` in a fixed-width slot.
- [ ] Every interactive element has rest / hover / active / disabled /
      `:focus-visible`, and async actions have a `loading` state.
- [ ] Every screen defines loading, empty and error states, not just the happy path.
- [ ] No feature button rendered for a capability the platform lacks.
- [ ] No `alert`/`confirm`, no emoji icons, no `z-index` outside the tokens.
- [ ] Screen transitions use one shared pattern and finish under 400 ms.
- [ ] With `prefers-reduced-motion: reduce`, transforms are dropped and only opacity changes remain.
- [ ] UI text is readable over the brightest scene in the game.
- [ ] With the canvas hidden, the menu still identifies this specific game.
- [ ] Ни одно значение токена не совпадает с примером из этого файла и из другой
      игры фабрики: у каждого есть свой ответ из процедуры в разделе 12.
- [ ] The longest translated string still fits every button.

---

## Приложение. Один рабочий набор значений — образец, не заготовка

Ниже полный `:root` из одной вышедшей игры: мир — ангар обслуживания
орбитальных челноков, панели собраны из анодированного алюминия с латунными
шильдиками, цифры набраны трафаретной акциденцией. Он приложен, чтобы было
видно, какой плотности решений ждут от раздела 12, — и **не подлежит переносу в
другую игру**: в игре про пекарню, про дождливый город или про ярмарку каждое из
этих значений будет другим, включая шрифты и силуэт рамки.

```css
:root {
  --color-bg:           #09080C;             /* темнота ангара, почти без синевы */
  --color-panel-glass:  rgba(14, 12, 22, 0.92);
  --color-panel-border: rgba(255, 255, 255, 0.12);

  --color-primary:   #FFD700;   /* латунный шильдик: «сюда, это главное» */
  --color-danger:    #EF4444;   /* аварийная маркировка на переборках */
  --color-info:      #3B82F6;   /* подсветка служебных консолей */
  --color-neutral:   #94A3B8;   /* анодированный алюминий в покое */

  --font-display: 'Orbitron', system-ui, sans-serif;   /* трафарет на корпусе */
  --font-body:    'Outfit',   system-ui, sans-serif;

  --color-text-primary:   #FFFFFF;
  --color-text-secondary: rgba(255, 255, 255, 0.65);
  --color-text-muted:     rgba(255, 255, 255, 0.45);
}
```

Силуэт этой игры — восьмиточечная фаска со срезом 12 px (раздел 3): в мире,
собранном из фрезерованных панелей, край снимают именно так.
