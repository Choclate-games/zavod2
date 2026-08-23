import { events } from '../core/EventBus'
import { ScreenMainMenu } from './screens/ScreenMainMenu'
import { ScreenArmory } from './screens/ScreenArmory'
import { ScreenBattleHUD } from './screens/ScreenBattleHUD'
import { ScreenVictory } from './screens/ScreenVictory'
import { ScreenDefeat } from './screens/ScreenDefeat'
import { game } from '../game/GameManager'
import { GameState } from '../types'

export class ScreenRouter {
  private static instance: ScreenRouter
  private screens: Map<string, any> = new Map()
  private currentScreenName = 'ScreenMainMenu'

  public static getInstance(container?: HTMLElement): ScreenRouter {
    if (!ScreenRouter.instance) {
      if (!container) throw new Error('ScreenRouter requires container on initial call')
      ScreenRouter.instance = new ScreenRouter(container)
    }
    return ScreenRouter.instance
  }

  private constructor(container: HTMLElement) {
    this.screens.set('ScreenMainMenu', new ScreenMainMenu(container))
    this.screens.set('ScreenArmory', new ScreenArmory(container))
    this.screens.set('ScreenBattleHUD', new ScreenBattleHUD(container))
    this.screens.set('ScreenVictory', new ScreenVictory(container))
    this.screens.set('ScreenDefeat', new ScreenDefeat(container))

    this.setupListeners()
    this.navigateTo('ScreenMainMenu')
  }

  private setupListeners(): void {
    events.on('NAVIGATE_SCREEN', (screenName: string) => {
      this.navigateTo(screenName)
    })

    events.on('GAME_STATE_CHANGED', (state: GameState) => {
      if (state === 'MENU') {
        this.navigateTo('ScreenMainMenu', false)
      } else if (state === 'ARMORY') {
        this.navigateTo('ScreenArmory', false)
      } else if (state === 'PLAYING') {
        this.navigateTo('ScreenBattleHUD', false)
      } else if (state === 'VICTORY') {
        this.navigateTo('ScreenVictory', false)
      } else if (state === 'DEFEAT') {
        this.navigateTo('ScreenDefeat', false)
      }
    })
  }

  public navigateTo(screenName: string, updateGameState = true): void {
    const current = this.screens.get(this.currentScreenName)
    if (current) {
      current.hide()
    }

    const next = this.screens.get(screenName)
    if (next) {
      this.currentScreenName = screenName
      next.show()

      if (updateGameState) {
        if (screenName === 'ScreenMainMenu') {
          game.setState('MENU')
        } else if (screenName === 'ScreenArmory') {
          game.setState('ARMORY')
        } else if (screenName === 'ScreenBattleHUD') {
          game.setState('PLAYING')
        } else if (screenName === 'ScreenVictory') {
          game.setState('VICTORY')
        } else if (screenName === 'ScreenDefeat') {
          game.setState('DEFEAT')
        }
      }
    }
  }

  public getCurrentScreenName(): string {
    return this.currentScreenName
  }
}
