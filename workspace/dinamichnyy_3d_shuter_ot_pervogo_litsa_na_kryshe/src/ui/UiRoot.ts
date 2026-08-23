// UiRoot: РµРґРёРЅСЃС‚РІРµРЅРЅРѕРµ РјРµСЃС‚Рѕ, РіРґРµ СЃРѕР·РґР°С‘С‚СЃСЏ DOM. РЎР»РѕРё РЅР°Рґ РєР°РЅРІР°СЃРѕРј,
// РёР·РјРµСЂРµРЅРЅС‹Р№ РІСЊСЋРїРѕСЂС‚ (РЅРµ 100vh), safe-area Рё РІС‹СЃРѕС‚Р° Р±Р°РЅРЅРµСЂР° вЂ” С‚РѕРєРµРЅР°РјРё CSS.

import './theme.css'
import { el } from './components'
import { Hud } from './Hud'
import { ScreenRouter, type ScreenName } from './ScreenRouter'
import { TouchControls } from './TouchControls'
import { MainMenuScreen } from './screens/MainMenuScreen'
import { PauseModal } from './screens/PauseModal'
import { VictoryScreen } from './screens/VictoryScreen'
import { DefeatModal } from './screens/DefeatModal'
import type { InputRouter } from '../input/InputRouter'

export interface UiCallbacks {
  onStart: () => void
  onResume: () => void
  onRestart: () => void
  onToMenu: () => void
  onToggleSound: () => boolean
  onChangeSensitivity: (value: number) => void
  getSensitivity: () => number
  onVictoryAgain: () => void
  onRevive: () => void
}

export class UiRoot {
  readonly canvas: HTMLCanvasElement
  readonly hud: Hud
  touch: TouchControls | null = null
  readonly router: ScreenRouter

  private readonly appRoot: HTMLElement
  private readonly hudLayer: HTMLElement
  private readonly screensLayer: HTMLElement
  private readonly touchLayer: HTMLElement
  private readonly loadingLayer: HTMLElement
  private readonly loadingFill: HTMLElement
  private mainMenu: MainMenuScreen
  private victory: VictoryScreen
  private defeat: DefeatModal
  private pause: PauseModal

  constructor(
    canvas: HTMLCanvasElement,
    private readonly input: InputRouter,
    callbacks: UiCallbacks,
  ) {
    this.canvas = canvas
    this.appRoot = document.getElementById('app') ?? document.body

    this.hudLayer = el('div', 'layer layer-hud')
    this.touchLayer = el('div', 'layer layer-touch')
    this.screensLayer = el('div', 'layer layer-screens')
    this.loadingLayer = el('div', 'layer loading-layer')

    const loadingTitle = el('div', 'title')
    loadingTitle.textContent = ''
    const bar = el('div', 'loading-bar')
    this.loadingFill = el('div', 'loading-fill')
    bar.appendChild(this.loadingFill)
    this.loadingLayer.append(loadingTitle, bar)

    // РїРѕСЂСЏРґРѕРє РІСЃС‚Р°РІРєРё Р·Р°РґР°С‘С‚ СЃР»РѕРё; canvas РїРµСЂРІС‹Рј, Р·Р°РіСЂСѓР·РєР° РїРѕРІРµСЂС… РІСЃРµРіРѕ
    this.appRoot.replaceChildren(this.canvas, this.hudLayer, this.touchLayer, this.screensLayer, this.loadingLayer)

    this.router = new ScreenRouter(this.screensLayer)
    this.hud = new Hud()

    this.mainMenu = new MainMenuScreen(callbacks.onStart)
    this.pause = new PauseModal({
      onResume: callbacks.onResume,
      onRestart: callbacks.onRestart,
      onToMenu: callbacks.onToMenu,
      onToggleSound: callbacks.onToggleSound,
      onChangeSensitivity: callbacks.onChangeSensitivity,
      getSensitivity: callbacks.getSensitivity,
    })
    this.victory = new VictoryScreen(callbacks.onVictoryAgain, callbacks.onToMenu)
    this.defeat = new DefeatModal({
      onRevive: callbacks.onRevive,
      onRestart: callbacks.onRestart,
      onToMenu: callbacks.onToMenu,
    })
    this.router.register('MAIN_MENU', this.mainMenu.root)
    this.router.register('HUD_INGAME', this.hud.root)
    this.router.register('PAUSE_MODAL', this.pause.root)
    this.router.register('VICTORY_SCREEN', this.victory.root)
    this.router.register('DEFEAT_MODAL', this.defeat.root)

    window.addEventListener('resize', () => this.measure())
    this.measure()
  }

