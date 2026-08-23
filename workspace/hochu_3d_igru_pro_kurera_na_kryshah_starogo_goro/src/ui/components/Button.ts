import { audioManager } from '../../audio/AudioManager'
import { createIcon, type ICONS } from '../icons'

export interface ButtonOptions {
  text: string
  variant?: 'primary' | 'secondary' | 'danger' | 'safe'
  icon?: keyof typeof ICONS
  onClick?: () => void | Promise<void>
  className?: string
}

export interface ButtonHandle {
  element: HTMLButtonElement
  setText: (text: string) => void
  setLoading: (loading: boolean) => void
  setDisabled: (disabled: boolean) => void
}

export function createButton(options: ButtonOptions): ButtonHandle {
  const btn = document.createElement('button')
  btn.className = `btn btn--${options.variant || 'secondary'} ${options.className || ''}`

  const iconContainer = document.createElement('span')
  iconContainer.className = 'btn__icon'
  if (options.icon) {
    iconContainer.appendChild(createIcon(options.icon))
    btn.appendChild(iconContainer)
  }

  const textSpan = document.createElement('span')
  textSpan.className = 'btn__text'
  textSpan.textContent = options.text
  btn.appendChild(textSpan)

  if (options.onClick) {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      audioManager.playUiClick()
      try {
        await options.onClick?.()
      } catch (err) {
        console.error('[Button] Click handler failed:', err)
      }
    })
  }

  return {
    element: btn,
    setText: (text: string) => {
      textSpan.textContent = text
    },
    setLoading: (loading: boolean) => {
      if (loading) {
        btn.classList.add('btn--loading')
        btn.disabled = true
      } else {
        btn.classList.remove('btn--loading')
        btn.disabled = false
      }
    },
    setDisabled: (disabled: boolean) => {
      btn.disabled = disabled
    },
  }
}
