/**
 * Viewport Guards & Safe Area Metrics (Yandex & Mobile Compliance)
 */

const INTERACTIVE = 'input, textarea, select, option, button, a, [contenteditable=""], [contenteditable="true"]';

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE));
}

function startsInScroller(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const scroller = target.closest('.leaderboard-list, #talents-list, .scrollable');
  return Boolean(scroller);
}

export function publishMetrics(): void {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  document.documentElement.style.setProperty('--vp-w', `${w}px`);
  document.documentElement.style.setProperty('--vp-h', `${h}px`);
}

const settle = (): void => {
  [0, 60, 180, 420, 900].forEach((ms) => {
    window.setTimeout(publishMetrics, ms);
  });
};

export function installViewportGuards(): void {
  publishMetrics();

  window.addEventListener('resize', () => {
    publishMetrics();
    settle();
  });

  window.addEventListener('orientationchange', settle);
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((eventType) => {
    document.addEventListener(eventType, settle);
  });

  const resetScroll = (): void => {
    if (window.scrollX || window.scrollY) {
      window.scrollTo(0, 0);
    }
  };

  window.addEventListener('scroll', resetScroll, true);
  document.addEventListener('focusout', () => window.setTimeout(resetScroll, 0));

  let allowed = false;
  document.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      allowed = e.touches.length === 1 && startsInScroller(e.target);
    },
    { passive: true }
  );

  document.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (e.touches.length > 1 || !allowed) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  document.addEventListener('contextmenu', (e: MouseEvent) => {
    if (!isInteractive(e.target)) {
      e.preventDefault();
    }
  }, true);

  document.addEventListener('selectstart', (e: Event) => {
    if (!isInteractive(e.target)) {
      e.preventDefault();
    }
  }, true);

  document.addEventListener('dragstart', (e: DragEvent) => {
    if (!isInteractive(e.target)) {
      e.preventDefault();
    }
  }, true);

  resetScroll();
}
