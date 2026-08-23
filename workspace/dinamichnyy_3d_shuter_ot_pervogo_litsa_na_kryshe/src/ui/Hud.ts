// HUD визора: пишет в закэшированные узлы и только при изменении значения.
// Числа — tabular-nums в слотах фиксированной ширины.

import { el } from './components'
import { icon } from './icons'
import { t } from '../i18n/messages'
import { RULES } from '../config/rules'
import type { HudState } from '../core/state'

const RING_RADIUS = 44
const RING_CIRC = 2 * Math.PI * RING_RADIUS

export class Hud {
  readonly root: HTMLElement

  private readonly shieldFill: HTMLElement
  private lastShield = -1
  private readonly timerValue: HTMLElement
  private lastTimerS = -1
  private readonly speedValue: HTMLElement
  private lastSpeed = -1
  private readonly windValue: HTMLElement
  private readonly windArrow: HTMLElement
  private lastWindMs = -1
  private readonly killValue: HTMLElement
  private lastKills = -1
  private readonly scoreValue: HTMLElement
  private lastScore = -1
  private readonly teslaRingFill: SVGCircleElement
  private readonly overloadLabel: HTMLElement
  private lastTeslaReady = false
  private readonly comboBadge: HTMLElement
  private lastCombo = -1
  private readonly pips: HTMLElement[] = []
  private lastProgress = -1
  private readonly leadMarker: HTMLElement
  private readonly hitMarker: HTMLElement
  private readonly gapBadge: HTMLElement
  private readonly reticle: HTMLElement
  private hitMarkerTimerS = 0
  private missTimerS = 0
  private lastLeadX = Number.NaN
  private vibrationPhase = 0

