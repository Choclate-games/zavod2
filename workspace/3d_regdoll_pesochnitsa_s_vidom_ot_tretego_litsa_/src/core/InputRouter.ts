import { bus } from './EventBus.ts'

export type SchemeMode = 'desktop' | 'touch'

/**
 * Единственный роутер ввода. Игровые системы читают состояние отсюда и не
 * вешают keydown/pointerdown сами. Активна ровно одна схема; переключение
 * на лету сбрасывает все зажатые оси и кнопки.
 */
export class InputRouter {
  mode: SchemeMode = 'desktop'
  /** Прицеливание активно: палец или ЛКМ/Пробел удерживается. */
  aiming = false
  aimCurrentX = 0
  aimCurrentY = 0
  aimStartX = 0
  aimStartY = 0
  /** Оси подруливания в полёте: -1..1. */
  steerPitch = 0
  steerRoll = 0

  private launchQueued = false
  private kickQueued = false
  private readonly keys = new Set<string>()
  private detachFns: Array<() => void> = []

  install(): void {
    const forced = new URLSearchParams(window.location.search).get('input')
    if (forced === 'touch' || forced === 'desktop') this.setScheme(forced)
    else this.autoDetect()

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.repeat) return
      // В тач-режиме клавиатура существует только для переключения схемы:
      // игровые действия остаются у активной раскладки.
      const wasTouch = this.mode === 'touch'
      if (wasTouch) this.setScheme('desktop')
      this.keys.add(e.code)
      if (wasTouch) return
      if (e.code === 'Space') {
        e.preventDefault()
        this.beginAim(window.innerWidth / 2, window.innerHeight / 2)
      } else if (e.code === 'KeyR') {
        bus.emit('input:restart', undefined)
      }
    }
    const onKeyUp = (e: KeyboardEvent): void => {
      this.keys.delete(e.code)
      if (e.code === 'Space') this.endAim()
    }
    const onMouseDown = (e: MouseEvent): void => {
      if (this.mode !== 'desktop' || e.button !== 0) return
      // Клик по кнопке интерфейса — не прицел.
      const target = e.target as HTMLElement | null
      if (target && target.closest('button, [data-action]')) return
      this.beginAim(e.clientX, e.clientY)
    }
    const onMouseMove = (e: MouseEvent): void => {
      if (this.mode !== 'desktop' || !this.aiming) return
      this.aimCurrentX = e.clientX
      this.aimCurrentY = e.clientY
    }
    const onMouseUp = (e: MouseEvent): void => {
      if (this.mode !== 'desktop') return
      if (e.button === 0) this.endAim()
    }
    const onBlur = (): void => this.releaseAll()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onBlur)

    // Живое переключение на тач: настоящий палец возвращает мобильную схему.
    const onTouchPointerDown = (e: PointerEvent): void => {
      if (e.pointerType === 'touch' && this.mode !== 'touch') this.setScheme('touch')
    }
    document.addEventListener('pointerdown', onTouchPointerDown, true)

    this.detachFns.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => window.removeEventListener('mousedown', onMouseDown),
      () => window.removeEventListener('mousemove', onMouseMove),
      () => window.removeEventListener('mouseup', onMouseUp),
      () => window.removeEventListener('blur', onBlur),
      () => document.removeEventListener('visibilitychange', onBlur),
      () => document.removeEventListener('pointerdown', onTouchPointerDown, true),
    )
  }

  dispose(): void {
    for (const fn of this.detachFns) fn()
    this.detachFns.length = 0
  }

  autoDetect(): void {
    const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const narrow = Math.min(window.innerWidth, window.innerHeight) < 720
    this.setScheme(touchCapable && narrow ? 'touch' : 'desktop')
  }

  setScheme(mode: SchemeMode): void {
    if (this.mode === mode) return
    bus.emit('input:schemeChanged', mode)
    this.releaseAll()
    this.mode = mode
  }

  releaseAll(): void {
    this.aiming = false
    this.steerPitch = 0
    this.steerRoll = 0
    this.launchQueued = false
    this.kickQueued = false
    this.keys.clear()
  }

  beginAim(x: number, y: number): void {
    this.aiming = true
    this.aimStartX = x
    this.aimStartY = y
    this.aimCurrentX = x
    this.aimCurrentY = y
  }

  moveAim(x: number, y: number): void {
    if (!this.aiming) return
    this.aimCurrentX = x
    this.aimCurrentY = y
  }

  endAim(): void {
    if (!this.aiming) return
    this.aiming = false
    this.launchQueued = true
  }

  queueKick(): void {
    this.kickQueued = true
  }

  consumeLaunch(): boolean {
    const value = this.launchQueued
    this.launchQueued = false
    return value
  }

  consumeKick(): boolean {
    const value = this.kickQueued
    this.kickQueued = false
    return value
  }

  /** Вектор натяжения в экранных координатах: тянем назад от старта. */
  pullVector(out: { x: number; y: number }): void {
    out.x = this.aimCurrentX - this.aimStartX
    out.y = this.aimCurrentY - this.aimStartY
  }

  /** Оси с клавиатуры для десктопной схемы подруливания. */
  applyKeyboardSteer(): void {
    if (this.mode !== 'desktop') return
    let pitch = 0
    let roll = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) pitch += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) pitch -= 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) roll -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) roll += 1
    this.steerPitch = pitch
    this.steerRoll = roll
  }
}
