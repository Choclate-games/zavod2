# Game UI Design System

How to give a browser game a UI that reads as one deliberate product rather than
a pile of screens. The specific palette below is one shipped example; what
transfers is the **method** — tokens, one geometry, capability gating, no scroll.

## 1. Tokens first, never raw values

Every colour, font and radius is a CSS custom property. A screen that hardcodes
`#FFD700` is a screen that will not follow the next theme change.

```css
:root {
  /* Surfaces */
  --color-bg:           #09080C;
  --color-panel-glass:  rgba(14, 12, 22, 0.92);
  --color-panel-border: rgba(255, 255, 255, 0.12);

  /* Accents — one meaning each, see the allocation table */
  --color-primary:   #FFD700;   /* hero / progression */
  --color-danger:    #EF4444;   /* damage, endless, loss */
  --color-info:      #3B82F6;   /* standard action */
  --color-neutral:   #94A3B8;   /* utility UI at rest */

  /* Typography */
  --font-display: 'Orbitron', sans-serif;   /* HUD, headings, numbers */
  --font-body:    'Outfit', sans-serif;     /* body, subtitles, stats */

  --color-text-primary:   #FFFFFF;
  --color-text-secondary: rgba(255, 255, 255, 0.65);
  --color-text-muted:     rgba(255, 255, 255, 0.45);
}
```

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
selection.

## 3. One frame geometry everywhere

Pick a single silhouette — chamfered, rounded, or hard-edged — and apply it to
every button, card and modal. Mixing them is what makes a UI look assembled from
tutorials. Example: an 8-point chamfer with 12 px cuts.

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

## 4. No scrolling in menus

Every main screen fits within the viewport height. A scrollbar in a game menu
looks broken on a phone and, on a portal, is also a moderation finding
(requirement 1.10.2 — the page must not scroll during play).

Size against the **measured** viewport, not `100vh`:

```css
.screen { height: calc(var(--vp-h, 100dvh) - var(--safe-t) - var(--safe-b)); }
```

Long content (an upgrade list, a leaderboard) goes into an explicitly scrollable
inner container — never the page.

## 5. Capability gating is a design rule

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
a platform with six utility buttons and to one with two.

## 6. Layout must survive the platform chrome

- Inset every UI layer by `env(safe-area-inset-*)`; let only the art layer reach
  the physical edge.
- A sticky banner can be drawn *over* the game — reserve the strip when measured
  (see `../playgama/banners_and_layout.md`), or the bottom row of buttons ends up
  unreachable.
- Re-measure after fullscreen exits; the first reported height is often stale.

## 7. Feedback and micro-interactions

- Hover/focus: scale ~1.025 and a stronger glow; keep it under 250 ms.
- Always style `:focus-visible` identically to `:hover` — portals are played on
  desktop with a keyboard too.
- Reserve motion for state changes the player caused. Idle animation in a menu
  competes with the game itself.

## 8. HUD

Numbers in the display font, labels in the body font. Opponent and player bars
keep opposing accents (danger vs. info) so they are never confused mid-fight. The
HUD is the one place where readability beats the design system: if a token fails
contrast over gameplay, add a scrim rather than lightening the text.
