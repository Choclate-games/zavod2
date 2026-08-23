import { applyTranslations, t } from '../lang.js'
import { save, type Upgrades } from '../../platform/save.js'

interface UpgradeDef {
  key: keyof Upgrades
  nameKey: string
  descKey: string
}

const UPGRADES: UpgradeDef[] = [
  { key: 'confettiStock', nameKey: 'ws.confetti.name', descKey: 'ws.confetti.desc' },
  { key: 'silentSteps', nameKey: 'ws.silent.name', descKey: 'ws.silent.desc' },
  { key: 'strongGuard', nameKey: 'ws.guard.name', descKey: 'ws.guard.desc' },
] as const

/** Мастерская: улучшения за золото, уровни ограничены. */
export class WorkshopScreen {
  readonly root = document.createElement('div')

  constructor(onBack: () => void) {
    this.root.className = 'screen'
    this.root.dataset.screen = 'workshop'

    const box = document.createElement('div')
    box.className = 'workshop-box'

    const title = document.createElement('div')
    title.className = 'workshop-title'
    title.setAttribute('data-lang', 'workshop.title')

    const goldLine = document.createElement('div')
    goldLine.className = 'result-line'
    goldLine.setAttribute('data-gold-slot', '')

    const list = document.createElement('div')
    list.className = 'workshop-list'
    list.setAttribute('data-upgrade-list', '')

    const backBtn = document.createElement('button')
    backBtn.type = 'button'
    backBtn.className = 'btn btn-primary'
    backBtn.setAttribute('data-lang', 'workshop.back')
    backBtn.addEventListener('click', onBack)

    box.appendChild(title)
    box.appendChild(goldLine)
    box.appendChild(list)
    box.appendChild(backBtn)
    this.root.appendChild(box)
    applyTranslations(this.root)
  }

  refresh(): void {
    const snap = save.snapshot
    const goldNode = this.root.querySelector('[data-gold-slot]')
    if (goldNode) goldNode.textContent = t('workshop.gold', { gold: String(snap.gold) })
    const list = this.root.querySelector('[data-upgrade-list]')
    if (!list) return
    list.replaceChildren()
    for (const def of UPGRADES) {
      const level = snap.upgrades[def.key]
      const item = document.createElement('div')
      item.className = 'ws-item'

      const textCol = document.createElement('div')
      const name = document.createElement('div')
      name.className = 'ws-name'
      name.textContent = `${t(def.nameKey)} · ${level + 1}/${save.maxLevel() + 1}`
      const desc = document.createElement('div')
      desc.className = 'ws-desc'
      desc.textContent = t(def.descKey)
      textCol.appendChild(name)
      textCol.appendChild(desc)

      const buyBtn = document.createElement('button')
      buyBtn.type = 'button'
      buyBtn.className = 'btn'
      const maxed = level >= save.maxLevel()
      const cost = save.upgradeCost(level)
      if (maxed) {
        buyBtn.textContent = t('workshop.maxed')
        buyBtn.disabled = true
      } else {
        buyBtn.textContent = t('workshop.buy', { cost: String(cost) })
        buyBtn.disabled = snap.gold < cost
        buyBtn.addEventListener('click', () => {
          const current = save.snapshot
          const currentLevel = current.upgrades[def.key]
          const currentCost = save.upgradeCost(currentLevel)
          if (currentLevel >= save.maxLevel() || current.gold < currentCost) return
          save.update((data) => {
            data.gold -= currentCost
            data.upgrades[def.key] += 1
          })
          this.refresh()
        })
      }
      item.appendChild(textCol)
      item.appendChild(buyBtn)
      list.appendChild(item)
    }
  }
}
