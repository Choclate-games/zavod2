/**
 * Один инлайновый SVG-спрайт: иконки рисуются currentColor,
 * никаких эмодзи и внешних картинок.
 */
export type IconName = 'trophy' | 'coin' | 'pause' | 'sound-on' | 'sound-off' | 'bolt' | 'wave' | 'radar' | 'back' | 'play' | 'wrench'

const PATHS: Record<IconName, string> = {
  trophy: 'M6 3h12v2h3v3c0 2.5-2 4.5-4.5 4.9A6 6 0 0 1 13 16.9V19h3v2H8v-2h3v-2.1a6 6 0 0 1-3.5-4A5 5 0 0 1 3 8V5h3V3zm-1 4v1a3 3 0 0 0 2 2.8V7H5zm14 0h-2v3.8A3 3 0 0 0 19 8V7z',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 4v2h2v2h-4v2h4v2h-2v2h-2v-2H9v-2h4v-2H9V9h2V7h2z',
  pause: 'M7 5h4v14H7V5zm6 0h4v14h-4V5z',
  'sound-on': 'M4 9v6h4l5 5V4L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z',
  'sound-off': 'M4 9v6h4l5 5V4L8 9H4zm13 1.5l1.5-1.5L20 10.5 21.5 9 23 10.5 21.5 12l1.5 1.5-1.5 1.5-1.5-1.5-1.5 1.5-1.5-1.5 1.5-1.5-1.5-1.5z',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6l1-8z',
  wave: 'M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0 2 2 2 2v3c-2 3-4 3-6 0s-4-3-6 0-4 3-6 0-2-2-2-2v-3z',
  radar: 'M12 3a9 9 0 0 1 9 9h-2a7 7 0 0 0-7-7V3zm0 5a4 4 0 0 1 4 4h-2a2 2 0 0 0-2-2V8zm0 5l5 5-1.5 1.5L11 15l-3 3H5l4-4-1.5-1.5z',
  back: 'M15 5l-7 7 7 7 2-2-5-5 5-5-2-2z',
  play: 'M8 5v14l11-7L8 5z',
  wrench: 'M22 6.5l-4 4-3-3 4-4A6 6 0 0 0 8 11L3 16l5 5 5-5a6 6 0 0 0 9-9.5zM8 17.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
}

export function iconSvg(name: IconName): string {
  const path = PATHS[name]
  return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`
}
