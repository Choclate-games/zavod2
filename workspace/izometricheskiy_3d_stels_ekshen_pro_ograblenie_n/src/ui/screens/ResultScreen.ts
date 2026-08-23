import { applyTranslations, formatTime, t } from '../lang.js'

export interface ResultData {
  won: boolean
  reason: string
  gold: number
  time: number
}

/** Экран итогов: победа или причина провала, награда, второй шанс. */
export class ResultScreen {
  readonly root = document.createElement('div')
  private readonly title = document.createElement('div')
  private readonly reason = document.createElement('div')
  private readonly goldLine = document.createElement('div')
  private readonly timeLine = document.createElement('div')
  private readonly secondChanceBtn: HTMLButtonElement

  constructor(handlers: {
    onRetry: () => void
    onMenu: () => void
    onSecondChance: () => void
    secondChanceSupported: () => boolean
  }) {
    this.root.className = 'screen'
    this.root.dataset.screen = 'result'

    const box = document.createElement('div')
    box.className = 'result-box'

    this.title.className = 'result-title'
    this.reason.className = 'result-reason'
    this.goldLine.className = 'result-line'
    this.timeLine.className = 'result-line'

    this.secondChanceBtn = document.createElement('button')
    this.secondChanceBtn.type = 'button'
    this.secondChanceBtn.className = 'btn'
    this.secondChanceBtn.setAttribute('data-lang', 'result.secondChance')
    this.secondChanceBtn.addEventListener('click', () => handlers.onSecondChance())

    const retryBtn = document.createElement('button')
    retryBtn.type = 'button'
    retryBtn.className = 'btn btn-primary'
    retryBtn.setAttribute('data-lang', 'result.retry')
    retryBtn.addEventListener('click', () => handlers.onRetry())

    const menuBtn = document.createElement('button')
    menuBtn.type = 'button'
    menuBtn.className = 'btn'
    menuBtn.setAttribute('data-lang', 'result.menu')
    menuBtn.addEventListener('click', () => handlers.onMenu())

    const row = document.createElement('div')
    row.className = 'menu-row'
    row.appendChild(this.secondChanceBtn)
    row.appendChild(retryBtn)
    row.appendChild(menuBtn)

    box.appendChild(this.title)
    box.appendChild(this.reason)
    box.appendChild(this.goldLine)
    box.appendChild(this.timeLine)
    box.appendChild(row)
    this.root.appendChild(box)
    applyTranslations(this.root)
    void handlers.secondChanceSupported
  }

  show(data: ResultData, secondChanceOffered: boolean): void {
    this.title.textContent = data.won ? t('result.win.title') : t('result.lose.title')
    this.title.classList.toggle('is-lose', !data.won)
    this.reason.textContent = data.won ? '' : t(`result.reason.${data.reason}`)
    if (data.won) this.reason.textContent = t('hud.totem')
    this.goldLine.textContent = t('result.gold', { gold: String(data.gold) })
    this.timeLine.textContent = t('result.time', { time: formatTime(data.time) })
    // Возможности, которой нет на площадке, в DOM нет вовсе.
    this.secondChanceBtn.hidden = !secondChanceOffered
  }
}
