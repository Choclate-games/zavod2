import { button, el } from '../components.js'
import type { DICTS } from '../i18n.js'

type Dict = (typeof DICTS)['ru']

export interface ResultView {
  setStats(score: number, timeSec: number, chains: number, overheats: number): void
}

/** VictoryScreen: рассвет 06:00, статистика ночи и удвоение очков за rewarded. */
export class VictoryScreen implements ResultView {
  readonly root: HTMLElement
  private readonly stats: HTMLElement

  constructor(
    private readonly dict: Dict,
    opts: { rewardedSupported: boolean },
    onAction: (action: string) => void,
  ) {
    this.root = el('div', 'menu-layout')
    const header = el('div')
    header.appendChild(el('h2', 'screen-title', dict.victoryTitle))
    this.root.appendChild(header)

    this.stats = el('div', 'panel stat-grid')
    this.root.appendChild(this.stats)

    const actions = el('div', 'menu-actions')
    if (opts.rewardedSupported) {
      const doubleBtn = button({ label: dict.double, primary: true })
      doubleBtn.addEventListener('click', () => onAction('double'))
      actions.appendChild(doubleBtn)
    }
    const menuBtn = button({ label: dict.menu })
    menuBtn.addEventListener('click', () => onAction('menu-from-result'))
    actions.appendChild(menuBtn)
    this.root.appendChild(actions)
  }

  setStats(score: number, timeSec: number, chains: number, overheats: number): void {
    this.stats.innerHTML = ''
    this.addStat(this.stats, this.dict.statScore, String(score))
    this.addStat(this.stats, this.dict.statTime, `${timeSec} ${this.dict.seconds}`)
    this.addStat(this.stats, this.dict.statChains, String(chains))
    this.addStat(this.stats, this.dict.statOverheat, String(overheats))
  }

  private addStat(grid: HTMLElement, label: string, value: string): void {
    grid.appendChild(el('div', 'hint-line', label))
    grid.appendChild(el('div', 'stat-value', value))
  }
}

/** DefeatScreen: разрушение маяка, время выживания и спасение вахты. */
export class DefeatScreen implements ResultView {
  readonly root: HTMLElement
  private readonly stats: HTMLElement
  private reviveBtn: HTMLButtonElement | null = null

  constructor(
    private readonly dict: Dict,
    opts: { rewardedSupported: boolean },
    onAction: (action: string) => void,
  ) {
    this.root = el('div', 'menu-layout')
    const header = el('div')
    header.appendChild(el('h2', 'screen-title', dict.defeatTitle))
    this.root.appendChild(header)

    this.stats = el('div', 'panel stat-grid')
    this.root.appendChild(this.stats)

    const actions = el('div', 'menu-actions')
    if (opts.rewardedSupported) {
      // Возможность есть — кнопка рисуется; повторный показ уберёт её.
      this.reviveBtn = button({ label: dict.revive, primary: true })
      this.reviveBtn.addEventListener('click', () => onAction('revive'))
      actions.appendChild(this.reviveBtn)
    }
    const restartBtn = button({ label: dict.restart })
    restartBtn.addEventListener('click', () => onAction('restart-from-result'))
    actions.appendChild(restartBtn)
    const menuBtn = button({ label: dict.menu })
    menuBtn.addEventListener('click', () => onAction('menu-from-result'))
    actions.appendChild(menuBtn)
    this.root.appendChild(actions)
  }

  setReviveAvailable(available: boolean): void {
    if (this.reviveBtn) this.reviveBtn.style.display = available ? '' : 'none'
  }

  setStats(score: number, timeSec: number, _chains: number, _overheats: number): void {
    this.stats.innerHTML = ''
    this.addStat(this.stats, this.dict.statScore, String(score))
    this.addStat(this.stats, this.dict.statTime, `${timeSec} ${this.dict.seconds}`)
  }

  private addStat(grid: HTMLElement, label: string, value: string): void {
    grid.appendChild(el('div', 'hint-line', label))
    grid.appendChild(el('div', 'stat-value', value))
  }
}

