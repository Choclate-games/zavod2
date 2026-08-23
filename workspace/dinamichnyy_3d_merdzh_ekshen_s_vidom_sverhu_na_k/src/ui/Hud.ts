import type { GameEvents } from '../core/EventBus'
import { GameplayHudScreen } from './screens/GameplayHudScreen'

export class Hud {
  constructor(private readonly screen: GameplayHudScreen) {}

  update(state: GameEvents['game:hud']): void { this.screen.update(state) }
}
