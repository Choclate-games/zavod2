/** Один инлайновый SVG-спрайт, цвет через currentColor. Эмодзи запрещены. */
const ICONS = {
  play: '<path d="M8 5v14l11-7z"/>',
  shirt:
    '<path d="M16 3l4 2 2 5-3.5 1L18 9v12H6V9l-.5 2L2 10l2-5 4-2a4 4 0 0 0 8 0z"/>',
  catapult:
    '<path d="M6 20h12v2H6zM7 18c0-5 2-9 5-13 3 4 5 8 5 13h-2c0-3-1-6-3-9-2 3-3 6-3 9z"/>',
  trophy:
    '<path d="M6 3h12v2h3v3a4 4 0 0 1-4 4h-.35A6 6 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A6 6 0 0 1 7.35 12H7a4 4 0 0 1-4-4V5h3zm14 4h-2v3a2 2 0 0 0 2-2zm-14 0H4v1a2 2 0 0 0 2 2z"/>',
  gear:
    '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 4a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L16 3H8l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 3 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L8 21h8l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 21 12z" transform="scale(0.85) translate(1,1)"/>',
  restart:
    '<path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/>',
  star: '<path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z"/>',
  close: '<path d="M6 5l13 13-1.4 1.4L4.6 6.4z M19 5L6 18l1.4 1.4L20.4 6.4z"/>',
} as const

export type IconName = keyof typeof ICONS

export function icon(name: IconName): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`
}
