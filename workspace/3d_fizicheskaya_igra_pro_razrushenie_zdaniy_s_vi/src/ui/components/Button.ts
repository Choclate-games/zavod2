import { icon } from '../icons'

export type ButtonOptions = {
  label?: string
  iconName?: string
  variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'icon'
  onClick: () => void
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  const variant = options.variant ?? 'default'
  if (variant === 'icon') {
    button.className = 'btn btn--icon'
    button.innerHTML = options.iconName ? icon(options.iconName) : ''
  } else {
    let cls = 'btn'
    if (variant === 'primary') cls += ' btn--primary'
    if (variant === 'danger') cls += ' btn--danger'
    if (variant === 'ghost') cls += ' btn--ghost'
    button.className = cls
    button.innerHTML =
      (options.iconName ? icon(options.iconName) : '') +
      (options.label ? `<span>${options.label}</span>` : '')
  }
  button.addEventListener('click', () => {
    options.onClick()
  })
  return button
}

export function el(tag: string, className?: string, textContent?: string): HTMLElement {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (textContent !== undefined) node.textContent = textContent
  return node
}
