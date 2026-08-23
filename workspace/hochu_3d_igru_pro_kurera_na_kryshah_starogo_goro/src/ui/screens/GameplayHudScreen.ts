import { events } from '../../core/EventBus'
import type { ActionFeedbackType, DistanceState, FlowState, ParcelState, TimerState } from '../../core/types'
import { createButton, type ButtonHandle } from '../components/Button'
import { createProgressBar } from '../components/ProgressBar'
import { createIcon } from '../icons'

export class GameplayHudScreen {
  public root: HTMLElement
  private integrityText: HTMLElement
  private integrityFill: HTMLElement
  private timerText: HTMLElement
  private flowText: HTMLElement
  private distanceText: HTMLElement
  private distanceProgressBar: ReturnType<typeof createProgressBar>
  private actionFeedbackEl: HTMLElement
  private pauseBtn: ButtonHandle
  private feedbackTimeout: number | null = null

  constructor(onPauseClick: () => void) {
    this.root = document.createElement('div')
    this.root.id = 'screen-gameplay-hud'
    this.root.className = 'screen screen--hidden'
    this.root.style.pointerEvents = 'none'

    // --- Top Bar (Integrity, Timer, Flow, Pause) ---
    const topBar = document.createElement('div')
    topBar.style.width = '100%'
    topBar.style.display = 'flex'
    topBar.style.alignItems = 'flex-start'
    topBar.style.justifyContent = 'space-between'
    topBar.style.pointerEvents = 'none'

    // Top-Left: Integrity Flask Widget
    const integrityWidget = document.createElement('div')
    integrityWidget.className = 'panel'
    integrityWidget.style.display = 'flex'
    integrityWidget.style.flexDirection = 'column'
    integrityWidget.style.gap = '4px'
    integrityWidget.style.padding = '8px 12px'
    integrityWidget.style.minWidth = '110px'

    const flaskHeader = document.createElement('div')
    flaskHeader.style.display = 'flex'
    flaskHeader.style.alignItems = 'center'
    flaskHeader.style.gap = '6px'
    flaskHeader.appendChild(createIcon('flask'))

    this.integrityText = document.createElement('span')
    this.integrityText.className = 'num'
    this.integrityText.style.color = 'var(--color-safe)'
    this.integrityText.style.fontWeight = '700'
    this.integrityText.style.fontSize = '16px'
    this.integrityText.textContent = '100%'
    flaskHeader.appendChild(this.integrityText)
    integrityWidget.appendChild(flaskHeader)

    // Micro integrity bar
    const barBg = document.createElement('div')
    barBg.style.width = '100%'
    barBg.style.height = '6px'
    barBg.style.background = 'var(--color-bg)'
    barBg.style.borderRadius = '3px'
    barBg.style.overflow = 'hidden'

    this.integrityFill = document.createElement('div')
    this.integrityFill.style.width = '100%'
    this.integrityFill.style.height = '100%'
    this.integrityFill.style.background = 'var(--color-safe)'
    this.integrityFill.style.transformOrigin = 'left center'
    this.integrityFill.style.transform = 'scaleX(1)'
    this.integrityFill.style.transition = 'transform 100ms linear, background-color 200ms ease'
    barBg.appendChild(this.integrityFill)
    integrityWidget.appendChild(barBg)

    topBar.appendChild(integrityWidget)

    // Top-Center: Brass Countdown Chronometer
    const timerWidget = document.createElement('div')
    timerWidget.className = 'panel'
    timerWidget.style.display = 'flex'
    timerWidget.style.alignItems = 'center'
    timerWidget.style.gap = '6px'
    timerWidget.style.padding = '8px 16px'

    timerWidget.appendChild(createIcon('clock'))
    this.timerText = document.createElement('span')
    this.timerText.className = 'num timer-val'
    this.timerText.style.color = 'var(--color-primary)'
    this.timerText.style.fontSize = '18px'
    this.timerText.textContent = '60.0'
    timerWidget.appendChild(this.timerText)
    topBar.appendChild(timerWidget)

    // Top-Right: Flow Multiplier & Pause Button
    const rightControls = document.createElement('div')
    rightControls.style.display = 'flex'
    rightControls.style.alignItems = 'center'
    rightControls.style.gap = '8px'

    const flowWidget = document.createElement('div')
    flowWidget.className = 'panel'
    flowWidget.style.display = 'flex'
    flowWidget.style.alignItems = 'center'
    flowWidget.style.gap = '4px'
    flowWidget.style.padding = '8px 12px'

    flowWidget.appendChild(createIcon('lightning'))
    this.flowText = document.createElement('span')
    this.flowText.className = 'num flow-val'
    this.flowText.style.color = 'var(--color-primary)'
    this.flowText.style.fontSize = '16px'
    this.flowText.textContent = 'x1.0'
    flowWidget.appendChild(this.flowText)
    rightControls.appendChild(flowWidget)

    this.pauseBtn = createButton({
      text: '',
      icon: 'pause',
      variant: 'secondary',
      onClick: () => {
        onPauseClick()
      },
    })
    this.pauseBtn.element.style.minWidth = '48px'
    this.pauseBtn.element.style.minHeight = '48px'
    this.pauseBtn.element.style.padding = '8px'
    rightControls.appendChild(this.pauseBtn.element)

    topBar.appendChild(rightControls)
    this.root.appendChild(topBar)

    // --- Center Zone: Dynamic Action Feedback Popup ---
    this.actionFeedbackEl = document.createElement('div')
    this.actionFeedbackEl.className = 'action-feedback'
    this.actionFeedbackEl.style.fontFamily = 'var(--font-display)'
    this.actionFeedbackEl.style.fontSize = 'clamp(20px, calc(26px * var(--ui-scale)), 32px)'
    this.actionFeedbackEl.style.fontWeight = '700'
    this.actionFeedbackEl.style.letterSpacing = '2px'
    this.actionFeedbackEl.style.textShadow = '0 4px 16px rgba(0,0,0,0.8)'
    this.actionFeedbackEl.style.opacity = '0'
    this.actionFeedbackEl.style.transform = 'scale(0.8)'
    this.actionFeedbackEl.style.transition = 'opacity 150ms ease-out, transform 150ms ease-out'
    this.actionFeedbackEl.style.pointerEvents = 'none'
    this.root.appendChild(this.actionFeedbackEl)

    // --- Bottom Zone: Distance Progress Bar ---
    const bottomBar = document.createElement('div')
    bottomBar.style.width = '100%'
    bottomBar.style.maxWidth = '420px'
    bottomBar.style.display = 'flex'
    bottomBar.style.flexDirection = 'column'
    bottomBar.style.gap = '4px'
    bottomBar.style.pointerEvents = 'none'
    bottomBar.style.marginBottom = 'calc(var(--space-2) * var(--ui-scale))'

    const distHeader = document.createElement('div')
    distHeader.style.display = 'flex'
    distHeader.style.justifyContent = 'space-between'
    distHeader.style.color = 'var(--color-text-secondary)'
    distHeader.style.fontSize = '12px'
    distHeader.style.letterSpacing = '1px'

    const distLabel = document.createElement('span')
    distLabel.textContent = 'ДО ЦЕЛЕВОГО БАЛКОНА'
    distHeader.appendChild(distLabel)

    this.distanceText = document.createElement('span')
    this.distanceText.className = 'num'
    this.distanceText.textContent = '0 / 400 м'
    distHeader.appendChild(this.distanceText)
    bottomBar.appendChild(distHeader)

    this.distanceProgressBar = createProgressBar('distance-hud-bar')
    bottomBar.appendChild(this.distanceProgressBar.element)

    this.root.appendChild(bottomBar)

    this.bindEvents()
  }

