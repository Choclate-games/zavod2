import { EventBus } from '../../core/EventBus'
import { icon } from '../icons'
import { t } from '../locales'
import type { ScreenActions } from '../ScreenRouter'

export class GameplayHudScreen {
  readonly root: HTMLElement
  readonly wave: HTMLSpanElement
  readonly time: HTMLSpanElement
  readonly score: HTMLSpanElement
  readonly combo: HTMLSpanElement
  readonly tier: HTMLSpanElement
  readonly warning: HTMLDivElement

  constructor(private readonly bus: EventBus, actions: ScreenActions) {
    this.root = document.createElement('section')
    this.root.className = 'screen hud'
    this.root.dataset.screen = 'gameplay_hud'
    this.root.hidden = true
    const top = document.createElement('div')
    top.className = 'hud__top'
    const pause = document.createElement('button')
    pause.type = 'button'
    pause.className = 'btn hud__pause'
    pause.setAttribute('aria-label', t('pause'))
    pause.innerHTML = icon('pause')
    pause.addEventListener('click', actions.onPause)
    const center = document.createElement('div')
    center.className = 'hud__slot hud__slot--center'
    center.innerHTML = `<span class="hud__label">${t('wave')}</span>`
    this.wave = document.createElement('span'); this.wave.className = 'hud__value'; center.append(this.wave)
    this.time = document.createElement('span'); this.time.className = 'hud__label'; center.append(this.time)
    const right = document.createElement('div')
    right.className = 'hud__slot'
    right.innerHTML = `<span class="hud__label">${t('score')}</span>`
    this.score = document.createElement('span'); this.score.className = 'hud__value'; right.append(this.score)
    this.combo = document.createElement('span'); this.combo.className = 'hud__combo'; right.append(this.combo)
    top.append(pause, center, right)
    this.warning = document.createElement('div')
    this.warning.className = 'hud__warning'
    this.warning.textContent = t('danger')
    const bottom = document.createElement('div')
    bottom.className = 'hud__bottom'
    bottom.innerHTML = `${t('tier')} <span class="hud__value">` 
    this.tier = document.createElement('span'); bottom.append(this.tier)
    this.root.append(top, this.warning, bottom)
    this.bus.on('game:hud', (state) => this.update(state))
  }

  update(state: { wave: number; time: number; score: number; ringouts: number; tier: number; combo: number; radius: number }): void {
    this.wave.textContent = `${state.wave}/3`
    this.time.textContent = `${Math.max(0, state.time).toFixed(1)} s`
    this.score.textContent = Math.round(state.score).toLocaleString('ru-RU')
    this.combo.textContent = `${t('combo')} x${state.combo}`
    this.tier.textContent = `T${state.tier}`
    this.warning.classList.toggle('is-visible', state.radius < 9)
  }
}
