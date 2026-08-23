import type { EventBus, GameState } from '../core/EventBus.js'
import type { InputRouter } from '../input/InputRouter.js'
import { el } from './components.js'
import { Hud } from './Hud.js'
import { DICTS, type Locale } from './i18n.js'
import { ScreenRouter } from './ScreenRouter.js'
import { DefeatScreen, VictoryScreen } from './screens/ResultScreens.js'
import { MainMenu } from './screens/MainMenu.js'
import { PauseModal } from './screens/PauseModal.js'

type Dict = (typeof DICTS)['ru']

export interface UiOptions {
  leaderboardSupported: boolean
  rewardedSupported: boolean
  soundMuted: boolean
}

/**
 * Корень интерфейса: слои над канвасом. Контейнеры прозрачны для ввода,
 * auto включают только листовые интерактивные элементы.
 */
export class UiRoot {
  readonly screens: ScreenRouter

  readonly hud: Hud
  readonly mainMenu: MainMenu
  private readonly pauseModal: PauseModal
  private readonly victory: VictoryScreen
  private readonly defeat: DefeatScreen
  private readonly dict: Dict

  constructor(
    host: HTMLElement,
    private readonly events: EventBus,
    private readonly input: InputRouter,
    locale: Locale,
    opts: UiOptions,
    onAction: (action: string) => void,
  ) {
    this.dict = DICTS[locale]

    this.hud = new Hud(this.events, this.dict, !opts.soundMuted, onAction)
    // Тач-слой создаётся только в тач-схеме и монтируется роутером ввода.
    host.appendChild(this.hud.root)

    const screensHost = el('div', 'layer')
    screensHost.id = 'screens'
    host.appendChild(screensHost)

    this.mainMenu = new MainMenu(this.dict, { leaderboard: opts.leaderboardSupported, soundMuted: opts.soundMuted }, onAction)
    this.pauseModal = new PauseModal(this.dict, onAction)
    this.victory = new VictoryScreen(this.dict, { rewardedSupported: opts.rewardedSupported }, onAction)
    this.defeat = new DefeatScreen(this.dict, { rewardedSupported: opts.rewardedSupported }, onAction)

    this.screens = new ScreenRouter(screensHost)
    this.screens.register(this.mainMenu.root)
    this.screens.register(this.pauseModal.root)
    this.screens.register(this.victory.root)
    this.screens.register(this.defeat.root)

    this.events.on('state:changed', ({ state }) => this.route(state))
    this.events.on('run:end', ({ summary }) => {
      if (summary.victory) this.victory.setStats(summary.score, summary.survivedSec, summary.chainKills, summary.overheatCount)
      else {
        this.defeat.setStats(summary.score, summary.survivedSec, summary.chainKills, summary.overheatCount)
        this.defeat.setReviveAvailable(opts.rewardedSupported && !summary.reviveUsed)
      }
      void summary
    })
    this.events.on('hud:steam', ({ charged }) => {
      const steamBtn = document.querySelector('[data-touch-btn="steam"]')
      steamBtn?.classList.toggle('is-charged', charged)
    })
    this.events.on('audio:mute', ({ muted }) => {
      this.hud.setMuted(muted)
    })
  }

  /** Ровно один экран виден; тач-слой живёт только в игровом процессе. */
  route(state: GameState): void {
    switch (STATE_ROUTES[state]) {
      case 'menu':
        this.hud.root.style.display = 'none'
        this.input.setControlsVisible(false)
        this.screens.show(this.mainMenu.root)
        break
      case 'playing':
        this.hud.root.style.display = ''
        this.hud.reset()
        this.screens.hideAll()
        this.input.setControlsVisible(true)
        break
      case 'paused':
        this.hud.root.style.display = ''
        this.input.setControlsVisible(false)
        this.screens.show(this.pauseModal.root)
        break
      case 'result':
        this.hud.root.style.display = ''
        this.input.setControlsVisible(false)
        break
    }
  }

  showVictory(): void {
    this.screens.show(this.victory.root)
  }

  showVictoryRefresh(summary: { score: number; survivedSec: number; chainKills: number; overheatCount: number }): void {
    this.victory.setStats(summary.score, summary.survivedSec, summary.chainKills, summary.overheatCount)
    this.screens.show(this.victory.root)
  }

  showDefeatRefresh(summary: { score: number; survivedSec: number; chainKills: number; overheatCount: number; reviveUsed: boolean }): void {
    this.defeat.setStats(summary.score, summary.survivedSec, summary.chainKills, summary.overheatCount)
    this.defeat.setReviveAvailable(!summary.reviveUsed)
    this.screens.show(this.defeat.root)
  }

  setMenuBest(timeSec: number, score: number): void {
    this.mainMenu.setBestLine(timeSec, score, this.dict)
  }
}

const STATE_ROUTES: Record<GameState, 'menu' | 'playing' | 'paused' | 'result'> = {
  LOADING: 'menu',
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  VICTORY: 'result',
  DEFEAT: 'result',
}
