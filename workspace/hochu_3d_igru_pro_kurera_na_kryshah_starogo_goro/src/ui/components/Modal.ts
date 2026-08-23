import { createButton } from './Button'
import { createPanel } from './Panel'

export interface ModalOptions {
  title: string
  content: string
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
}

export function showModal(options: ModalOptions): void {
  const modalsLayer = document.getElementById('modals-layer')
  if (!modalsLayer) return

  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.style.position = 'fixed'
  backdrop.style.inset = '0'
  backdrop.style.display = 'flex'
  backdrop.style.alignItems = 'center'
  backdrop.style.justifyContent = 'center'
  backdrop.style.pointerEvents = 'auto'
  backdrop.style.zIndex = 'var(--z-modal)'
  backdrop.style.padding = 'calc(var(--space-4) * var(--ui-scale))'

  const panel = createPanel({ className: 'modal-panel' })
  panel.style.maxWidth = '420px'
  panel.style.width = '100%'
  panel.style.padding = 'calc(var(--space-6) * var(--ui-scale))'
  panel.style.display = 'flex'
  panel.style.flexDirection = 'column'
  panel.style.gap = 'calc(var(--space-4) * var(--ui-scale))'

  const titleEl = document.createElement('h2')
  titleEl.className = 'modal-title'
  titleEl.style.fontFamily = 'var(--font-display)'
  titleEl.style.color = 'var(--color-primary)'
  titleEl.style.fontSize = 'clamp(18px, calc(22px * var(--ui-scale)), 26px)'
  titleEl.textContent = options.title
  panel.appendChild(titleEl)

  const contentEl = document.createElement('p')
  contentEl.className = 'modal-content'
  contentEl.style.color = 'var(--color-text-secondary)'
  contentEl.style.fontSize = 'clamp(14px, calc(15px * var(--ui-scale)), 17px)'
  contentEl.style.lineHeight = '1.5'
  contentEl.textContent = options.content
  panel.appendChild(contentEl)

  const actions = document.createElement('div')
  actions.style.display = 'flex'
  actions.style.gap = 'calc(var(--space-3) * var(--ui-scale))'
  actions.style.marginTop = 'calc(var(--space-2) * var(--ui-scale))'

  const confirmBtn = createButton({
    text: options.confirmText || 'ПОДТВЕРДИТЬ',
    variant: 'primary',
    onClick: async () => {
      confirmBtn.setLoading(true)
      await options.onConfirm?.()
      close()
    },
  })
  actions.appendChild(confirmBtn.element)

  if (options.cancelText) {
    const cancelBtn = createButton({
      text: options.cancelText,
      variant: 'secondary',
      onClick: () => {
        options.onCancel?.()
        close()
      },
    })
    actions.appendChild(cancelBtn.element)
  }

  panel.appendChild(actions)
  backdrop.appendChild(panel)
  modalsLayer.appendChild(backdrop)

  function close() {
    backdrop.remove()
  }
}
