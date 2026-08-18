# Adaptive Quality That Actually Converges

The goal: auto-tune to the **richest quality the device sustains smoothly** —
degrade under load and climb back up when there is headroom, converging without
the player ever seeing it happen.

The naive design ("degrade the fps cap first, recover on stable fast frames")
fails silently: quality never climbs, and the game looks permanently stuck on low
graphics. Here is why, and what works instead.

## The vsync headroom trap — read this first

**Under vsync you cannot detect spare GPU headroom from frame time.** When the app
renders at the display's refresh rate, every frame takes ≈ the refresh interval
(16.7 ms at 60 Hz) whether the GPU is 10 % or 95 % loaded — the buffer swap waits
for vsync either way. So "if avg frame time < budget, climb" essentially never
fires: the average *is* the budget by construction.

Two corollaries:

- **Raw `rAF` delta is the wrong signal**, especially on high-refresh panels. When
  rendering is capped below the refresh, most `rAF` callbacks are *skipped* (cheap)
  frames, so the average is dominated by ~7 ms nothings and says nothing about
  render load.
- **Never target fps above the panel's refresh.** A 100 fps target on a 60 Hz
  screen makes the budget unreachable, so the tuner reads perfectly normal vsync
  frames as "struggling" and degrades for no reason.

## The design that converges

1. **Fix the frame-rate target; tune quality to hold it.** Target 60 fps, or the
   panel's refresh if it is *slower*. Never chase 120 — it burns battery and on
   phones triggers thermal throttling that makes everything worse. The fps target
   is not a quality knob; **resolution and shadows** are.
2. **One ordered quality ladder.** Each rung bundles `{ res, shadowMapSize,
   shadowRefreshHz }`, cheapest first. The governor holds an index and walks it.
   Mobile gets its own ladder that tops out lower.
3. **Start optimistic, near the top rung.** Launch at (near) full quality and step
   *down* if 60 will not hold. Never launch reduced and crawl up — the first
   impression is full quality, and weak devices settle within a second or two.
4. **Measure the cadence between *rendered* frames, not every `rAF`.** Record
   `performance.now()` each time you actually render; the EMA of that gap is the
   load signal. It is refresh-independent and immune to the skipped-frame problem.
5. **Climb by optimistic probing.** Headroom is unmeasurable under vsync, so do not
   try to measure it — discover the ceiling by trying. After ~3 s stable at budget
   cadence, bump one rung; if it breaks the target, drop back.
6. **Strike-based ceiling lock.** Count failures per rung; after two failures at a
   rung, forbid probing at or above it. The system then sits one rung below the
   first level that cannot hold 60 — the ideal — after a couple of brief probes.
7. **Debounce downgrades, one rung at a time.** Require ~0.4 s of sustained
   over-budget cadence per drop, so a lone GC hitch cannot cascade to the floor.
8. **Apply changes before `render()`, on a frame you actually render.**
   `setSize()`, pixel-ratio changes and shadow-map disposal clear the canvas;
   doing them after `render()` — or on a frame the accumulator then skips —
   flashes a blank frame. Order: decide level → apply level → render.
9. **Warm-up guard.** Do not let the governor touch quality for the first ~second.
   First-second load jank would otherwise drop the level immediately, and because
   climbing is deliberate it would look stuck low for the rest of the session.
10. **Keep game logic on every `rAF`; throttle only rendering.** Clamp dt spikes
    (> 0.5 s) out of every statistic — a tab switch is not a slow frame.

## Governor skeleton

```javascript
// --- pacing (every rAF) ---
const interval = 1000 / this.targetFps;
this.accum = Math.min(this.accum + dtMs, interval * 3);
if (this.accum < interval - 2) return;                 // logic above already ran
this.accum = Math.max(0, this.accum - interval);

// --- load signal: cadence between RENDERED frames only ---
const now = performance.now();
if (this.lastRenderMs !== undefined) {
    const rdt = now - this.lastRenderMs;
    if (rdt < 500) this.tune(rdt);                     // ignore tab-switch gaps
}
this.lastRenderMs = now;

this.applyLevel(this.targetLevel);                     // may setSize / resize shadow map
this.renderer.render(scene, camera);

tune(rdt) {
    const p = this.perf, budget = 1000 / this.targetFps;
    p.avg = p.avg * 0.85 + rdt * 0.15;
    const dt = rdt / 1000;
    if (p.cooldown > 0) p.cooldown -= dt;

    if (p.avg > budget * 1.25) {                       // not holding → shed
        p.good = 0; p.bad += dt;
        if (p.bad >= 0.4 && p.level > 0) {
            p.bad = 0;
            p.strikes[p.level] = (p.strikes[p.level] || 0) + 1;
            if (p.strikes[p.level] >= 2) p.ceiling = Math.min(p.ceiling, p.level - 1);
            p.level--; p.cooldown = 6;
        }
    } else if (p.avg <= budget * 1.10) {               // holding → probe one rung up
        p.bad = 0; p.good += dt;
        if (p.good >= 3 && p.cooldown <= 0 && p.level < p.ceiling) { p.good = 0; p.level++; }
    } else { p.bad = 0; p.good = 0; }
}
```

## Detecting the refresh rate (only to catch sub-60 panels)

Take the **minimum** clean `rAF` interval over the first ~60 samples — the minimum
is the vsync period, since jank only inflates individual samples. Guard the sample
range to `[3 ms, 500 ms]`: a doubled-up 0 ms `rAF` yields `1000/0 = Infinity` and
poisons the estimate. Then `targetFps = clamp(round(1000 / min), 30, 60)`.

## Retuning shadows at runtime

```javascript
// three.js only rebuilds the depth target if you dispose it
light.shadow.mapSize.set(size, size);
if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null; }
renderer.shadowMap.needsUpdate = true;

// throttle the depth pass on mobile
renderer.shadowMap.autoUpdate = (hz === 0);            // 0 = every frame
// else in render(): if (now - last >= 1000 / hz) { renderer.shadowMap.needsUpdate = true; last = now; }
```

## Testing an auto-tuner headlessly — two traps

- **Headless Chromium throttles `rAF` to ~1 fps when the page is offscreen**, so the
  governor barely ticks and refresh detection never reaches its sample count.
  Launch with `--disable-background-timer-throttling
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding`, call
  `page.bringToFront()`, or drive `tune()` directly with synthetic cadences.
- **Do not feed sub-vsync synthetic frame times.** 8 ms "frames" are unrealistic —
  under real vsync you never see sub-refresh intervals, and a tuner that passes on
  8 ms input can still never climb in production. Test with realistic rendered
  cadences (~16.7 ms holding 60, ~25 ms not).

Expose the instance (`window.__game`) in dev builds: inspecting the live governor
state (rung, target fps, avg cadence, ceiling) is the fastest way to tell "stuck
low" from "converged correctly".
