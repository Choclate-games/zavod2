import { iconSvg, type IconName } from '../icons'

/**
 * Закрытый набор компонентов интерфейса. Каждый строит DOM и возвращает
 * небольшой handle. Данные игрока идут только через textContent.
 */
export interface ButtonHandle {
  root: HTMLButtonElement
  setDisabled(disabled: boolean): void
  setLoading(loading: boolean): void
}

export function createButton(
  label: string,
  options: { primary?: boolean; small?: boolean; iconName?: IconName } = {},
): ButtonHandle {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'btn'
  if (options.primary) button.classList.add('primary')
  if (options.small) button.classList.add('small')
  if (options.iconName) {
    const span = document.createElement('span')
    span.innerHTML = iconSvg(options.iconName)
    button.appendChild(span)
  }
  const textNode = document.createElement('span')
  textNode.textContent = label
  button.appendChild(textNode)
  return {
    root: button,
    setDisabled(disabled: boolean): void {
      if (disabled) button.setAttribute('disabled', '')
      else button.removeAttribute('disabled')
    },
    setLoading(loading: boolean): void {
      button.classList.toggle('loading', loading)
    },
  }
}

export function createIconButton(iconName: IconName, label: string): ButtonHandle {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'btn icon-btn'
  button.setAttribute('aria-label', label)
  const span = document.createElement('span')
  span.innerHTML = iconSvg(iconName)
  button.appendChild(span)
  return {
    root: button,
    setDisabled(disabled: boolean): void {
      if (disabled) button.setAttribute('disabled', '')
      else button.removeAttribute('disabled')
    },
    setLoading(loading: boolean): void {
      button.classList.toggle('loading', loading)
    },
  }
}

export function createChip(iconName: IconName | null, initialText: string): { root: HTMLDivElement; setText(value: string): void } {
  const chip = document.createElement('div')
  chip.className = 'hud-chip'
  if (iconName) {
    const icon = document.createElement('span')
    icon.innerHTML = iconSvg(iconName)
    chip.appendChild(icon)
  }
  const value = document.createElement('span')
  value.className = 'stat-value'
  value.textContent = initialText
  chip.appendChild(value)
  return {
    root: chip,
    setText(next: string): void {
      if (value.textContent !== next) value.textContent = next
    },
  }
}
