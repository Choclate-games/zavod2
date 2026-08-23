import { t } from '../../data/i18n'

/**
 * Панель матового стекла и полоса-метр. Полоса анимируется только
 * transform: scaleX, без width — строка не рефлоуится в кадре.
 */
export function createPanel(solid = false): HTMLDivElement {
  const panel = document.createElement('div')
  panel.className = solid ? 'panel panel-solid' : 'panel'
  return panel
}

export function createMeter(fillColorClass: string): { root: HTMLDivElement; fill: HTMLDivElement } {
  const root = document.createElement('div')
  root.className = 'meter'
  const fill = document.createElement('div')
  fill.className = `meter-fill ${fillColorClass}`
  root.appendChild(fill)
  return { root, fill }
}

export function createStat(labelKey: string): {
  root: HTMLDivElement
  value: HTMLDivElement
} {
  const root = document.createElement('div')
  root.className = 'stat'
  const value = document.createElement('div')
  value.className = 'stat-value'
  value.textContent = '—'
  const label = document.createElement('div')
  label.className = 'stat-label'
  label.textContent = t(labelKey)
  root.append(value, label)
  return { root, value }
}
