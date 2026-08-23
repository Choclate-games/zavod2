import './theme.css'
import { EventBus } from '../core/EventBus'
import type { InputMode } from '../input/InputRouter'
import { PlaygamaService } from '../platform/PlaygamaService'
import { ScreenRouter } from './ScreenRouter'
import { TouchControls } from './TouchControls'

export type UiActions = {
  onStart: () => void
  onRestart: () => void
  onMenu: () => void
  onNextWave: () => void
  onPause: () => void
  onToggleSound: () => void
  onReward: () => void
  onLeaderboard: () => void
}

export class UiRoot {
  readonly router: ScreenRouter
  private readonly touch: TouchControls | null

  constructor(private readonly mount: HTMLElement, private readonly bus: EventBus, platform: PlaygamaService, actions: UiActions, mode: InputMode, bestScore: number) {
    this.mount.replaceChildren()
    this.router = new ScreenRouter(this.mount, bus, { ...actions, rewardedSupported: platform.rewardedSupported, leaderboardSupported: platform.leaderboardSupported })
    this.touch = mode === 'touch' ? new TouchControls(bus, this.mount) : null
    bus.on('game:state', ({ state }) => { this.router.show(state); this.touch?.show(state === 'gameplay_hud') })
    bus.on('game:hud', (state) => this.router.gameplay.update(state))
    this.router.setBest(bestScore)
    this.measureViewport()
    window.visualViewport?.addEventListener('resize', this.measureViewport)
    window.visualViewport?.addEventListener('scroll', this.measureViewport)
  }

  private readonly measureViewport = (): void => {
    const viewport = window.visualViewport
    const height = viewport?.height ?? window.innerHeight
    document.documentElement.style.setProperty('--vp-h', `${height}px`)
    document.documentElement.style.setProperty('--ui-scale', height < 460 ? '0.82' : '1')
  }
}
