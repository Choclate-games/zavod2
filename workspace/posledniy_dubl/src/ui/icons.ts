/**
 * Инлайновые SVG-иконки с currentColor. Никаких эмодзи.
 */

const svg = (inner: string, viewBox = '0 0 24 24'): string =>
  `<svg class="icon" viewBox="${viewBox}" aria-hidden="true" focusable="false">${inner}</svg>`

export const ICONS = {
  pause: svg('<path d="M8 5h3v14H8zM13 5h3v14h-3z"/>'),
  crosshair: svg(
    '<circle cx="12" cy="12" r="1.6"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  ),
  film: svg(
    '<path d="M4 3h16v18H4zM7 3v18M17 3v18M4 8h3M4 12h3M4 16h3M17 8h3M17 12h3M17 16h3" stroke="currentColor" stroke-width="1.4" fill="none"/>',
  ),
} as const