  private bindEvents(): void {
    events.on('PARCEL_INTEGRITY_UPDATED', (data: ParcelState) => {
      this.integrityText.textContent = `${data.percent}%`
      const scale = Math.max(0, Math.min(100, data.percent)) / 100
      this.integrityFill.style.transform = `scaleX(${scale})`

      if (data.percent < 35) {
        this.integrityFill.style.background = 'var(--color-danger)'
        this.integrityText.style.color = 'var(--color-danger)'
      } else if (data.percent < 70) {
        this.integrityFill.style.background = 'var(--color-warning)'
        this.integrityText.style.color = 'var(--color-warning)'
      } else {
        this.integrityFill.style.background = 'var(--color-safe)'
        this.integrityText.style.color = 'var(--color-safe)'
      }
    })

    events.on('TIMER_UPDATED', (data: TimerState) => {
      this.timerText.textContent = data.timeRemaining.toFixed(1)
    })

    events.on('FLOW_COMBO_UPDATED', (data: FlowState) => {
      this.flowText.textContent = `x${data.multiplier.toFixed(1)}`
    })

    events.on('DISTANCE_UPDATED', (data: DistanceState) => {
      this.distanceText.textContent = `${Math.round(data.current)} / ${Math.round(data.target)} м`
      this.distanceProgressBar.setProgress(data.percent)
    })

    events.on('ACTION_FEEDBACK', (action: ActionFeedbackType) => {
      this.showActionFeedback(action)
    })
  }

  private showActionFeedback(action: ActionFeedbackType): void {
    if (this.feedbackTimeout !== null) {
      clearTimeout(this.feedbackTimeout)
    }

    let text = ''
    let color = 'var(--color-primary)'

    switch (action) {
      case 'PERFECT_ROLL':
        text = 'ИДЕАЛЬНЫЙ ПЕРЕКАТ! +4.5 м/с'
        color = 'var(--color-safe)'
        break
      case 'LEDGE_GRAB':
        text = 'ЗАЦЕП ЗА КАРНИЗ! +6.2 м/с'
        color = 'var(--color-climb)'
        break
      case 'SLIDE':
        text = 'ПОДКАТ ПОД ТРУБОЙ!'
        color = 'var(--color-primary)'
        break
      case 'WIND_RECOVERY':
        text = 'БАЛАНС НА ВЕТРУ!'
        color = 'var(--color-safe)'
        break
      case 'CRASH':
        text = 'УДАР! -25% ПРОЧНОСТИ'
        color = 'var(--color-danger)'
        break
      default:
        break
    }

    this.actionFeedbackEl.textContent = text
    this.actionFeedbackEl.style.color = color
    this.actionFeedbackEl.style.opacity = '1'
    this.actionFeedbackEl.style.transform = 'scale(1.1)'

    this.feedbackTimeout = window.setTimeout(() => {
      this.actionFeedbackEl.style.opacity = '0'
      this.actionFeedbackEl.style.transform = 'scale(0.8)'
    }, 800)
  }

  public show(): void {
    this.root.classList.remove('screen--hidden')
  }

  public hide(): void {
    this.root.classList.add('screen--hidden')
  }
}
