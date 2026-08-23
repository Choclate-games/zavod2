import { icon } from '../icons'
import { t } from '../../data/i18n'

/**
 * Кнопка из закрытого набора компонентов: rest/hover/active/disabled/loading,
 * размер зон нажатия задаёт тема, текст — только ключи локализации.
 */
export type ButtonVariant = 'default' | 'primary' | 'danger'

export interface ButtonOptions {
  variant?: ButtonVariant
  iconName?: string
  labelKey: string
  primaryAction?: boolean
  onClick: () => void
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
  const button = document.createElement('button')
  const classes = ['btn']
  if (options.primaryAction) classes.push('btn-primary')
  else if (options.variant === 'primary') classes.push('btn-primary')
  if (options.variant === 'danger') classes.push('btn-danger')
  button.className = classes.join(' ')
  if (options.iconName) {
    const holder = document.createElement('span')
    holder.innerHTML = icon(options.iconName)
    button.appendChild(holder)
  }
  const label = document.createElement('span')
  label.textContent = t(options.labelKey)
  button.appendChild(label)
  button.addEventListener('click', () => {
    button.classList.add('loading')
    try {
      options.onClick()
    } finally {
      button.classList.remove('loading')
    }
  })
  return button
}
