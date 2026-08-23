import { GameplayHudScreen } from './screens/GameplayHudScreen'

export class Hud {
  public screen: GameplayHudScreen

  constructor(screen: GameplayHudScreen) {
    this.screen = screen
  }

  public show(): void {
    this.screen.show()
  }

  public hide(): void {
    this.screen.hide()
  }
}
