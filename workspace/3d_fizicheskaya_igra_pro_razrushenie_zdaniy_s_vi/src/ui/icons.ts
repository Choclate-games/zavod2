/** Один инлайновый SVG-спрайт; цвет всегда currentColor, эмодзи запрещены. */

const ICONS: Record<string, string> = {
  play: '<path d="M8 5v14l11-7z"/>',
  pause: '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>',
  restart: '<path d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/>',
  star: '<path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17l-6.1 3.6 1.4-6.8L2.2 9.1l6.9-.8z"/>',
  wedge:
    '<path d="M12 2 3 21h18L12 2zm0 4.6L17.4 19H6.6L12 6.6z"/><rect x="10.6" y="12" width="2.8" height="6" rx="1"/>',
  camera: '<path d="M4 7h3l2-2h6l2 2h3v12H4zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill-rule="evenodd"/>',
  soundOn: '<path d="M3 9v6h4l5 5V4L7 9zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/>',
  soundOff: '<path d="M3 9v6h4l5 5V4L7 9zm16.2 3 2.3-2.3-1.4-1.4-2.3 2.3-2.3-2.3-1.4 1.4L16.4 12l-2.3 2.3 1.4 1.4 2.3-2.3 2.3 2.3 1.4-1.4z"/>',
  close: '<path d="m6 5 13 13-1.4 1.4L4.6 6.4zM19 5 6 18l-1.4-1.4L17.6 3.6z"/>',
  lock: '<path d="M17 9V7A5 5 0 0 0 7 7v2H5v12h14V9zm-8-2a3 3 0 0 1 6 0v2H9zm3 6a2 2 0 0 1 1 3.7V19h-2v-2.3a2 2 0 0 1 1-3.7z" fill-rule="evenodd"/>',
  menu: '<path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/>',
}

let spriteInjected = false

export function injectIconSprite(): void {
  if (spriteInjected) return
  spriteInjected = true
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden')
  svg.setAttribute('aria-hidden', 'true')
  let defs = ''
  for (const [name, body] of Object.entries(ICONS)) {
    defs += `<symbol id="icon-${name}" viewBox="0 0 24 24">${body}</symbol>`
  }
  svg.innerHTML = defs
  document.body.appendChild(svg)
}

export function icon(name: string): string {
  return `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`
}
