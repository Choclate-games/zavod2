import type { EventBus } from '../core/EventBus.js'
import { TouchControls } from '../ui/TouchControls.js'

export interface InputSnapshot {
  /** Накопленный дельта-поворот прицела за кадр, радианы. */
  aimDelta: number
  /** Направление с клавиатуры: -1 влево, +1 вправо. */
  keyboardAim: number
  focus: boolean
}

/**
 * Роутер ввода: ровно одна активная схема (клавиатура+мышь или тач).
 * Схему выбирает тип устройства от моста; ?input=touch|desktop и ?touch=1|0
 * форсируют режим и отключают автопереключение. Игровые системы не слушают
 * события ввода сами — только читают состояние отсюда.
 */
export class InputRouter {
  readonly snapshot: InputSnapshot = { aimDelta: 0, keyboardAim: 0, focus: false }

  private scheme: 'desktop' | 'touch' = 'desktop'
  private forced = false
  private pauseRequested = false
  private muteRequested = false
  private confirmRequested = false
  private lastClientX: number | null = null
  private mouseFocusHeld = false
  private touchControls: TouchControls | null = null
  private readonly heldKeys = new Set<string>()

  constructor(
    private readonly events: EventBus,
    deviceType: 'mobile' | 'tablet' | 'desktop',
    private readonly uiRoot: HTMLElement,
    sensitivity: number,
  ) {
    this.sensitivity = sensitivity
    const params = new URLSearchParams(window.location.search)
    const forcedInput = params.get('input')
    const forcedTouch = params.get('touch')
    if (forcedInput === 'touch' || forcedTouch === '1') {
      this.scheme = 'touch'
      this.forced = true
    } else if (forcedInput === 'desktop' || forcedTouch === '0') {
      this.scheme = 'desktop'
      this.forced = true
    } else {
      this.scheme = deviceType === 'mobile' || deviceType === 'tablet' ? 'touch' : 'desktop'
    }

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.releaseAll)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.releaseAll()
    })
    document.addEventListener('pointermove', this.onPointerMove)
    document.addEventListener('pointerdown', this.onPointerDown)
    document.addEventListener('contextmenu', (event) => event.preventDefault())
    document.addEventListener('dragstart', (event) => event.preventDefault())

    this.applyScheme(this.scheme)
  }

  private readonly sensitivity: number

  get activeScheme(): 'desktop' | 'touch' {
    return this.scheme
  }

  get isTouchScheme(): boolean {
    return this.scheme === 'touch'
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return
    this.heldKeys.add(event.code)
    if (!this.forced && this.scheme !== 'desktop') this.applyScheme('desktop')
    if (event.code === 'Escape' || event.code === 'KeyP') this.pauseRequested = true
    else if (event.code === 'KeyM') this.muteRequested = true
    else if (event.code === 'Enter') this.confirmRequested = true
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    this.heldKeys.delete(event.code)
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (this.scheme !== 'desktop' || event.pointerType === 'touch') return
    if (this.lastClientX !== null) {
      this.snapshot.aimDelta += (event.clientX - this.lastClientX) * this.sensitivity
    }
    this.lastClientX = event.clientX
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' && !this.forced && this.scheme !== 'touch') {
      this.applyScheme('touch')
    }
    if (this.scheme !== 'desktop' || event.pointerType === 'touch') return
    // ЛКМ и ПКМ держат фокус прожигающего луча.
    if (event.button === 0 || event.button === 2) this.mouseFocusHeld = true
  }

  releaseAll = (): void => {
    this.heldKeys.clear()
    this.mouseFocusHeld = false
    this.snapshot.aimDelta = 0
    this.snapshot.focus = false
    this.touchControls?.releaseAll()
  }

  /** Переключение схемы на лету: сначала отпускаются все зажатые оси и кнопки. */
  private applyScheme(scheme: 'desktop' | 'touch'): void {
    this.releaseAll()
    this.lastClientX = null
    if (this.touchControls) {
      this.touchControls.destroy()
      this.touchControls = null
    }
    this.scheme = scheme
    if (scheme === 'touch') {
      this.touchControls = new TouchControls(this.uiRoot)
    }
    this.events.emit('input:scheme', { scheme })
  }

  /** Снимок состояния на кадр: дельта прицела, клавиатурный поворот, фокус. */
  readSnapshot(): InputSnapshot {
    const snap = this.snapshot
    let keyboardAim = 0
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) keyboardAim -= 1
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) keyboardAim += 1
    snap.keyboardAim = keyboardAim
    const touch = this.touchControls
    if (this.scheme === 'touch' && touch) {
      snap.aimDelta += touch.consumeAimDelta()
      snap.focus = touch.isFocusHeld
      this.steamRequested = touch.consumeSteamPress()
    } else {
      snap.focus = this.mouseFocusHeld || this.heldKeys.has('Space')
      if (this.heldKeys.has('KeyE') || this.heldKeys.has('KeyF')) this.steamRequested = true
    }
    return snap
  }

  private steamRequested = false

  consumeSteam(): boolean {
    const value = this.steamRequested
    this.steamRequested = false
    return value
  }

  consumePause(): boolean {
    const value = this.pauseRequested
    this.pauseRequested = false
    return value
  }

  consumeMute(): boolean {
    const value = this.muteRequested
    this.muteRequested = false
    return value
  }

  consumeConfirm(): boolean {
    const value = this.confirmRequested
    this.confirmRequested = false
    return value
  }

  /** Управление видно только в игровом процессе; при скрытии оси сбрасываются. */
  setControlsVisible(visible: boolean): void {
    this.touchControls?.setVisible(visible)
    if (!visible) this.releaseAll()
  }
}