  /** РўР°С‡-СЃР»РѕР№ СЃС‚СЂРѕРёС‚СЃСЏ С‚РѕР»СЊРєРѕ РєРѕРіРґР° РјРѕСЃС‚ СЃРєР°Р·Р°Р», С‡С‚Рѕ СѓСЃС‚СЂРѕР№СЃС‚РІРѕ СЃРµРЅСЃРѕСЂРЅРѕРµ. */
  ensureTouchControls(): TouchControls {
    if (this.touch == null) {
      this.touch = new TouchControls(this.input)
      this.touchLayer.appendChild(this.touch.root)
    }
    return this.touch
  }

  show(name: ScreenName): void {
    this.router.show(name)
    this.hudLayer.classList.toggle('hidden', name !== 'HUD_INGAME' && name !== 'PAUSE_MODAL')
    this.touchLayer.classList.toggle('hidden', name !== 'HUD_INGAME')
    if (this.touch != null && name !== 'HUD_INGAME') this.touch.reset()
  }

  showLoading(): void {
    this.loadingLayer.style.opacity = '1'
    this.setLoadingProgress(0.05)
  }

  setLoadingProgress(ratio: number): void {
    this.loadingFill.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio)).toFixed(3)})`
  }

  hideLoading(): void {
    this.loadingLayer.style.opacity = '0'
    this.setLoadingProgress(1)
    setTimeout(() => this.loadingLayer.classList.add('hidden'), 300)
  }

  setMainMenuBest(score: number): void {
    this.mainMenu.setBest(score)
  }

  showVictory(score: number, kills: number, timeLeftS: number, rank: string, isRecord: boolean): void {
    this.victory.show({ score, kills, timeLeftS, shieldPct: 0, rank }, isRecord)
  }

  showDefeat(score: number, kills: number, reason: 'shield' | 'fall' | 'timeout', reviveAvailable: boolean): void {
    this.defeat.show({ score, kills, timeLeftS: 0, shieldPct: 0, rank: '' }, reason, reviveAvailable)
  }

  setReviveVisible(visible: boolean): void {
    this.defeat.show({ score: 0, kills: 0, timeLeftS: 0, shieldPct: 0, rank: '' }, 'shield', visible)
  }

  private measure(): void {
    this.writeViewportVars()
  }

  private writeViewportVars(): void {
    const height = window.visualViewport?.height ?? window.innerHeight
    this.appRoot.style.setProperty('--vp-h', `${height}px`)
    this.appRoot.style.setProperty('--vp-w', `${window.innerWidth}px`)
    // СЂРµР·РµСЂРІ РїРѕРґ РїРѕР»РѕСЃСѓ Р±Р°РЅРЅРµСЂР° РїР»РѕС‰Р°РґРєРё: РїСЂРёРјРµРЅСЏРµС‚СЃСЏ Рє СЂР°СЃРєР»Р°РґРєРµ С‡РµСЂРµР· calc()
    this.appRoot.style.setProperty('--banner-height', `${this.bannerReservePx()}px`)
  }

  private bannerReservePx(): number {
    // Р±Р°РЅРЅРµСЂ РІС‹РєР»СЋС‡РµРЅ РєРѕРЅС„РёРіРѕРј: СЂРµР·РµСЂРІ РЅСѓР»РµРІРѕР№, РЅРѕ РїРµСЂРµРјРµРЅРЅР°СЏ Р¶РёРІР°СЏ Рё С‡РёС‚Р°РµС‚СЃСЏ CSS
    return 0
  }
}

