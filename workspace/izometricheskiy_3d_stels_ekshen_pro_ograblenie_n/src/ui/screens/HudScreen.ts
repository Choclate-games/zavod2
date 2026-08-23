import { applyTranslations, formatTime, t } from '../lang.js'
import { BAL, PLAYER_MAX_HITS, TRACK_TIME_LIMIT } from '../../config/balance.js'

export interface HudSnapshot {
  alarm: number
  timeLeft: number
  hits: number
  confetti: number
  disguised: boolean
  totemCarried: boolean
  paused: boolean
  beatScale: number
}

/** HUD забега: числа пишутся в закэшированные узлы и только при изменении. */
export class HudScreen {
  readonly root = document.createElement('div')
  private readonly alarmFill = document.createElement('div')
  private readonly timeValue = document.createElement('div')
  private readonly heartsBox = document.createElement('div')
  private readonly statusLine = document.createElement('div')
  private readonly confettiLine = document.createElement('div')
  private readonly beatDot = document.createElement('div')
  private readonly hintMove = document.createElement('span')
  private readonly hintCombat = document.createElement('span')

  private lastAlarm = -1
  private lastTimeText = ''
  private lastHits = -1
  private lastConfetti = -1
  private lastDisguised: boolean | null = null
  private lastTotem: boolean | null = null

  constructor(onPauseToggle: () => void) {
    this.root.className = 'screen hud'
    this.root.dataset.screen = 'hud'

    const top = document.createElement('div')
    top.className = 'hud-top'

    // Тревога.
    const alarmCol = document.createElement('div')
    alarmCol.className = 'hud-col'
    const alarmLabel = document.createElement('div')
    alarmLabel.className = 'hud-label'
    alarmLabel.setAttribute('data-lang', 'hud.alarm')
    const bar = document.createElement('div')
    bar.className = 'alarm-bar'
    this.alarmFill.className = 'alarm-fill'
    bar.appendChild(this.alarmFill)
    alarmCol.appendChild(alarmLabel)
    alarmCol.appendChild(bar)

    // Таймер трека шествия — слот фиксированной ширины, tabular-nums.
    const timeCol = document.createElement('div')
    timeCol.className = 'hud-col'
    const timeLabel = document.createElement('div')
    timeLabel.className = 'hud-label'
    timeLabel.setAttribute('data-lang', 'hud.time')
    this.timeValue.className = 'hud-value'
    this.timeValue.textContent = '--:--'
    timeCol.appendChild(timeLabel)
    timeCol.appendChild(this.timeValue)

    // Сердца и статус маскировки.
    const statusCol = document.createElement('div')
    statusCol.className = 'hud-col'
    this.heartsBox.className = 'hud-hearts'
    for (let i = 0; i < PLAYER_MAX_HITS; i++) {
      this.heartsBox.insertAdjacentHTML(
        'beforeend',
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
      )
    }
    this.statusLine.className = 'hud-status'
    statusCol.appendChild(this.heartsBox)
    statusCol.appendChild(this.statusLine)
    statusCol.appendChild(this.confettiLine)

    // Пауза и индикатор такта.
    const rightCol = document.createElement('div')
    rightCol.className = 'hud-col hud-pause-slot'
    this.beatDot.className = 'beat-dot'
    const pauseBtn = document.createElement('button')
    pauseBtn.type = 'button'
    pauseBtn.className = 'btn btn-icon'
    pauseBtn.dataset.action = 'pause'
    pauseBtn.setAttribute('aria-label', t('hud.pause'))
    pauseBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 5v14"/><path d="M15 5v14"/></svg>'
    pauseBtn.addEventListener('click', onPauseToggle)
    rightCol.appendChild(this.beatDot)
    rightCol.appendChild(pauseBtn)

    top.appendChild(alarmCol)
    top.appendChild(timeCol)
    top.appendChild(statusCol)
    top.appendChild(rightCol)

    const bottom = document.createElement('div')
    bottom.className = 'hud-bottom'
    bottom.appendChild(this.hintMove)
    bottom.appendChild(this.hintCombat)

    this.root.appendChild(top)
    this.root.appendChild(bottom)
    applyTranslations(this.root)
    this.setScheme('desktop')
    this.update({
      alarm: 0,
      timeLeft: TRACK_TIME_LIMIT,
      hits: 0,
      confetti: BAL.confettiCharges,
      disguised: false,
      totemCarried: false,
      paused: false,
      beatScale: 1,
    })
  }

  update(snap: HudSnapshot): void {
    const alarmPct = Math.round(snap.alarm)
    if (alarmPct !== this.lastAlarm) {
      this.lastAlarm = alarmPct
      this.alarmFill.style.setProperty('--alarm-level', `${Math.min(100, alarmPct)}%`)
    }
    const timeText = formatTime(snap.timeLeft)
    if (timeText !== this.lastTimeText) {
      this.lastTimeText = timeText
      this.timeValue.textContent = timeText
    }
    if (snap.hits !== this.lastHits) {
      this.lastHits = snap.hits
      const hearts = this.heartsBox.children
      for (let i = 0; i < hearts.length; i++) {
        hearts[i].classList.toggle('is-lost', i < snap.hits)
      }
    }
    if (snap.confetti !== this.lastConfetti) {
      this.lastConfetti = snap.confetti
      const charges = Math.max(0, snap.confetti)
      this.confettiLine.textContent = `${t('hud.confetti')}: ${charges > 0 ? 'x' + charges : '—'}`
    }
    if (snap.disguised !== this.lastDisguised) {
      this.lastDisguised = snap.disguised
      this.statusLine.textContent = snap.disguised ? t('hud.disguised') : t('hud.exposed')
      this.statusLine.classList.toggle('is-good', snap.disguised)
      this.statusLine.classList.toggle('is-bad', !snap.disguised)
    }
    if (snap.totemCarried !== this.lastTotem) {
      this.setTotemHint(snap.totemCarried)
    }
    this.beatDot.style.setProperty('--beat-scale', String(1 + snap.beatScale * 0.6))
  }

  setTotemHint(carried: boolean): void {
    if (carried === this.lastTotem && this.hintMove.textContent !== '') return
    this.lastTotem = carried
    this.hintMove.textContent = carried ? t('hud.objective.escape') : t('hud.totem.hint')
    this.hintCombat.textContent = ''
  }

  setPausedOverlay(paused: boolean): void {
    this.root.classList.toggle('is-paused', paused)
  }

  setScheme(scheme: 'desktop' | 'touch'): void {
    this.hintMove.textContent = scheme === 'touch' ? t('hint.touch.move') : t('hint.desktop.move')
    this.hintCombat.textContent = scheme === 'touch' ? '' : t('hint.desktop.combat')
  }
}
