/** Один инлайновый SVG-спрайт; цвет иконок — currentColor. */

const ICONS: Record<string, string> = {
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/>',
  sound: '<path d="M4 9v6h4l6 5V4L8 9H4z" fill="currentColor"/><path d="M16 8c1.7 1 1.7 7 0 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  mute: '<path d="M4 9v6h4l6 5V4L8 9H4z" fill="currentColor"/><path d="M16 9l5 6m0-6l-5 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  lungs:
    '<path d="M12 3v8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' +
    '<path d="M10 8c-2 2-4 3-4 7 0 3 1.4 5 3 5s3-1.6 3-4v-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' +
    '<path d="M14 8c2 2 4 3 4 7 0 3-1.4 5-3 5s-3-1.6-3-4v-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  crosshair:
    '<circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="2" fill="none"/>' +
    '<circle cx="12" cy="12" r="1.6" fill="currentColor"/>' +
    '<path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="2"/>',
  echo:
    '<circle cx="9" cy="12" r="2.4" fill="currentColor"/>' +
    '<path d="M13.5 8a5.6 5.6 0 010 8M16.5 5.4a9.4 9.4 0 010 13.2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  scope:
    '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/>' +
    '<path d="M12 6v3M12 15v3M6 12h3M15 12h3" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  ruler:
    '<rect x="3" y="9" width="18" height="6" rx="1" stroke="currentColor" stroke-width="2" fill="none"/>' +
    '<path d="M7 9v3M11 9v2M15 9v3M19 9v2" stroke="currentColor" stroke-width="1.6"/>',
  star: '<path d="M12 2.8l2.8 5.8 6.2.8-4.6 4.3 1.2 6.3L12 17l-5.6 3l1.2-6.3L3 9.4l6.2-.8z" fill="currentColor"/>',
  wind: '<path d="M3 8h10a3 3 0 10-3-3M3 12h16a3 3 0 11-3 3M3 16h7a2.4 2.4 0 11-2.4 2.4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  timer: '<circle cx="12" cy="13" r="8" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 9v4l3 2M9 2h6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  mountain: '<path d="M3 19L10 6l4 7 2.4-3.4L21 19H3z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
  ammo: '<path d="M9 3h6v9l-1.5 2h-3L9 12V3z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M10 17h4M10.5 20h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  distance: '<path d="M4 20V9l8-5 8 5v11" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M9 20v-6h6v6" stroke="currentColor" stroke-width="2" fill="none"/>',
}

export function icon(name: keyof typeof ICONS | string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ''}</svg>`
}

/** Спрайт в начало документа: <use href="#icon-x"> ссылается сюда. */
export function installIconSprite(target: HTMLElement): void {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('style', 'display:none')
  for (const name of Object.keys(ICONS)) {
    const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'symbol')
    symbol.setAttribute('id', `icon-${name}`)
    symbol.setAttribute('viewBox', '0 0 24 24')
    symbol.innerHTML = ICONS[name]
    svg.appendChild(symbol)
  }
  target.appendChild(svg)
}
