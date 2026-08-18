const INTERACTIVE_SELECTOR = 'input, textarea, select, option, [contenteditable=""], [contenteditable="true"]';

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
}

function publishMetrics(): void {
  document.documentElement.style.setProperty('--vp-w', `${Math.max(1, window.innerWidth)}px`);
  document.documentElement.style.setProperty('--vp-h', `${Math.max(1, window.innerHeight)}px`);
}

function settleMetrics(): void {
  for (const delay of [0, 60, 180, 420, 900]) window.setTimeout(publishMetrics, delay);
}

export function installViewportGuards(): void {
  publishMetrics();
  window.addEventListener('resize', settleMetrics);
  window.addEventListener('orientationchange', settleMetrics);
  document.addEventListener('fullscreenchange', settleMetrics);

  window.addEventListener('scroll', () => {
    if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
  }, true);

  document.addEventListener('contextmenu', (event) => {
    if (!isInteractive(event.target)) event.preventDefault();
  }, true);
  document.addEventListener('selectstart', (event) => {
    if (!isInteractive(event.target)) event.preventDefault();
  }, true);
  document.addEventListener('dragstart', (event) => {
    if (!isInteractive(event.target)) event.preventDefault();
  }, true);
  document.addEventListener('touchmove', (event) => {
    if (!isInteractive(event.target)) event.preventDefault();
  }, { passive: false });
}
