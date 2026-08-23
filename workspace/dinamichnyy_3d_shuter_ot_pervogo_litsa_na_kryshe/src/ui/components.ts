// Компоненты UI: закрытый набор примитивов. DOM создаётся только здесь
// и в screens/; текст игрока пишется через textContent, не innerHTML.

import { icon, type IconName } from './icons'

export interface ButtonHandle {
  root: HTMLButtonElement
  setDisabled(disabled: boolean): void
  setLoading(loading: boolean): void
}

export function createButton(label: string, onClick: () => void, iconName?: IconName, primary = false): ButtonHandle {
  const root = document.createElement('button')
  root.type = 'button'
  root.classList.add('btn')
  if (primary) root.classList.add('primary')
  if (iconName != null) {
    const span = document.createElement('span')
    span.style.display = 'contents'
    span.innerHTML = icon(iconName)
    root.appendChild(span)
  }
  const text = document.createElement('span')
  text.textContent = label
  root.appendChild(text)
  root.addEventListener('click', onClick)
  return {
    root,
    setDisabled(disabled: boolean): void {
      if (disabled) root.setAttribute('disabled', '')
      else root.removeAttribute('disabled')
    },
    setLoading(loading: boolean): void {
      root.classList.toggle('loading', loading)
      this.setDisabled(loading)
    },
  }
}

export function createIconButton(iconName: IconName, label: string, onClick: () => void): ButtonHandle {
  const handle = createButton('', onClick)
  handle.root.classList.remove('btn')
  handle.root.classList.add('icon-btn')
  handle.root.setAttribute('aria-label', label)
  handle.root.textContent = ''
  handle.root.innerHTML = icon(iconName)
  return handle
}

export function el(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag)
  if (className != null) node.className = className
  return node
}

export function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.className = 'game-canvas'
  return canvas
}

export function meter(fillColor: string): { root: HTMLElement; fill: HTMLElement } {
  const root = el('div', 'meter')
  const fill = el('div', 'meter-fill')
  fill.style.background = fillColor
  root.appendChild(fill)
  return { root, fill }
}
