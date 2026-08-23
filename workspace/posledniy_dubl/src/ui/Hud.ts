import { BALANCE } from '../config/balance.js'
import type { EventBus } from '../core/EventBus.js'
import { t } from '../i18n/strings.js'
import { ICONS } from './icons.js'

/**
 * HUD: пять якорей — цель (верх), прицел (центр), статус (лево),
 * таймер/прогресс (право), магазин (низ право). Пишет в закэшированные
 * узлы и только при изменении значения.
 */
export class Hud {
  readonly root = document.createElement('div')

  private readonly objectiveNode: HTMLDivElement
  private readonly timerNode: HTMLSpanElement
  private readonly progressFill: HTMLDivElement
  private readonly markPips: HTMLSpanElement[] = []
  private readonly chargePips: HTMLSpanElement[] = []
  private readonly ammoCurrent: HTMLSpanElement
  private readonly ammoCapacity: HTMLSpanElement
  private readonly crosshairSpread: SVGGElement
  private readonly zoomIndicator: HTMLDivElement
  private readonly hitmarker: HTMLDivElement
  private readonly vignette: HTMLDivElement
  private readonly pauseButton: HTMLButtonElement

  private lastObjectiveKey = ''
  private lastAmmo = -1
  private lastCapacity = -1
  private lastMarks = -1
  private lastCharges = -1
  private lastTimer = -1
  private hitmarkerTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    events: EventBus,
    onPauseRequest: () => void,
    showPauseButton: boolean,
  ) {
    this.root.id = 'hud-layer'

    const objective = document.createElement('div')
    objective.id = 'hud-objective'
    objective.className = 'hud-anchor'
    this.objectiveNode = objective

    // Прогресс маршрута + таймер.
    const progressWrap = document.createElement('div')
    progressWrap.id = 'hud-progress'
    progressWrap.className = 'hud-anchor'
    const track = document.createElement('div')
    track.className = 'progress-track'
    this.progressFill = document.createElement('div')
    this.progressFill.className = 'progress-fill'
    track.appendChild(this.progressFill)
    const timerLine = document.createElement('span')
    this.timerNode = document.createElement('span')
    this.timerNode.className = 'stat-value'
    this.timerNode.textContent = String(BALANCE.session.timeLimitS)
    const unitNode = document.createElement('span')
    unitNode.textContent = ` ${t('seconds_short')}`
    timerLine.append(this.timerNode, unitNode)
    progressWrap.append(timerLine, track)

    // Отметки опасности и заряды.
    const status = document.createElement('div')
    status.id = 'hud-status'
    status.className = 'hud-anchor'
    const marksRow = document.createElement('div')
    marksRow.className = 'status-row'
    const marksLabel = document.createElement('span')
    marksLabel.textContent = t('hud_marks')
    const marksPips = document.createElement('span')
    marksPips.className = 'pip-track'
    for (let i = 0; i < BALANCE.session.maxPlayerHits; i++) {
      const pip = document.createElement('span')
      pip.className = 'pip'
      this.markPips.push(pip)
      marksPips.appendChild(pip)
    }
    marksRow.append(marksLabel, marksPips)
    const chargesRow = document.createElement('div')
    chargesRow.className = 'status-row'
    const chargesLabel = document.createElement('span')
    chargesLabel.textContent = t('hud_charges')
    const chargesPips = document.createElement('span')
    chargesPips.className = 'pip-track'
    for (let i = 0; i < BALANCE.session.maxCharges; i++) {
      const pip = document.createElement('span')
      pip.className = 'pip'
      this.chargePips.push(pip)
      chargesPips.appendChild(pip)
    }
    chargesRow.append(chargesLabel, chargesPips)
    status.append(marksRow, chargesRow)

    // Прицел с четырьмя сегментами.
    const crosshair = document.createElement('div')
    crosshair.id = 'hud-crosshair'
    crosshair.className = 'hud-anchor'
    crosshair.innerHTML =
      '<svg id="crosshair-svg" viewBox="0 0 44 44" aria-hidden="true">' +
      `<g class="crosshair-spread" stroke="currentColor" stroke-width="2" fill="none">` +
      '<path d="M22 4v9M22 31v9M4 22h9M31 22h9"/></g>' +
      '<circle cx="22" cy="22" r="1.8" fill="currentColor"/></svg>'
    this.crosshairSpread = crosshair.querySelector('.crosshair-spread') as SVGGElement

    const zoomIndicator = document.createElement('div')
    zoomIndicator.id = 'hud-zoom-indicator'
    zoomIndicator.className = 'hud-anchor'
    zoomIndicator.textContent = 'FOV 32'
    this.zoomIndicator = zoomIndicator

    const hitmarker = document.createElement('div')
    hitmarker.id = 'hitmarker'
    hitmarker.textContent = ICONS.crosshair
    this.hitmarker = hitmarker

    // Магазин рядом с кнопкой огня (на таче) в нижнем правом углу.
    const ammo = document.createElement('div')
    ammo.id = 'hud-ammo'
    ammo.className = 'hud-anchor'
    this.ammoCurrent = document.createElement('span')
    this.ammoCurrent.id = 'ammo-current'
    this.ammoCurrent.textContent = '06'
    this.ammoCapacity = document.createElement('span')
    this.ammoCapacity.id = 'ammo-capacity'
    this.ammoCapacity.textContent = '/06'
    ammo.append(this.ammoCurrent, this.ammoCapacity)

    const vignette = document.createElement('div')
    vignette.id = 'damage-vignette'
    this.vignette = vignette

    const pauseButton = document.createElement('button')
    pauseButton.id = 'hud-pause'
    pauseButton.type = 'button'
    pauseButton.setAttribute('aria-label', t('pause_title'))
    pauseButton.innerHTML = ICONS.pause
    pauseButton.addEventListener('click', () => onPauseRequest())
    this.pauseButton = pauseButton
    if (showPauseButton) {
      this.pauseButton.style.display = 'flex'
    }

    this.root.append(
      vignette, objective, progressWrap, status, crosshair, zoomIndicator,
      hitmarker, ammo, pauseButton,
    )

    events.on('objective:changed', ({ textKey }) => {
      if (textKey === this.lastObjectiveKey) return
      this.lastObjectiveKey = textKey
      const key = textKey as Parameters<typeof t>[0]
      this.objectiveNode.textContent = t(key)
    })
    events.on('timer:tick', ({ secondsLeft }) => {
      if (secondsLeft === this.lastTimer) return
      this.lastTimer = secondsLeft
      this.timerNode.textContent = String(secondsLeft)
    })
    events.on('ammo:changed', ({ current, capacity }) => {
      if (current !== this.lastAmmo) {
        this.ammoCurrent.classList.toggle('empty', current === 0)
        this.lastAmmo = current
        this.ammoCurrent.textContent = String(current).padStart(2, '0')
      }
      if (capacity !== this.lastCapacity) {
        this.lastCapacity = capacity
        this.ammoCapacity.textContent = `/${String(capacity).padStart(2, '0')}`
      }
      this.flashRefill(current, capacity)
    })
    events.on('marks:changed', ({ hits }) => {
      if (hits === this.lastMarks) return
      this.lastMarks = hits
      this.markPips.forEach((pip, i) => pip.classList.toggle('on-danger', i < hits))
      this.flashVignette()
    })
    events.on('charges:changed', ({ charges }) => {
      if (charges === this.lastCharges) return
      this.lastCharges = charges
      this.chargePips.forEach((pip, i) => pip.classList.toggle('on-accent', i < charges))
    })
    events.on('route:progress', ({ pointsDone, pointsTotal }) => {
      this.progressFill.style.transform = `scaleX(${pointsDone / pointsTotal})`
    })
    events.on('hitmarker:shown', ({ headshot }) => this.showHitmarker(headshot))
    events.on('zoom:changed', ({ active }) => {
      this.zoomIndicator.classList.toggle('visible', active)
      this.crosshairSpread.style.transform = active ? 'scale(1.7)' : 'scale(1)'
    })
  }

  /** Хедшот вернул магазин: короткая белая вспышка счётчика. */
  private flashRefill(current: number, capacity: number): void {
    if (current !== capacity || current <= 1) return
    this.ammoCurrent.classList.add('refilled')
    setTimeout(() => this.ammoCurrent.classList.remove('refilled'), 350)
  }

  private flashVignette(): void {
    this.vignette.classList.remove('flash')
    void this.vignette.offsetWidth
    this.vignette.classList.add('flash')
    setTimeout(() => this.vignette.classList.remove('flash'), 80)
  }

  private showHitmarker(headshot: boolean): void {
    this.hitmarker.classList.toggle('headshot', headshot)
    this.hitmarker.classList.remove('fade')
    this.hitmarker.classList.add('flash')
    if (this.hitmarkerTimer) clearTimeout(this.hitmarkerTimer)
    this.hitmarkerTimer = setTimeout(() => {
      this.hitmarker.classList.remove('flash')
      this.hitmarker.classList.add('fade')
    }, 90)
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'block' : 'none'
  }
}
