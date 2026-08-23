import { events } from '../core/EventBus'
import { ICONS } from './icons'
import { RadioMessage, MissionStats } from '../types'
import { ballistics } from '../game/BallisticsManager'

export class Hud {
  private container: HTMLElement
  private timerEl: HTMLElement
  private radioTextEl: HTMLElement
  private radioSpeakerEl: HTMLElement
  private radioContainer: HTMLElement
  private dangerBannerEl: HTMLElement
  private dangerDistEl: HTMLElement
  private squadHealthEls: HTMLElement[] = []
  private caliberCards: Map<string, { el: HTMLElement; fillEl: HTMLElement; textEl: HTMLElement }> = new Map()
  private comboEl: HTMLElement
  private heatGaugeEl: HTMLElement

  // Telemetry elements
  private altEl: HTMLElement
  private azimEl: HTMLElement

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div')
    this.container.className = 'hud-layer'

    // 1. Top-Left Telemetry
    const topLeft = document.createElement('div')
    topLeft.className = 'hud-top-left'
    topLeft.innerHTML = `
      <div style="font-size: 11px; letter-spacing: 1px; color: var(--color-text-dim);">AC-130 SPECTRE // FLIR GEN-4</div>
      <div style="display: flex; gap: var(--space-3);">
        <span>ALT: <span class="tabular-nums" id="hud-alt">1000</span>M</span>
        <span>AZIM: <span class="tabular-nums" id="hud-azim">142</span>&deg;</span>
        <span>ZOOM: <span id="hud-zoom">1.0</span>X</span>
      </div>
    `
    this.container.appendChild(topLeft)
    this.altEl = topLeft.querySelector('#hud-alt')!
    this.azimEl = topLeft.querySelector('#hud-azim')!

    // 2. Top-Center Timer & Danger Warning
    const topCenter = document.createElement('div')
    topCenter.className = 'hud-top-center'

    this.timerEl = document.createElement('div')
    this.timerEl.className = 'ui-panel'
    this.timerEl.style.fontSize = 'calc(20px * var(--ui-scale))'
    this.timerEl.style.fontWeight = 'bold'
    this.timerEl.innerHTML = `TIME REMAINING: <span class="tabular-nums" style="color: var(--color-primary-hud)">01:30</span>`
    topCenter.appendChild(this.timerEl)

    this.dangerBannerEl = document.createElement('div')
    this.dangerBannerEl.className = 'danger-warning-banner'
    this.dangerBannerEl.innerHTML = `${ICONS.warning} DANGER CLOSE &mdash; ALLIES IN SPLASH (<span class="tabular-nums" id="danger-dist">0</span>M)`
    this.dangerDistEl = this.dangerBannerEl.querySelector('#danger-dist')!
    topCenter.appendChild(this.dangerBannerEl)

    this.container.appendChild(topCenter)

    // 3. Top-Right Squad Status & Combo
    const topRight = document.createElement('div')
    topRight.className = 'hud-top-right'

    const squadBox = document.createElement('div')
    squadBox.className = 'ui-panel'
    squadBox.style.display = 'flex'
    squadBox.style.flexDirection = 'column'
    squadBox.style.gap = 'var(--space-1)'
    squadBox.innerHTML = `<div style="font-size: 11px; color: var(--color-text-dim); letter-spacing: 1px;">BRAVO-6 STATUS:</div>`

    const squadRow = document.createElement('div')
    squadRow.style.display = 'flex'
    squadRow.style.gap = 'var(--space-2)'
    for (let i = 1; i <= 4; i++) {
      const soldierEl = document.createElement('div')
      soldierEl.style.padding = '2px 6px'
      soldierEl.style.border = '1px solid var(--color-primary-hud)'
      soldierEl.style.fontSize = '11px'
      soldierEl.style.borderRadius = 'var(--radius-sm)'
      soldierEl.textContent = `B-${i}`
      this.squadHealthEls.push(soldierEl)
      squadRow.appendChild(soldierEl)
    }
    squadBox.appendChild(squadRow)
    topRight.appendChild(squadBox)

