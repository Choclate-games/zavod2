/**
 * Тач-схема управления: драг по левой/центральной зоне (70% ширины) вращает
 * прожектор, справа — крупная кнопка ФОКУС и кнопка парового сброса.
 * Только Pointer Events с setPointerCapture и учётом pointerId на кнопку.
 * Слой создаётся ТОЛЬКО в тач-схеме и монтируется в корень интерфейса.
 */
export class TouchControls {
  readonly root: HTMLDivElement

  private focusHeld = false
  private aimAccumulated = 0
  private steamQueued = false
  private dragPointerId: number | null = null
  private lastDragX = 0
  private readonly focusPointers = new Set<number>()

  constructor(host: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'touch-layer'
    this.root.innerHTML = `
      <div class="touch-drag-zone" data-touch-zone="aim"></div>
      <div class="touch-actions">
        <button class="touch-btn touch-btn-secondary" data-touch-btn="steam" aria-label="Паровой сброс">
          <span class="touch-btn-icon" data-icon="steam"></span>
          <span class="touch-btn-label">СБРОС</span>
        </button>
        <button class="touch-btn touch-btn-primary" data-touch-btn="focus" aria-label="Фокус луча">
          <span class="touch-btn-icon" data-icon="focus"></span>
          <span class="touch-btn-label">ФОКУС</span>
        </button>
      </div>`

    const zone = this.root.querySelector('[data-touch-zone="aim"]') as HTMLElement
    zone.addEventListener('pointerdown', this.onZoneDown)
    zone.addEventListener('pointermove', this.onZoneMove)
    zone.addEventListener('pointerup', this.onZoneUp)
    zone.addEventListener('pointercancel', this.onZoneUp)

    const focusBtn = this.root.querySelector('[data-touch-btn="focus"]') as HTMLElement
    focusBtn.addEventListener('pointerdown', this.onFocusDown)
    focusBtn.addEventListener('pointerup', this.onFocusUp)
    focusBtn.addEventListener('pointercancel', this.onFocusUp)
    focusBtn.addEventListener('pointerleave', this.onFocusUp)

    const steamBtn = this.root.querySelector('[data-touch-btn="steam"]') as HTMLElement
    steamBtn.addEventListener('pointerdown', () => {
      this.steamQueued = true
    })

    host.appendChild(this.root)
  }

  private onZoneDown = (event: PointerEvent): void => {
    if (this.dragPointerId !== null) return
    this.dragPointerId = event.pointerId
    this.lastDragX = event.clientX
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  private onZoneMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) return
    // Драг вправо вращает прожектор вправо; множитель подобран под 360° за ~полтора взмаха.
    this.aimAccumulated += (event.clientX - this.lastDragX) * 0.0062
    this.lastDragX = event.clientX
  }

  private onZoneUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) return
    this.dragPointerId = null
  }

  private onFocusDown = (event: PointerEvent): void => {
    this.focusPointers.add(event.pointerId)
    this.focusHeld = true
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  private onFocusUp = (event: PointerEvent): void => {
    this.focusPointers.delete(event.pointerId)
    if (this.focusPointers.size === 0) this.focusHeld = false
  }

  get isFocusHeld(): boolean {
    return this.focusHeld
  }

  consumeAimDelta(): number {
    const delta = this.aimAccumulated
    this.aimAccumulated = 0
    return delta
  }

  consumeSteamPress(): boolean {
    const pressed = this.steamQueued
    this.steamQueued = false
    return pressed
  }

  releaseAll(): void {
    this.focusPointers.clear()
    this.focusHeld = false
    this.dragPointerId = null
    this.aimAccumulated = 0
    this.steamQueued = false
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('is-hidden', !visible)
    if (!visible) this.releaseAll()
  }

  destroy(): void {
    this.root.remove()
  }
}
