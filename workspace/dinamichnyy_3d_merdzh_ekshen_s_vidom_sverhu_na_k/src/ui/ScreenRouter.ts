import type { GameEvents, EventBus } from '../core/EventBus'
import { GameOverScreen } from './screens/GameOverScreen'
import { GameplayHudScreen } from './screens/GameplayHudScreen'
import { MainMenuScreen } from './screens/MainMenuScreen'
import { VictoryPodiumScreen } from './screens/VictoryPodiumScreen'
import { WaveClearScreen } from './screens/WaveClearScreen'

export type ScreenActions = {
  onStart: () => void
  onRestart: () => void
  onMenu: () => void
  onNextWave: () => void
  onPause: () => void
  onToggleSound: () => void
  onReward: () => void
  onLeaderboard: () => void
  rewardedSupported: boolean
  leaderboardSupported: boolean
}

export class ScreenRouter {
  readonly root: HTMLDivElement
  readonly menu: MainMenuScreen
  readonly gameplay: GameplayHudScreen
  readonly clear: WaveClearScreen
  readonly over: GameOverScreen
  readonly victory: VictoryPodiumScreen
  private readonly screens: Array<{ root: HTMLElement }> = []

  constructor(parent: HTMLElement, bus: EventBus, actions: ScreenActions) {
    this.root = document.createElement('div')
    this.root.id = 'screens'
    this.menu = new MainMenuScreen(actions)
    this.gameplay = new GameplayHudScreen(bus, actions)
    this.clear = new WaveClearScreen(actions)
    this.over = new GameOverScreen(actions)
    this.victory = new VictoryPodiumScreen(actions)
    this.screens.push(this.menu, this.gameplay, this.clear, this.over, this.victory)
    for (const screen of this.screens) this.root.appendChild(screen.root)
    parent.appendChild(this.root)
  }

  show(state: GameEvents['game:state']['state']): void {
    for (const screen of this.screens) screen.root.hidden = screen.root.dataset.screen !== state
  }

  setBest(score: number): void { this.menu.setBest(score) }
  setClear(ringouts: number, score: number): void { this.clear.setStats(ringouts, score) }
  setOver(score: number, ringouts: number): void { this.over.setStats(score, ringouts) }
  setVictory(score: number, ringouts: number, tier: number): void { this.victory.setResult(score, ringouts, tier) }
}