    this.comboEl = document.createElement('div')
    this.comboEl.className = 'ui-panel'
    this.comboEl.style.color = 'var(--color-accent-gold)'
    this.comboEl.style.borderColor = 'var(--color-gold-border)'
    this.comboEl.style.fontSize = 'calc(16px * var(--ui-scale))'
    this.comboEl.style.fontWeight = 'bold'
    this.comboEl.style.display = 'none'
    this.comboEl.textContent = 'COMBO x1'
    topRight.appendChild(this.comboEl)

    this.container.appendChild(topRight)

    // 4. Center Crosshair
    const centerCrosshair = document.createElement('div')
    centerCrosshair.className = 'crosshair-container'
    centerCrosshair.innerHTML = `
      <svg class="crosshair-svg" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" stroke-dasharray="4,4"/>
        <line x1="60" y1="2" x2="60" y2="35"/>
        <line x1="60" y1="85" x2="60" y2="118"/>
        <line x1="2" y1="60" x2="35" y2="60"/>
        <line x1="85" y1="60" x2="118" y2="60"/>
        <circle cx="60" cy="60" r="4" fill="currentColor"/>
        <!-- Ballistic lead mil marks -->
        <line x1="55" y1="45" x2="65" y2="45" stroke-width="1"/>
        <line x1="55" y1="75" x2="65" y2="75" stroke-width="1"/>
        <line x1="45" y1="55" x2="45" y2="65" stroke-width="1"/>
        <line x1="75" y1="55" x2="75" y2="65" stroke-width="1"/>
      </svg>
    `
    this.container.appendChild(centerCrosshair)

    // 5. Bottom-Left Radio Transcript Box
    this.radioContainer = document.createElement('div')
    this.radioContainer.className = 'hud-bottom-left'
    this.radioContainer.innerHTML = `
      <div class="radio-box">
        <div style="display: flex; align-items: center; margin-bottom: var(--space-1);">
          <span style="color: var(--color-accent-gold); margin-right: var(--space-1);">${ICONS.radio}</span>
          <span class="radio-speaker" id="radio-spk">HQ</span>
          <span style="font-size: 10px; color: var(--color-text-dim);">// SECURE NET</span>
        </div>
        <div id="radio-msg">Angel 2-0, scanning sector for hostiles.</div>
      </div>
    `
    this.radioSpeakerEl = this.radioContainer.querySelector('#radio-spk')!
    this.radioTextEl = this.radioContainer.querySelector('#radio-msg')!
    this.container.appendChild(this.radioContainer)

    // 6. Bottom-Right Weapons Caliber Panel
    const bottomRight = document.createElement('div')
    bottomRight.className = 'hud-bottom-right'

    const caliberData: Array<{ type: string; key: string; name: string }> = [
      { type: '25mm', key: '1', name: 'GAU-12' },
      { type: '40mm', key: '2', name: 'BOFORS' },
      { type: '105mm', key: '3', name: 'M102' }
    ]

    for (const c of caliberData) {
      const card = document.createElement('div')
      card.className = 'ui-panel'
      card.style.minWidth = 'calc(80px * var(--ui-scale))'
      card.style.display = 'flex'
      card.style.flexDirection = 'column'
      card.style.alignItems = 'center'
      card.style.position = 'relative'
      card.style.overflow = 'hidden'

      card.innerHTML = `
        <div style="font-size: 10px; color: var(--color-text-dim);">[KEY ${c.key}]</div>
        <div style="font-family: var(--font-display); font-size: 16px; font-weight: bold;">${c.type.toUpperCase()}</div>
        <div style="font-size: 10px; color: var(--color-text-dim);">${c.name}</div>
        <div class="caliber-fill" style="position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: var(--color-primary-hud);"></div>
      `
      const fillEl = card.querySelector('.caliber-fill') as HTMLElement
      this.caliberCards.set(c.type, { el: card, fillEl, textEl: card })
      bottomRight.appendChild(card)
    }

    // Heat meter for GAU-12
    const heatBox = document.createElement('div')
    heatBox.className = 'ui-panel'
    heatBox.style.minWidth = 'calc(70px * var(--ui-scale))'
    heatBox.innerHTML = `
      <div style="font-size: 10px; color: var(--color-text-dim);">HEAT</div>
      <div style="font-size: 14px; font-weight: bold;"><span class="tabular-nums" id="gatling-heat">20</span>&deg;C</div>
    `
    this.heatGaugeEl = heatBox.querySelector('#gatling-heat')!
    bottomRight.appendChild(heatBox)

