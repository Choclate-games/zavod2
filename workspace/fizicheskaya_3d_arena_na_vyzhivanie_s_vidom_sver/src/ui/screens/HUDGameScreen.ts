import type { Hud } from '../Hud'
import type { Screen } from '../ScreenRouter'

/**
 * Игровой HUD как экран: сам по себе прозрачен для ввода, кликабельны
 * только листья внутри Hud (кнопка паузы).
 */
export class HUDGameScreen implements Screen {
  readonly name = 'match_hud'
  readonly root: HTMLElement

  constructor(private readonly hud: Hud) {
    this.root = document.createElement('div')
    this.root.appendChild(hud.root)
  }

  onShow(): void {
    this.hud.clear()
  }
}
