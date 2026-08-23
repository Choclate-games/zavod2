import { icon, type IconName } from './icons.ts'

/** Кнопка: единственный источник кнопок интерфейса. */
export function createButton(
  label: string,
  options: {
    variant?: 'default' | 'primary' | 'retry' | 'icon'
    iconName?: IconName
    onClick?: () => void
    hidden?: boolean
  } = {},
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  const variant = options.variant ?? 'default'
  button.className = variant === 'default' ? 'btn' : `btn btn-${variant}`
  if (options.iconName) {
    button.innerHTML = icon(options.iconName)
    if (label) {
      const span = document.createElement('span')
      span.textContent = label
      button.appendChild(span)
    }
  } else {
    button.textContent = label
  }
  if (options.hidden) button.hidden = true
  if (options.onClick) button.addEventListener('click', options.onClick)
  return button
}

/** Панель-подложка только под текстом и кнопками. */
export function createPanel(): HTMLDivElement {
  const panel = document.createElement('div')
  panel.className = 'panel'
  return panel
}

/** Заголовок экрана. */
export function createTitle(text: string): HTMLHeadingElement {
  const title = document.createElement('h1')
  title.className = 'title'
  title.textContent = text
  return title
}

/** Подпись под заголовком. */
export function createSubtitle(text: string): HTMLParagraphElement {
  const subtitle = document.createElement('p')
  subtitle.className = 'subtitle'
  subtitle.textContent = text
  return subtitle
}

/** Ряд второстепенных действий одним весом. */
export function createRow(): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'row'
  return row
}

/**
 * Полоса прогресса: анимируется transform: scaleX, не width.
 * Возвращает корень и функцию записи значения 0..1 без перекомпоновки.
 */
export function createMeter(): { root: HTMLDivElement; set: (fraction: number) => void } {
  const root = document.createElement('div')
  root.className = 'star-progress-track'
  const fill = document.createElement('div')
  fill.className = 'star-progress-fill'
  root.appendChild(fill)
  let last = -1
  const set = (fraction: number): void => {
    const clamped = Math.max(0, Math.min(1, fraction))
    if (clamped === last) return
    last = clamped
    fill.style.transform = `scaleX(${clamped})`
  }
  return { root, set }
}