    this.container.appendChild(bottomRight)

    parent.appendChild(this.container)

    this.setupEvents()
  }

  private setupEvents(): void {
    events.on('CALIBER_CHANGED', (caliber: string) => {
      this.highlightSelectedCaliber(caliber)
    })

    events.on('INPUT_SELECT_CALIBER', (caliber: string) => {
      ballistics.setCaliber(caliber as any)
      this.highlightSelectedCaliber(caliber)
    })

    events.on('WEAPON_OVERHEATED', (isOverheated: boolean) => {
      if (isOverheated) {
        this.heatGaugeEl.style.color = 'var(--color-danger-alert)'
      } else {
        this.heatGaugeEl.style.color = 'var(--color-primary-hud)'
      }
    })

    events.on('SQUAD_REVIVED', () => {
      for (const el of this.squadHealthEls) {
        el.style.borderColor = 'var(--color-primary-hud)'
        el.style.color = 'var(--color-primary-hud)'
        el.style.opacity = '1.0'
      }
    })

    events.on('CREDITS_DOUBLED', () => {})

    events.on('RADIO_TRANSCRIPT_UPDATED', (msg: RadioMessage | null) => {
      if (msg) {
        this.radioSpeakerEl.textContent = msg.speaker
        this.radioTextEl.textContent = msg.text
      }
    })

    events.on('ZOOM_CHANGED', (zoom: number) => {
      const zoomEl = this.container.querySelector('#hud-zoom')
      if (zoomEl) zoomEl.textContent = zoom.toFixed(1)
    })
  }

  private highlightSelectedCaliber(caliber: string): void {
    this.caliberCards.forEach((card, type) => {
      if (type === caliber) {
        card.el.style.borderColor = 'var(--color-primary-hud)'
        card.el.style.boxShadow = '0 0 12px var(--color-primary-hud)'
      } else {
        card.el.style.borderColor = 'var(--color-hud-border)'
        card.el.style.boxShadow = 'none'
      }
    })
  }

  public update(stats: MissionStats, time: number): void {
    // 1. Timer update
    const rem = Math.max(0, Math.ceil(stats.timeLimit - stats.elapsedTime))
    const mins = Math.floor(rem / 60)
    const secs = rem % 60
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    const timeSpan = this.timerEl.querySelector('.tabular-nums')
    if (timeSpan && timeSpan.textContent !== formatted) {
      timeSpan.textContent = formatted
    }

    // 2. Danger Close warning
    if (stats.dangerCloseWarning) {
      this.dangerBannerEl.classList.add('visible')
      this.dangerDistEl.textContent = stats.dangerDistance.toString()
    } else {
      this.dangerBannerEl.classList.remove('visible')
    }

    // 3. Squad health boxes
    const squadAlive = stats.survivors
    for (let i = 0; i < this.squadHealthEls.length; i++) {
      const el = this.squadHealthEls[i]
      if (i < squadAlive) {
        el.style.borderColor = 'var(--color-primary-hud)'
        el.style.color = 'var(--color-primary-hud)'
        el.style.opacity = '1.0'
      } else {
        el.style.borderColor = 'var(--color-danger-alert)'
        el.style.color = 'var(--color-danger-alert)'
        el.style.opacity = '0.4'
      }
    }

    // 4. Combo Badge
    if (stats.combo >= 2) {
      this.comboEl.style.display = 'block'
      this.comboEl.textContent = `COMBO x${stats.combo}`
    } else {
      this.comboEl.style.display = 'none'
    }

    // 5. Heat Gauge & Cooldowns
    const heat = Math.round(ballistics.getGatlingHeat())
    this.heatGaugeEl.textContent = heat.toString()
    if (ballistics.isOverheated()) {
      this.heatGaugeEl.style.color = 'var(--color-danger-alert)'
    } else {
      this.heatGaugeEl.style.color = 'var(--color-primary-hud)'
    }

    // 6. Altitude & Azimuth telemetry
    const alt = Math.round(1000 + Math.sin(time * 0.5) * 5)
    if (this.altEl.textContent !== alt.toString()) {
      this.altEl.textContent = alt.toString()
    }

    const azim = Math.round(((time * 15) % 360))
    if (this.azimEl.textContent !== azim.toString()) {
      this.azimEl.textContent = azim.toString()
    }
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none'
  }
}
