import { t } from '../data/i18n'
import { icon } from './icons'
import type { EventBus } from '../core/EventBus'

export interface HudSnapshot {
  speedKmh: number
  rollDeg: number
  sloshShift: number
  volumeRatio: number
  multiplier: number
  timeS: number
  checkpoint: number
  driftTotal: number
  turboCharge: number
}

/**
 * GameplayHUD: пять якорей, закэшированные узлы, запись только при изменении
 * значения. Меняющиеся числа — tabular-nums в слоте фиксированной ширины,
 * полосы — transform: scaleX. Слой HUD никогда не кликается.
 */
export class Hud {
  readonly root: HTMLElement
  private readonly speedValue: HTMLDivElement
  private readonly rollValue: HTMLDivElement
  private readonly sloshBar: HTMLDivElement
  private readonly volumeValue: HTMLDivElement
  private readonly volumeFill: HTMLDivElement
  private readonly multValue: HTMLDivElement
  private readonly driftValue: HTMLDivElement
  private readonly timeValue: HTMLDivElement
  private readonly checkpointValue: HTMLDivElement
  private readonly minimapCtx: CanvasRenderingContext2D | null
  private minimapTimer = 0

  // последние записанные значения: не трогаем DOM без изменения
  private lastSpeed = -1
  private lastRollInt = -999
  private lastVolumePct = -1
  private lastMult = -1
  private lastTimeTenth = -1
  private lastCheckpoint = -1
  private lastDrift = -1

  constructor(
    private readonly trackCenterX: () => Float32Array | null,
    private readonly trackCenterZ: () => Float32Array | null,
    private readonly carPos: () => { x: number; z: number },
    onPauseClick: () => void,
    bus: EventBus,
  ) {
    this.root = document.createElement('div')
    this.root.className = 'ui-layer safe-inset'

    // ── слева сверху: пауза и мини-карта ────────────────────────────────
    const tl = document.createElement('div')
    tl.className = 'hud-anchor hud-tl'
    const pauseBtn = document.createElement('button')
    pauseBtn.className = 'btn btn-icon hud-clickable'
    pauseBtn.innerHTML = '<span>' + icon('pause') + '</span>'
    pauseBtn.addEventListener('click', onPauseClick)
    const minimap = document.createElement('canvas')
    minimap.className = 'minimap'
    tl.append(pauseBtn, minimap)
    this.minimapCtx = minimap.getContext('2d')

    // ── сверху по центру: таймер и чекпоинт ─────────────────────────────
    const tc = document.createElement('div')
    tc.className = 'hud-anchor hud-tc'
    const timeChip = document.createElement('div')
    timeChip.className = 'hud-chip'
    this.timeValue = document.createElement('div')
    this.timeValue.className = 'hud-value cyan'
    this.checkpointValue = document.createElement('div')
    this.checkpointValue.className = 'hud-label'
    this.checkpointValue.textContent = t('hud.checkpoint', { n: 0 })
    timeChip.append(this.timeValue, this.checkpointValue)
    tc.appendChild(timeChip)

    // ── справа сверху: объём молока и множитель ──────────────────────────
    const tr = document.createElement('div')
    tr.className = 'hud-anchor hud-tr'
    const volumeChip = document.createElement('div')
    volumeChip.className = 'hud-chip'
    const volumeLabel = document.createElement('div')
    volumeLabel.className = 'hud-label'
    volumeLabel.textContent = t('hud.volume')
    this.volumeValue = document.createElement('div')
    this.volumeValue.className = 'hud-value okay'
    const meterWrap = document.createElement('div')
    meterWrap.appendChild(meterWrap.ownerDocument.createTextNode(''))
    this.volumeFill = document.createElement('div')
    this.volumeFill.className = 'meter-fill'
    const meter = document.createElement('div')
    meter.className = 'meter'
    meter.appendChild(this.volumeFill)
    volumeChip.append(volumeLabel, this.volumeValue, meter)
    const multChip = document.createElement('div')
    multChip.className = 'hud-chip'
    const multLabel = document.createElement('div')
    multLabel.className = 'hud-label'
    multLabel.textContent = t('hud.multiplier') + ' · ' + t('hud.drift')
    this.multValue = document.createElement('div')
    this.multValue.className = 'hud-value gold'
    this.driftValue = document.createElement('div')
    this.driftValue.className = 'hud-label'
    multChip.append(multLabel, this.multValue, this.driftValue)
    tr.append(volumeChip, multChip)

    // ── слева снизу: спидометр и датчик крена цистерны ───────────────────
    const bl = document.createElement('div')
    bl.className = 'hud-anchor hud-bl'
    const speedo = document.createElement('div')
    speedo.className = 'speedo'
    this.speedValue = document.createElement('div')
    this.speedValue.className = 'speedo-value'
    const unit = document.createElement('div')
    unit.className = 'speedo-unit'
    unit.textContent = 'км/ч'
    speedo.append(this.speedValue, unit)
    const tiltChip = document.createElement('div')
    tiltChip.className = 'hud-chip'
    const tiltLabel = document.createElement('div')
    tiltLabel.className = 'hud-label'
    tiltLabel.textContent = t('results.title')
    this.rollValue = document.createElement('div')
    this.rollValue.className = 'hud-value'
    this.sloshBar = document.createElement('div')
    this.sloshBar.className = 'slosh-bar'
    const marker = document.createElement('div')
    marker.className = 'slosh-marker'
    this.sloshBar.appendChild(marker)
    tiltChip.append(tiltLabel, this.rollValue, this.sloshBar)
    bl.append(speedo, tiltChip)

    // ── справа снизу: якорь кнопки ручника (тач-слой рисует кнопку сам) ──
    const br = document.createElement('div')
    br.className = 'hud-anchor hud-br'

    this.root.append(tl, tc, tr, bl, br)

    bus.on('race:checkpoint', ({ index }) => {
      this.lastCheckpoint = -1
      this.checkpointValue.textContent = t('hud.checkpoint', { n: index })
      this.lastCheckpoint = index
    })
  }

