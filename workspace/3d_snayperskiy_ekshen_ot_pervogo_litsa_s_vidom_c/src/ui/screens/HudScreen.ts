import { bus } from '../../core/eventBus.js'
import { t } from '../../core/i18n.js'
import { el, withIcon } from '../components/dom.js'

interface HudState {
  state: string
  timeLeft: number
  ammo: number
  breathPct: number
  windX10: number
  windDeg: number
  titanDistance: number
  massPct: number
  zoomLabel: string
  rangefinder: boolean
  droneScan: boolean
  dropMilX10: number
  driftMilX10: number
  holdActive: boolean
  deployPct: number
  strafe01: number
  echoAvailable: boolean
}

/** Телеметрия контракта. Пишет только в закэшированные узлы и только при
 * изменении значения; числа — tabular-nums, полосы — scaleX. */
export class HudScreen {
  readonly root: HTMLElement

  private timeValue = el('span', 'value hud-num')
  private ammoValue = el('span', 'value hud-num')
  private windValue = el('span', 'value hud-num')
  private windArrow = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  private distanceValue = el('span', 'value hud-num')
  private breathFill = el('div', 'fill')
  private deployFill = el('div', 'fill')
  private zoomValue = el('span', 'value hud-num')
  private massChip = el('div', 'hud-chip stress')
  private massValue = el('span', 'value hud-num')
  private correction = el('div', 'correction-line')
  private scopeRing = el('div', 'scope-ring')

  // кэш последних значений: запись в DOM только по факту изменения
  private cache = { timeLeft: -1, ammo: -1, windX10: -1, windDeg: -999, distance: -1, breathPct: -1, deployPct: -1, zoom: '', massPct: -2, correction: '', rangefinder: null as boolean | null }

  constructor() {
    this.root = el('div', 'hud-root')

    // верхний левый угол: пауза и оптика
    const tl = el('div', 'hud-anchor anchor-tl')
    const pauseBtn = withIcon('icon-btn', 'pause', t('hud.pause'))
    pauseBtn.addEventListener('click', () => bus.emit('input:pause'))
    tl.appendChild(pauseBtn)
    const zoomChip = this.chip(t('hud.zoom'), this.zoomValue)
    tl.appendChild(zoomChip)
    this.root.appendChild(tl)

    // верх центр: анемометр
    const tc = el('div', 'hud-anchor anchor-tc')
    tc.appendChild(this.buildWindDial())
    const windChip = this.chip(t('hud.wind'), this.windValue)
    windChip.classList.add('accent')
    tc.appendChild(windChip)
    this.massChip.appendChild(this.labeled(t('hud.mass'), this.massValue))
    tc.appendChild(this.massChip)
    this.root.appendChild(tc)

    // верх прав: дистанция титана до заставы
    const tr = el('div', 'hud-anchor anchor-tr')
    const distChip = this.chip(t('hud.distance'), this.distanceValue)
    distChip.classList.add('danger')
    tr.appendChild(distChip)
    this.root.appendChild(tr)

    // низ лев: дыхание и позиция на карнизе
    const bl = el('div', 'hud-anchor anchor-bl')
    bl.appendChild(this.buildGauge(this.breathFill))
    bl.appendChild(this.buildGauge(this.deployFill))
    this.root.appendChild(bl)

    // низ прав: патроны
    const br = el('div', 'hud-anchor anchor-br')
    const ammoChip = this.chip(t('hud.ammo'), this.ammoValue)
    br.appendChild(ammoChip)
    const timeChip = this.chip(t('hud.time'), this.timeValue)
    br.appendChild(timeChip)
    this.root.appendChild(br)

    // оптическая сетка
    this.scopeRing.innerHTML =
      '<svg viewBox="0 0 100 100">' +
      '<circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-width="0.35" opacity="0.85"/>' +
      '<circle cx="50" cy="50" r="31" fill="none" stroke="currentColor" stroke-width="0.2" opacity="0.5"/>' +
      '<path d="M50 3v26M50 71v26M3 50h26M71 50h26" stroke="currentColor" stroke-width="0.3"/>' +
      '<path d="M50 44v12M44 50h12" stroke="currentColor" stroke-width="0.45"/>' +
      this.milDots() +
      '</svg>'
    this.root.appendChild(this.scopeRing)
    this.correction.style.display = 'none'
    this.root.appendChild(this.correction)

    bus.on('hud:state', (payload) => this.applyState(payload as unknown as HudState))
  }

