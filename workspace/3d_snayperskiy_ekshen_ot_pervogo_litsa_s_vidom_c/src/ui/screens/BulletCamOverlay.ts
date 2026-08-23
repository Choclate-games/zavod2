import { bus } from '../../core/eventBus.js'
import { t } from '../../core/i18n.js'
import { el } from '../components/dom.js'

/** Рапид-режим: неинтерактивная метка замедления и виньетка поверх кадра. */
export class BulletCamOverlay {
  readonly root: HTMLElement

  constructor() {
    this.root = el('div')
    this.root.appendChild(el('div', 'bulletcam-vignette'))
    const tag = el('div', 'bulletcam-tag', t('bulletcam.tag'))
    this.root.appendChild(tag)
    this.root.style.display = 'none'
    bus.on('bullet:flight', (payload) => {
      const active = Boolean((payload as { active?: boolean }).active)
      this.root.style.display = active ? 'block' : 'none'
    })
  }
}