  constructor() {
    this.root = el('div', 'hud-layer-root')

    // левый верх: щит
    const topLeft = el('div', 'hud-top-left')
    const shieldWrap = el('div')
    const shieldHead = el('div')
    shieldHead.style.display = 'flex'
    const shieldIcon = el('span', 'hud-label')
    shieldIcon.innerHTML = icon('shield')
    const shieldText = el('span', 'hud-label')
    shieldText.textContent = t('shield')
    shieldHead.append(shieldIcon, shieldText)
    const meterBox = el('div', 'meter')
    this.shieldFill = el('div', 'meter-fill')
    this.shieldFill.style.background = 'var(--c-accent)'
    meterBox.appendChild(this.shieldFill)
    shieldWrap.append(shieldHead, meterBox)
    topLeft.appendChild(shieldWrap)

    // центр верх: таймер + прогресс состава + кнопка паузы добавляется снаружи
    const topCenter = el('div', 'hud-top-center')
    const timerRow = el('div')
    timerRow.style.display = 'flex'
    const timerLabel = el('span', 'hud-label')
    timerLabel.textContent = t('timeLeft')
    this.timerValue = el('span', 'hud-value')
    timerRow.append(timerLabel, this.timerValue)
    const tracker = el('div', 'progress-tracker')
    for (let i = 0; i < RULES.wagonsTotal; i++) {
      const pip = el('div', 'wagon-pip')
      tracker.appendChild(pip)
      this.pips.push(pip)
    }
    topCenter.append(timerRow, tracker)

    // правый верх: скорость и ветер
    const topRight = el('div', 'hud-top-right')
    const speedRow = el('div')
    speedRow.style.display = 'flex'
    speedRow.style.alignItems = 'center'
    speedRow.style.gap = '6px'
    const speedIcon = el('span')
    speedIcon.innerHTML = icon('speed')
    speedIcon.className = 'hud-label'
    this.speedValue = el('span', 'hud-value')
    speedRow.append(speedIcon, this.speedValue)
    const windRow = el('div')
    windRow.style.display = 'flex'
    windRow.style.alignItems = 'center'
    windRow.style.gap = '6px'
    const windIcon = el('span')
    windIcon.innerHTML = icon('wind')
    windIcon.className = 'hud-label'
    this.windArrow = el('span', 'hud-value')
    this.windArrow.textContent = '\u2190'
    this.windValue = el('span', 'hud-value')
    windRow.append(windIcon, this.windArrow, this.windValue)
    const scoreRow = el('div')
    scoreRow.style.display = 'flex'
    const scoreLabel = el('span', 'hud-label')
    scoreLabel.textContent = t('score')
    this.scoreValue = el('span', 'hud-value')
    scoreRow.append(scoreLabel, this.scoreValue)
    const killRow = el('div')
    killRow.style.display = 'flex'
    const killIcon = el('span')
    killIcon.innerHTML = icon('skull')
    killIcon.className = 'hud-label'
    this.killValue = el('span', 'hud-value')
    killRow.append(killIcon, this.killValue)
    topRight.append(speedRow, windRow, scoreRow, killRow)

    // центр: прицел, маркер упреждения, хитмаркер
    this.reticle = el('div', 'reticle')
    this.reticle.innerHTML = icon('crosshair')
    this.leadMarker = el('div', 'lead-marker')
    this.hitMarker = el('div', 'hit-marker')
    this.hitMarker.textContent = '+'
    this.hitMarker.style.textAlign = 'center'
    this.hitMarker.style.lineHeight = '34px'

    // бейдж разрыва
    this.gapBadge = el('div', 'gap-badge hidden')
    this.gapBadge.textContent = 'JUMP'

    // комбо справа снизу над теслой
    this.comboBadge = el('div', 'combo-badge')

    // кольцо конденсатора теслы
    const teslaRing = el('div', 'tesla-ring')
    const svgNs = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNs, 'svg')
    svg.setAttribute('viewBox', '0 0 100 100')
    const backCircle = document.createElementNS(svgNs, 'circle')
    backCircle.setAttribute('cx', '50')
    backCircle.setAttribute('cy', '50')
    backCircle.setAttribute('r', String(RING_RADIUS))
    backCircle.setAttribute('fill', 'none')
    backCircle.setAttribute('stroke', 'var(--c-surface)')
    backCircle.setAttribute('stroke-width', '6')
    this.teslaRingFill = document.createElementNS(svgNs, 'circle')
    this.teslaRingFill.setAttribute('cx', '50')
    this.teslaRingFill.setAttribute('cy', '50')
    this.teslaRingFill.setAttribute('r', String(RING_RADIUS))
    this.teslaRingFill.setAttribute('fill', 'none')
    this.teslaRingFill.setAttribute('stroke', 'var(--c-progress)')
    this.teslaRingFill.setAttribute('stroke-width', '6')
    this.teslaRingFill.setAttribute('stroke-linecap', 'round')
    this.teslaRingFill.setAttribute('transform', 'rotate(-90 50 50)')
    this.teslaRingFill.style.strokeDasharray = String(RING_CIRC)
    this.teslaRingFill.style.strokeDashoffset = String(RING_CIRC)
    this.overloadLabel = el('div')
    this.overloadLabel.style.cssText =
      'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;'
    svg.appendChild(backCircle)
    svg.appendChild(this.teslaRingFill)
    teslaRing.appendChild(svg)
    teslaRing.appendChild(this.overloadLabel)

