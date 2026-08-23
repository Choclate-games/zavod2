/**
 * Один инлайновый SVG-спрайт: иконки красятся через currentColor.
 * Никаких эмодзи в интерфейсе.
 */
const ICONS = {
  play: '<path d="M8 5v14l11-7z"/>',
  pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
  soundOn: '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/>',
  soundOff: '<path d="M3 9v6h4l5 5V4L7 9H3zm18.6 3 2.1-2.1-1.4-1.4-2.1 2.1-2.1-2.1-1.4 1.4 2.1 2.1-2.1 2.1 1.4 1.4 2.1-2.1 2.1 2.1 1.4-1.4z"/>',
  steam: '<path d="M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V19h2v-2h4v2h2v-3.3A7 7 0 0 0 12 3zm-3 6a1.2 1.2 0 1 1 0 .01zM12 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>',
  focus: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 3h-2.07A7 7 0 0 0 13 5.07V3h-2v2.07A7 7 0 0 0 5.07 11H3v2h2.07A7 7 0 0 0 11 18.93V21h2v-2.07A7 7 0 0 0 18.93 13H21z"/>',
  trophy: '<path d="M18 5V3H6v2H2v3a4 4 0 0 0 4 4h.3A6 6 0 0 0 11 15.9V18H8v3h8v-3h-3v-2.1A6 6 0 0 0 17.7 12H18a4 4 0 0 0 4-4V5h-4z"/>',
} as const

export type IconName = keyof typeof ICONS

export function iconSvg(name: IconName): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`
}