  private labeled(label: string, value: HTMLElement): HTMLElement {
    const wrap = el('span')
    const k = el('span', 'label', label)
    k.style.display = 'none'
    wrap.appendChild(k)
    wrap.appendChild(value)
    return wrap
  }

  private chip(labelText: string, valueNode: HTMLElement): HTMLElement {
    const chip = el('div', 'hud-chip')
    chip.appendChild(el('span', 'label', labelText))
    chip.appendChild(valueNode)
    return chip
  }

  private buildGauge(fill: HTMLElement): HTMLElement {
    const gauge = el('div', 'meter')
    gauge.appendChild(fill)
    return gauge
  }

  private buildWindDial(): HTMLElement {
    const dial = el('div', 'wind-dial')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 74 74')
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    ring.setAttribute('cx', '37')
    ring.setAttribute('cy', '37')
    ring.setAttribute('r', '33')
    ring.setAttribute('fill', 'none')
    ring.setAttribute('stroke', 'currentColor')
    ring.setAttribute('stroke-width', '1.4')
    ring.setAttribute('opacity', '0.5')
    this.windArrow.setAttribute('class', 'wind-arrow')
    this.windArrow.innerHTML = '<path d="M37 12l8 16H29z" fill="currentColor"/><rect x="35.6" y="28" width="2.8" height="24" rx="1.2" fill="currentColor"/>'
    svg.appendChild(ring)
    svg.appendChild(this.windArrow)
    dial.appendChild(svg)
    return dial
  }

  private milDots(): string {
    let dots = ''
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue
      dots += `<circle cx="${50 + i * 7}" cy="50" r="0.55" fill="currentColor"/>`
      dots += `<circle cx="50" cy="${50 + i * 7}" r="0.55" fill="currentColor"/>`
    }
    return dots
  }

  private setText(node: HTMLElement, value: string): void {
    if (node.textContent !== value) node.textContent = value
  }

  private applyState(s: HudState): void {
    const timeStr = String(s.timeLeft)
    if (this.cache.timeLeft !== s.timeLeft) {
      this.cache.timeLeft = s.timeLeft
      this.setText(this.timeValue, timeStr)
      this.timeValue.parentElement?.classList.toggle('danger', s.timeLeft <= 10)
    }
    if (this.cache.ammo !== s.ammo) {
      this.cache.ammo = s.ammo
      this.setText(this.ammoValue, String(s.ammo))
    }
    const windStr = (s.windX10 / 10).toFixed(1)
    if (this.cache.windX10 !== s.windX10) {
      this.cache.windX10 = s.windX10
      this.setText(this.windValue, windStr)
    }
    if (this.cache.windDeg !== s.windDeg) {
      this.cache.windDeg = s.windDeg
      this.windArrow.setAttribute('transform', `rotate(${s.windDeg} 37 37)`)
    }
    if (this.cache.distance !== s.titanDistance) {
      this.cache.distance = s.titanDistance
      this.setText(this.distanceValue, `${s.titanDistance} m`)
    }
    if (this.cache.breathPct !== s.breathPct) {
      this.cache.breathPct = s.breathPct
      this.breathFill.style.transform = `scaleX(${(s.breathPct / 100).toFixed(3)})`
    }
    if (this.cache.deployPct !== s.deployPct) {
      this.cache.deployPct = s.deployPct
      this.deployFill.style.transform = `scaleX(${(s.deployPct / 100).toFixed(3)})`
    }
    if (this.cache.zoom !== s.zoomLabel) {
      this.cache.zoom = s.zoomLabel
      this.setText(this.zoomValue, s.zoomLabel)
    }
    if (this.cache.massPct !== s.massPct) {
      this.cache.massPct = s.massPct
      this.massChip.style.display = s.massPct >= 0 ? '' : 'none'
      if (s.massPct >= 0) this.setText(this.massValue, `${s.massPct}%`)
    }
    let correctionText = ''
    if (s.droneScan || s.rangefinder) {
      const side = s.driftMilX10 < 0 ? '<' : '>'
      correctionText = `DROP ${(s.dropMilX10 / 10).toFixed(1)} MIL · WIND ${side} ${(Math.abs(s.driftMilX10) / 10).toFixed(1)} MIL · ${s.zoomLabel}`
    }
    if (this.cache.correction !== correctionText) {
      this.cache.correction = correctionText
      this.correction.textContent = correctionText
      this.correction.style.display = correctionText ? '' : 'none'
    }
    if (this.cache.rangefinder !== s.rangefinder) {
      this.cache.rangefinder = s.rangefinder
      this.scopeRing.classList.toggle('hidden', false)
    }
  }
}
