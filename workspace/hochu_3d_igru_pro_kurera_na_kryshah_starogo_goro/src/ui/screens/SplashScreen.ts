import { createProgressBar } from '../components/ProgressBar'

export class SplashScreen {
  public root: HTMLElement
  private progressBar: ReturnType<typeof createProgressBar>
  private statusText: HTMLElement

  constructor() {
    this.root = document.createElement('div')
    this.root.id = 'screen-splash'
    this.root.className = 'screen screen--blocking'

    // Header Zone
    const header = document.createElement('div')
    header.style.textAlign = 'center'
    header.style.marginTop = 'calc(var(--space-8) * var(--ui-scale))'

    const title = document.createElement('h1')
    title.textContent = 'ЧЕРЕПИЧНЫЙ СПРИНТ'
    title.style.fontFamily = 'var(--font-display)'
    title.style.color = 'var(--color-primary)'
    title.style.fontSize = 'clamp(24px, calc(32px * var(--ui-scale)), 42px)'
    title.style.letterSpacing = '2px'
    title.style.textShadow = '0 4px 16px rgba(0,0,0,0.8)'

    const subtitle = document.createElement('p')
    subtitle.textContent = 'ЧИСТЫЙ ФЛОУ'
    subtitle.style.fontFamily = 'var(--font-body)'
    subtitle.style.color = 'var(--color-safe)'
    subtitle.style.fontSize = 'clamp(14px, calc(16px * var(--ui-scale)), 20px)'
    subtitle.style.letterSpacing = '6px'
    subtitle.style.fontWeight = '700'
    subtitle.style.marginTop = 'calc(var(--space-1) * var(--ui-scale))'

    header.appendChild(title)
    header.appendChild(subtitle)
    this.root.appendChild(header)

    // Content Zone
    const content = document.createElement('div')
    content.style.width = '100%'
    content.style.maxWidth = '360px'
    content.style.textAlign = 'center'

    this.progressBar = createProgressBar('splash-progress')
    content.appendChild(this.progressBar.element)

    this.statusText = document.createElement('div')
    this.statusText.textContent = 'ПОДГОТОВКА СНАРЯЖЕНИЯ И КАРТ...'
    this.statusText.style.color = 'var(--color-text-secondary)'
    this.statusText.style.fontSize = 'clamp(12px, calc(13px * var(--ui-scale)), 15px)'
    this.statusText.style.marginTop = 'calc(var(--space-3) * var(--ui-scale))'
    this.statusText.style.letterSpacing = '1px'
    content.appendChild(this.statusText)

    this.root.appendChild(content)

    // Action / Footer Zone
    const footer = document.createElement('div')
    footer.style.color = 'var(--color-text-muted)'
    footer.style.fontSize = '12px'
    footer.style.marginBottom = 'calc(var(--space-4) * var(--ui-scale))'
    footer.textContent = 'ГИЛЬДИЯ КУРЬЕРОВ 1889'
    this.root.appendChild(footer)
  }

  public setProgress(percent: number, text?: string): void {
    this.progressBar.setProgress(percent)
    if (text) {
      this.statusText.textContent = text
    }
  }

  public show(): void {
    this.root.classList.remove('screen--hidden')
  }

  public hide(): void {
    this.root.classList.add('screen--hidden')
  }
}
