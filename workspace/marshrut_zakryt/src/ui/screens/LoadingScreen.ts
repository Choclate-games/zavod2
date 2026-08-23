/** Экран загрузки: силуэт города и процент по реальным вехам, до 100. */
export class LoadingScreen {
  readonly root: HTMLElement
  private readonly value: HTMLElement
  private readonly fill: HTMLElement
  private lastShown = -1

  constructor() {
    this.root = document.createElement('div')
    this.root.className = 'screen screen--loading'

    const wrap = document.createElement('div')
    wrap.className = 'loading__wrap'

    const label = document.createElement('div')
    label.className = 'loading__label'
    label.textContent = 'Подготовка маршрута'

    this.value = document.createElement('div')
    this.value.className = 'loading__value'
    this.value.textContent = '0'

    const track = document.createElement('div')
    track.className = 'loading__track'
    this.fill = document.createElement('div')
    this.fill.className = 'loading__fill'
    track.appendChild(this.fill)

    wrap.append(label, this.value, track)
    this.root.appendChild(wrap)
  }

  show(): void {
    this.root.classList.add('is-visible')
  }

  hide(): void {
    this.root.classList.remove('is-visible')
  }

  setProgress(percent: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)))
    if (clamped <= this.lastShown) return
    this.lastShown = clamped
    this.value.textContent = String(clamped)
    this.fill.style.transform = `scaleX(${clamped / 100})`
  }
}