  /** Пишет телеметрию в закэшированные узды только при изменении значения. */
  update(snap: HudSnapshot, dt: number): void {
    const speedInt = Math.round(snap.speedKmh)
    if (speedInt !== this.lastSpeed) {
      this.speedValue.textContent = String(speedInt)
      this.lastSpeed = speedInt
    }
    const rollInt = Math.round(snap.rollDeg)
    if (rollInt !== this.lastRollInt) {
      this.rollValue.textContent = `${rollInt}°`
      this.rollValue.className =
        'hud-value ' + (snap.rollDeg > 24 ? 'crit' : snap.rollDeg > 14 ? 'warn' : '')
      this.lastRollInt = rollInt
    }
    this.sloshBar.style.setProperty('--slosh-shift', snap.sloshShift.toFixed(2))
    this.sloshBar.classList.toggle('crit', snap.rollDeg > 26)

    const volumePct = Math.round(snap.volumeRatio * 100)
    if (volumePct !== this.lastVolumePct) {
      this.volumeValue.textContent = `${volumePct}%`
      this.volumeValue.className =
        'hud-value ' + (volumePct < 75 ? 'crit' : volumePct < 90 ? 'warn' : 'okay')
      this.lastVolumePct = volumePct
    }
    this.volumeFill.style.transform = `scaleX(${Math.max(0, Math.min(1, snap.volumeRatio)).toFixed(3)})`

    const mult = Math.round(snap.multiplier * 10)
    if (mult !== this.lastMult) {
      this.multValue.textContent = `x${(mult / 10).toFixed(1)}`
      this.multValue.className =
        'hud-value ' + (mult >= 35 ? 'crit' : mult >= 20 ? 'gold' : 'gold')
      this.lastMult = mult
    }
    const driftInt = Math.round(snap.driftTotal)
    if (driftInt !== this.lastDrift) {
      this.driftValue.textContent = `${driftInt}`
      this.lastDrift = driftInt
    }

    const tenth = Math.floor(snap.timeS * 10)
    if (tenth !== this.lastTimeTenth) {
      this.timeValue.textContent = formatTime(snap.timeS)
      this.lastTimeTenth = tenth
    }

    this.minimapTimer += dt
    if (this.minimapTimer > 0.15) {
      this.minimapTimer = 0
      this.drawMinimap()
    }
  }

  resetTimer(): void {
    this.lastTimeTenth = -1
    this.lastCheckpoint = -1
    this.checkpointValue.textContent = t('hud.checkpoint', { n: 0 })
  }

  private drawMinimap(): void {
    const ctx = this.minimapCtx
    const cxArr = this.trackCenterX()
    const czArr = this.trackCenterZ()
    if (!ctx || !cxArr || !czArr || cxArr.length === 0) return
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (let i = 0; i < cxArr.length; i++) {
      minX = Math.min(minX, cxArr[i]); maxX = Math.max(maxX, cxArr[i])
      minZ = Math.min(minZ, czArr[i]); maxZ = Math.max(maxZ, czArr[i])
    }
    const pad = 8
    const scaleX = (ctx.canvas.width - pad * 2) / Math.max(1, maxX - minX)
    const scaleY = (ctx.canvas.height - pad * 2) / Math.max(1, maxZ - minZ)
    const scale = Math.min(scaleX, scaleY)
    ctx.strokeStyle = 'rgba(234, 244, 251, 0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < cxArr.length; i++) {
      const px = pad + (cxArr[i] - minX) * scale
      const py = pad + (czArr[i] - minZ) * scale
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
    const pos = this.carPos()
    ctx.fillStyle = '#00E5FF'
    ctx.beginPath()
    ctx.arc(pad + (pos.x - minX) * scale, pad + (pos.z - minZ) * scale, 3.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}
