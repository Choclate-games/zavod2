import { events } from '../core/EventBus'
import { CaliberType } from '../types'

export class TouchControls {
  private container: HTMLElement
  private aimZone: HTMLElement
  private activePointers = new Map<number, { startX: number; startY: number; lastX: number; lastY: number }>()

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div')
    this.container.id = 'touch-controls'

    this.aimZone = document.createElement('div')
    this.aimZone.className = 'touch-aim-zone'
    this.container.appendChild(this.aimZone)

    this.setupCaliberButtons()
    this.setupUtilButtons()
    this.setupPointerListeners()

    parent.appendChild(this.container)

    // Check ?touch=1 query param
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('touch') === '1' || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
      events.emit('TOUCH_CAPABILITY_DETECTED', true)
    }
  }

  private setupCaliberButtons(): void {
    const bar = document.createElement('div')
    bar.className = 'touch-caliber-bar'

    const calibers: Array<{ type: CaliberType; label: string; desc: string }> = [
      { type: '25mm', label: '25MM', desc: 'GAU-12' },
      { type: '40mm', label: '40MM', desc: 'BOFORS' },
      { type: '105mm', label: '105MM', desc: 'M102' }
    ]

    for (const c of calibers) {
      const btn = document.createElement('button')
      btn.className = `touch-caliber-btn ${c.type === '25mm' ? 'selected' : ''}`
      btn.dataset.caliber = c.type
      btn.innerHTML = `<span>${c.label}</span><span style="font-size: 10px; opacity: 0.8">${c.desc}</span>`

      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation()
        events.emit('TOUCH_SELECT_CALIBER', c.type)
        events.emit('TOUCH_FIRE_START', c.type)
        this.updateSelectedCaliberUI(c.type)
      })

      btn.addEventListener('pointerup', (e) => {
        e.stopPropagation()
        events.emit('TOUCH_FIRE_END', c.type)
      })

      btn.addEventListener('pointercancel', () => {
        events.emit('TOUCH_FIRE_END', c.type)
      })

      bar.appendChild(btn)
    }

    this.container.appendChild(bar)
  }

  private setupUtilButtons(): void {
    const utilGroup = document.createElement('div')
    utilGroup.style.position = 'absolute'
    utilGroup.style.top = 'calc(var(--space-4) * var(--ui-scale) + var(--safe-top))'
    utilGroup.style.right = 'calc(var(--space-4) * var(--ui-scale) + var(--safe-right))'
    utilGroup.style.display = 'flex'
    utilGroup.style.gap = 'calc(var(--space-2) * var(--ui-scale))'
    utilGroup.style.pointerEvents = 'auto'

    // Zoom Button (1x / 2x / 4x)
    const zoomBtn = document.createElement('button')
    zoomBtn.className = 'touch-util-btn'
    zoomBtn.textContent = 'ZOOM'
    zoomBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      events.emit('TOUCH_CYCLE_ZOOM', true)
    })
    utilGroup.appendChild(zoomBtn)

    // Palette Switch (W-HOT / B-HOT)
    const palBtn = document.createElement('button')
    palBtn.className = 'touch-util-btn'
    palBtn.textContent = 'FLIR'
    palBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      events.emit('TOUCH_CYCLE_PALETTE', true)
    })
    utilGroup.appendChild(palBtn)

    this.container.appendChild(utilGroup)
  }

  private updateSelectedCaliberUI(caliber: CaliberType): void {
    const buttons = this.container.querySelectorAll('.touch-caliber-btn')
    buttons.forEach((b) => {
      const el = b as HTMLElement
      if (el.dataset.caliber === caliber) {
        el.classList.add('selected')
      } else {
        el.classList.remove('selected')
      }
    })
  }

  private setupPointerListeners(): void {
    this.aimZone.addEventListener('pointerdown', (e) => {
      this.aimZone.setPointerCapture(e.pointerId)
      this.activePointers.set(e.pointerId, {
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY
      })
      events.emit('TOUCH_AIM_START', { x: e.clientX, y: e.clientY })
    })

    this.aimZone.addEventListener('pointermove', (e) => {
      const p = this.activePointers.get(e.pointerId)
      if (p) {
        const dx = e.clientX - p.lastX
        const dy = e.clientY - p.lastY
        p.lastX = e.clientX
        p.lastY = e.clientY
        events.emit('TOUCH_AIM_DELTA', { dx, dy })
      }
    })

    const endPointer = (_e: PointerEvent) => {
      this.activePointers.delete(_e.pointerId)
      events.emit('TOUCH_AIM_END', true)
    }

    this.aimZone.addEventListener('pointerup', endPointer)
    this.aimZone.addEventListener('pointercancel', endPointer)

    // Prevent context menu and accidental browser gestures
    this.container.addEventListener('contextmenu', (e) => e.preventDefault())
    this.container.addEventListener('dragstart', (e) => e.preventDefault())
  }

  public setVisible(visible: boolean): void {
    if (visible) {
      this.container.classList.add('active')
    } else {
      this.container.classList.remove('active')
      this.reset()
    }
  }

  public reset(): void {
    this.activePointers.clear()
    events.emit('TOUCH_FIRE_END', '25mm')
    events.emit('TOUCH_FIRE_END', '40mm')
    events.emit('TOUCH_FIRE_END', '105mm')
  }
}
