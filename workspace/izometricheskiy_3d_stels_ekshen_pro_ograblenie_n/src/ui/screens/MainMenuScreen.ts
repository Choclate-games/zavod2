import { applyTranslations, formatTime, t } from '../lang.js'
import { save } from '../../platform/save.js'

/** Главное меню: живая сцена шествия видна за прозрачным корнем экрана. */
export class MainMenuScreen {
  readonly root = document.createElement('div')
  private readonly stats: HTMLDivElement
  private readonly soundBtn: HTMLButtonElement

  constructor(handlers: { onStart: () => void; onWorkshop: () => void; onToggleSound: () => void }) {
    this.root.className = 'screen'
    this.root.dataset.screen = 'menu'

    const box = document.createElement('div')
    box.className = 'menu-box'

    const title = document.createElement('div')
    title.className = 'menu-title'
    title.setAttribute('data-lang', 'game.title')

    const subtitle = document.createElement('div')
    subtitle.className = 'menu-subtitle'
    subtitle.setAttribute('data-lang', 'game.subtitle')

    this.stats = document.createElement('div')
    this.stats.className = 'menu-stats'

    const row = document.createElement('div')
    row.className = 'menu-row'

    const startBtn = document.createElement('button')
    startBtn.type = 'button'
    startBtn.className = 'btn btn-primary'
    startBtn.setAttribute('data-lang', 'menu.start')
    startBtn.addEventListener('click', () => handlers.onStart())

    const workshopBtn = document.createElement('button')
    workshopBtn.type = 'button'
    workshopBtn.className = 'btn'
    workshopBtn.setAttribute('data-lang', 'menu.workshop')
    workshopBtn.addEventListener('click', () => handlers.onWorkshop())

    this.soundBtn = document.createElement('button')
    this.soundBtn.type = 'button'
    this.soundBtn.className = 'btn btn-icon'
    this.soundBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/></svg>'
    this.soundBtn.addEventListener('click', () => handlers.onToggleSound())

    row.appendChild(startBtn)
    row.appendChild(workshopBtn)
    row.appendChild(this.soundBtn)
    box.appendChild(title)
    box.appendChild(subtitle)
    box.appendChild(this.stats)
    box.appendChild(row)

    const hints = document.createElement('div')
    hints.className = 'menu-hints'
    const hintMove = document.createElement('span')
    hintMove.setAttribute('data-hint', 'move')
    const hintCombat = document.createElement('span')
    hintCombat.setAttribute('data-hint', 'combat')
    hints.appendChild(hintMove)
    hints.appendChild(hintCombat)

    this.root.appendChild(box)
    this.root.appendChild(hints)
    applyTranslations(this.root)
    this.refresh()
  }

  refresh(): void {
    const snap = save.snapshot
    const best = snap.bestTimeMs > 0 ? formatTime(snap.bestTimeMs / 1000) : '--:--'
    this.stats.textContent = `${t('menu.best', { time: best })} · ${t('menu.gold', { gold: String(snap.gold) })}`
  }

  setSound(on: boolean): void {
    if (on) {
      this.soundBtn.classList.remove('is-muted')
    } else {
      this.soundBtn.classList.add('is-muted')
    }
    const svg = this.soundBtn.querySelector('svg')
    if (svg) {
      svg.style.opacity = on ? '1' : '0.45'
    }
  }

  setHints(scheme: 'desktop' | 'touch'): void {
    const move = this.root.querySelector('[data-hint="move"]')
    const combat = this.root.querySelector('[data-hint="combat"]')
    if (move) move.textContent = scheme === 'touch' ? t('hint.touch.move') : t('hint.desktop.move')
    if (combat) combat.textContent = scheme === 'touch' ? '' : t('hint.desktop.combat')
  }
}
