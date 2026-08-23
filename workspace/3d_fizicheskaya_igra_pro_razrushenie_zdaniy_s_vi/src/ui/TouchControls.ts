import { createButton, el } from './components/Button'
import type { EventBus } from '../core/EventBus'
import type { InputRouter } from '../input/InputRouter'
import type { I18n } from './i18n'

/**
 * Слой экранного управления: полноэкранная жестовая поверхность (прицел свайпом,
 * два пальца — орбита, щипок — зум) и кнопки действий. Создаётся и вставляется
 * в DOM только в тач-схеме; в десктопной схеме его не существует вовсе.
 */
export class TouchControls {
  private readonly surface: HTMLElement
  private readonly actionsRow: HTMLElement
  private readonly delayLabel: HTMLElement
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private mounted = false

  constructor(
    private readonly router: InputRouter,
    events: EventBus,
    i18n: I18n,
    onRestart: () => void,
    onView: () => void,
    onPause: () => void,
  ) {
    this.surface = el('div', 'touch-surface')
    this.surface.addEventListener('contextmenu', (e) => e.preventDefault())

    const hint = el('div', 'hud-label')
    hint.textContent = i18n.t('hintCutTouch')
    hint.style.cssText =
      'position:absolute;top:calc(var(--space-4) + env(safe-area-inset-top));left:50%;transform:translateX(-50%);background:var(--panel-veil);border-radius:var(--radius-m);padding:var(--space-2) var(--space-3);max-width:86vw;text-align:center'

    this.actionsRow = el('div', 'touch-actions')
    const stepper = el('div', 'delay-stepper')

    const minus = createButton({
      label: '-',
      variant: 'icon',
      onClick: () => events.emit('delay:adjust', { delta: -DELAY_STEP_S }),
    })
    this.delayLabel = el('span', 'num-slot telemetry', DELAY_LABEL_DEFAULT)
    this.delayLabel.style.minWidth = '6ch'
    this.delayLabel.style.textAlign = 'center'
    const plus = createButton({
      label: '+',
      variant: 'icon',
      onClick: () => events.emit('delay:adjust', { delta: DELAY_STEP_S }),
    })
    stepper.appendChild(minus)
    stepper.appendChild(this.delayLabel)
    stepper.appendChild(plus)
    stepper.appendChild(el('span', 'hud-label', i18n.t('delayLabel')))

    this.actionsRow.appendChild(stepper)
    this.actionsRow.appendChild(
      createButton({ label: i18n.t('restart'), iconName: 'restart', onClick: onRestart }),
    )
    this.actionsRow.appendChild(createButton({ iconName: 'camera', variant: 'icon', onClick: onView }))
    this.actionsRow.appendChild(createButton({ iconName: 'pause', variant: 'icon', onClick: onPause }))

    this.bindSurface()

    events.on('delay:value', ({ seconds }) => {
      this.setDelay(seconds)
    })
  }

  /** Вставка слоя в контейнер; вызывается только в тач-схеме. */
  mount(container: HTMLElement): void {
    if (this.mounted) return
    container.appendChild(this.surface)
    container.appendChild(this.actionsRow)
    this.mounted = true
  }

  unmount(): void {
    if (!this.mounted) return
    this.surface.remove()
    this.actionsRow.remove()
    this.mounted = false
    this.pointers.clear()
  }

  setDelay(seconds: number): void {
    this.delayLabel.textContent = `${seconds.toFixed(1)}s`
  }

  setVisible(visible: boolean): void {
    if (!this.mounted) return
    this.surface.classList.toggle('screen--hidden-hard', !visible)
    this.actionsRow.classList.toggle('screen--hidden-hard', !visible)
    if (!visible) this.pointers.clear()
  }

  private bindSurface(): void {
    let twoFingerLast: { x: number; y: number } | null = null
    this.surface.addEventListener(
      'pointerdown',
      (event) => {
        event.preventDefault()
        ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
        this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (this.pointers.size === 1) {
          routerAimStart(this.router, event.clientX, event.clientY, event.pointerType)
        } else {
          this.router.touchAimEnd()
          twoFingerLast = centroidOf(this.pointers)
        }
      },
      { passive: false },
    )
    this.surface.addEventListener(
      'pointermove',
      (event) => {
        const prev = this.pointers.get(event.pointerId)
        if (!prev) return
        this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (this.pointers.size === 1) {
          this.router.touchAimMove(event.clientX, event.clientY)
        } else if (this.pointers.size === 2) {
          const center = centroidOf(this.pointers)
          if (twoFingerLast) {
            this.router.touchOrbit(center.x - twoFingerLast.x, center.y - twoFingerLast.y)
            const dist = pinchDistance(this.pointers)
            if (dist > 0) this.router.touchPinch(dist)
          }
          twoFingerLast = center
        }
      },
      { passive: true },
    )
    const release = (event: PointerEvent): void => {
      this.pointers.delete(event.pointerId)
      if (this.pointers.size === 1) {
        twoFingerLast = null
        this.router.touchPinchEnd()
      }
      if (this.pointers.size === 0) {
        this.router.touchAimEnd()
      }
    }
    this.surface.addEventListener('pointerup', release)
    this.surface.addEventListener('pointercancel', release)
  }
}

const DELAY_STEP_S = 0.2
const DELAY_LABEL_DEFAULT = '1.8s'

function centroidOf(map: Map<number, { x: number; y: number }>): { x: number; y: number } {
  let sx = 0
  let sy = 0
  for (const point of map.values()) {
    sx += point.x
    sy += point.y
  }
  const size = Math.max(1, map.size)
  return { x: sx / size, y: sy / size }
}

function pinchDistance(map: Map<number, { x: number; y: number }>): number {
  const points = [...map.values()]
  if (points.length < 2) return 0
  return Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y)
}

/** Первый палец начинает прицел; второй переключает жест на орбиту. */
function routerAimStart(router: InputRouter, x: number, y: number, pointerType: string): void {
  if (pointerType === 'touch') {
    router.switchTo('touch')
  }
  router.touchAimStart(x, y)
}
