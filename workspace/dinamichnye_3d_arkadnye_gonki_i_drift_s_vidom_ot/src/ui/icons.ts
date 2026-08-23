/**
 * Единственный инлайновый SVG-спрайт интерфейса. Иконки красятся через
 * currentColor; эмодзи в подписях запрещены.
 */
const ICONS: Record<string, string> = {
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/>',
  map:
    '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 2.2 4 1.3v10.3l-4-1.3V6.2z" fill="currentColor"/>',
  sound:
    '<path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a3.5 3.5 0 0 0-2-3.15v6.3a3.5 3.5 0 0 0 2-3.15z" fill="currentColor"/>',
  mute:
    '<path d="M3 9v6h4l5 4V5L7 9H3zm18.2 8.8L4.2 2.8 2.8 4.2l16.99 17z" fill="currentColor"/>' +
    '<path d="M16.5 12a3.5 3.5 0 0 0-.6-1.97l1.42-1.42A5.48 5.48 0 0 1 18.5 12z" fill="currentColor"/>',
  trophy:
    '<path d="M17 4V2H7v2H3v3a4 4 0 0 0 4 4 5 5 0 0 0 3 3.87V17H8v2h8v-2h-2v-2.13A5 5 0 0 0 17 11a4 4 0 0 0 4-4V4h-4zM5 7V6h2v3a2 2 0 0 1-2-2zm14 0a2 2 0 0 1-2 2V6h2v1z" fill="currentColor"/>',
  star:
    '<path d="m12 2 2.9 6.26L21.5 9.27l-4.75 4.38 1.25 6.6L12 17.05l-5.99 3.2 1.24-6.6L2.5 9.27l6.6-1.01L12 2z" fill="currentColor"/>',
  handbrake:
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<text x="12" y="16.5" text-anchor="middle" font-size="11" font-weight="bold" fill="currentColor">P</text>',
  turbo:
    '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor"/>',
  valve:
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M12 5v6l4 4" stroke="currentColor" stroke-width="2" fill="none"/>' +
    '<circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  back:
    '<path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2z" fill="currentColor"/>',
  restart:
    '<path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" fill="currentColor"/>',
  home:
    '<path d="m12 3 9 8h-3v9h-5v-6h-2v6H6v-9H3l9-8z" fill="currentColor"/>',
}

export function icon(name: string): string {
  const path = ICONS[name] ?? ICONS.play
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`
}