    this.root.append(
      topLeft,
      topCenter,
      topRight,
      this.reticle,
      this.leadMarker,
      this.hitMarker,
      this.gapBadge,
      this.comboBadge,
      teslaRing,
    )
  }

  update(state: HudState, dtS: number): void {
    if (state.shieldPct !== this.lastShield) {
      this.lastShield = state.shieldPct
      this.shieldFill.style.transform = `scaleX(${(state.shieldPct / RULES.shieldMax).toFixed(3)})`
      this.shieldFill.style.background = state.shieldPct < 35 ? 'var(--c-danger)' : 'var(--c-accent)'
    }
    const timerInt = Math.ceil(state.timeLeftS)
    if (timerInt !== this.lastTimerS) {
      this.lastTimerS = timerInt
      this.timerValue.textContent = `${timerInt}`
      this.timerValue.style.color = timerInt <= 10 ? 'var(--c-danger)' : ''
    }
    if (state.speedKmh !== this.lastSpeed) {
      this.lastSpeed = state.speedKmh
      this.speedValue.textContent = `${Math.round(state.speedKmh)}`
    }
    if (state.windMs !== this.lastWindMs) {
      this.lastWindMs = state.windMs
      this.windValue.textContent = `${Math.round(state.windMs)}`
      const arrowLeft = Math.cos(state.windDirRad) >= 0
      this.windArrow.textContent = arrowLeft ? '\u2190' : '\u2192'
    }
    if (state.kills !== this.lastKills) {
      this.lastKills = state.kills
      this.killValue.textContent = `${state.kills}/${RULES.killsToWin}`
    }
    if (state.score !== this.lastScore) {
      this.lastScore = state.score
      this.scoreValue.textContent = `${Math.round(state.score)}`
    }
    const pipsDone = Math.round(state.progress01 * RULES.wagonsTotal)
    if (pipsDone !== this.lastProgress) {
      this.lastProgress = pipsDone
      for (let i = 0; i < this.pips.length; i++) {
        this.pips[i].classList.toggle('done', i < pipsDone)
      }
    }
    const ready = state.teslaCharge >= state.teslaCapacity
    if (ready !== this.lastTeslaReady) {
      this.lastTeslaReady = ready
      this.overloadLabel.textContent = ready ? t('teslaReady') : ''
      this.overloadLabel.style.color = ready ? 'var(--c-accent)' : ''
    }
    const ratio = state.teslaCapacity > 0 ? state.teslaCharge / state.teslaCapacity : 0
    this.teslaRingFill.style.strokeDashoffset = String(RING_CIRC * (1 - ratio))
    if (state.comboMultiplier !== this.lastCombo) {
      this.lastCombo = state.comboMultiplier
      this.comboBadge.textContent = state.comboMultiplier > 1 ? `x${state.comboMultiplier}` : ''
    }

    // маркер упреждения: сдвиг от центра на вычисленный офсет
    if (!Object.is(state.leadOffsetXpx, this.lastLeadX)) {
      this.lastLeadX = state.leadOffsetXpx
      this.leadMarker.style.transform = `translate(${state.leadOffsetXpx.toFixed(1)}px, 0)`
      this.leadMarker.classList.toggle('miss', !state.precisionHit && !state.leadVisible)
      this.leadMarker.style.opacity = state.leadVisible ? '0.95' : '0'
    }

    if (this.hitMarkerTimerS > 0) {
      this.hitMarkerTimerS -= dtS
      if (this.hitMarkerTimerS <= 0) this.hitMarker.classList.remove('visible')
    }
    if (this.missTimerS > 0) {
      this.missTimerS -= dtS
      if (this.missTimerS <= 0) this.leadMarker.classList.remove('miss')
    }

    const gapVisible = state.gapMarkerDistanceM < 14
    this.gapBadge.classList.toggle('hidden', !gapVisible)
    if (gapVisible) {
      this.gapBadge.textContent = `JUMP ${Math.max(0, Math.round(state.gapMarkerDistanceM))}m`
    }

    // вибрация прицела от поезда: амплитуда из balance.yaml
    this.vibrationPhase += dtS * Math.PI * 2 * RULES.vibrationHz
    const vibY = Math.sin(this.vibrationPhase) * RULES.vibrationAmpPx * 0.12
    this.reticle.style.transform = `translate(-50%, calc(-50% + ${vibY.toFixed(2)}px))`
  }

  flashHit(): void {
    this.hitMarker.classList.add('visible')
    this.hitMarkerTimerS = 0.12
  }

  flashMiss(): void {
    this.leadMarker.classList.add('miss')
    this.missTimerS = 0.4
  }
}
