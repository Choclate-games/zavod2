import { t } from '../i18n/strings.js'
import type { RunStats } from '../core/EventBus.js'
import type { ScreenRouter } from './ScreenRouter.js'
import type { AdsCapability } from '../platform/PlaygamaService.js'
import { formatNumber } from '../i18n/strings.js'

/**
 * Экраны проекта: главное меню, пауза, победа, провал.
 * Каждый экран — три зоны: заголовок, содержимое, одно главное действие.
 * Строки в коде нет — только ключи локализации.
 */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, className?: string, textContent?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (textContent != null) node.textContent = textContent
  return node
}

export interface ScreenCallbacks {
  onStartRun: () => void
  onResume: () => void
  onRestart: () => void
  onRewardedRetry: () => Promise<void>
  onToMenu: () => void
}

function formatDuration(ms: number): string {
  return formatNumber(ms / 1000, 1)
}

export function buildMenuScreen(
  router: ScreenRouter,
  cb: ScreenCallbacks,
  bestTimeMs: number | null,
): void {
  const root = el('div')
  root.id = 'screen-menu'

  const panel = el('div', 'panel')
  panel.appendChild(el('h1', 'screen-title', t('title')))
  panel.appendChild(el('p', 'screen-subtitle', t('menu_goal')))

  const record = el('p', 'stat-value')
  record.textContent =
    bestTimeMs == null ? t('menu_record_none') : `${t('best_time')}: ${formatDuration(bestTimeMs)} ${t('seconds_short')}`
  record.id = 'menu-record-line'
  panel.appendChild(record)

  const actions = el('div', 'actions')
  const start = el('button', 'button-primary')
  start.type = 'button'
  start.textContent = t('start_take')
  start.addEventListener('click', () => {
    start.classList.add('loading')
    setTimeout(() => start.classList.remove('loading'), 300)
    cb.onStartRun()
  })
  actions.appendChild(start)
  panel.appendChild(actions)
  root.appendChild(panel)

  router.register({ id: 'MENU', root })
}

export function refreshMenuRecord(bestTimeMs: number | null): void {
  const line = document.getElementById('menu-record-line')
  if (!line) return
  line.textContent =
    bestTimeMs == null ? t('menu_record_none') : `${t('best_time')}: ${formatDuration(bestTimeMs)} ${t('seconds_short')}`
}

export function buildPauseScreen(router: ScreenRouter, cb: ScreenCallbacks): void {
  const root = el('div')
  root.id = 'screen-pause'

  const panel = el('div', 'panel')
  panel.appendChild(el('h2', 'screen-title', t('pause_title')))
  const actions = el('div', 'actions')
  const resume = el('button', 'button-primary')
  resume.type = 'button'
  resume.textContent = t('resume')
  resume.addEventListener('click', cb.onResume)
  const restart = el('button', 'button-secondary')
  restart.type = 'button'
  restart.textContent = t('restart')
  restart.addEventListener('click', cb.onRestart)
  const menu = el('button', 'button-secondary')
  menu.type = 'button'
  menu.textContent = t('to_menu')
  menu.addEventListener('click', cb.onToMenu)
  actions.append(resume, restart, menu)
  panel.appendChild(actions)
  root.appendChild(panel)

  router.register({ id: 'PAUSED', root })
}

export function buildVictoryScreen(router: ScreenRouter, cb: ScreenCallbacks): void {
  const root = el('div')
  root.id = 'screen-victory'

  const panel = el('div', 'panel')
  panel.appendChild(el('h2', 'screen-title confirm', t('victory_title')))

  const stats = el('dl', 'stats-grid')
  fillStats(stats)
  panel.appendChild(stats)

  const recordLine = el('p', 'record-badge')
  recordLine.id = 'victory-record'
  panel.appendChild(recordLine)

  const actions = el('div', 'actions')
  const again = el('button', 'button-primary')
  again.type = 'button'
  again.textContent = t('start_take')
  again.addEventListener('click', cb.onRestart)
  const menu = el('button', 'button-secondary')
  menu.type = 'button'
  menu.textContent = t('to_menu')
  // Естественная пауза, привязанная к клику игрока: interstitial стреляет отсюда.
  menu.addEventListener('click', cb.onToMenu)
  actions.append(again, menu)
  panel.appendChild(actions)
  root.appendChild(panel)

  router.register({ id: 'VICTORY', root })
}

export function buildFailScreen(
  router: ScreenRouter,
  cb: ScreenCallbacks,
  capability: AdsCapability,
): void {
  const root = el('div')
  root.id = 'screen-fail'

  const panel = el('div', 'panel')
  panel.appendChild(el('h2', 'screen-title danger', t('fail_title')))
  const reason = el('p', 'reason-line')
  reason.id = 'fail-reason'
  panel.appendChild(reason)

  const stats = el('dl', 'stats-grid')
  fillStats(stats)
  panel.appendChild(stats)

  const actions = el('div', 'actions')
  // Возможность, которой на площадке нет, не рисуется вовсе.
  if (capability.rewardedSupported) {
    const retry = el('button', 'button-primary')
    retry.type = 'button'
    retry.textContent = t('retry_rewarded')
    retry.addEventListener('click', () => {
      if (retry.classList.contains('loading')) return
      retry.classList.add('loading')
      void cb.onRewardedRetry().finally(() => retry.classList.remove('loading'))
    })
    actions.appendChild(retry)
  }
  const restart = el('button', capability.rewardedSupported ? 'button-secondary' : 'button-primary')
  restart.type = 'button'
  restart.textContent = t('restart')
  restart.addEventListener('click', cb.onRestart)
  const menu = el('button', 'button-secondary')
  menu.type = 'button'
  menu.textContent = t('to_menu')
  menu.addEventListener('click', cb.onToMenu)
  actions.append(restart, menu)
  panel.appendChild(actions)
  root.appendChild(panel)

  router.register({ id: 'FAIL', root })
}

/** Обновляет содержимое итогов последнего дубля. */
export function updateResultScreens(win: boolean, reasonKey: string | null, stats: RunStats): void {
  const statsNodes = document.querySelectorAll('.stats-grid')
  for (const grid of statsNodes) {
    fillStatsValues(grid as HTMLDListElement, stats)
  }
  const reasonNode = document.getElementById('fail-reason')
  if (reasonNode && reasonKey) {
    reasonNode.textContent = t(reasonKey as Parameters<typeof t>[0])
  }
  const recordNode = document.getElementById('victory-record')
  if (recordNode) {
    recordNode.textContent = stats.newRecord
      ? t('new_record')
      : `${t('best_time')}: ${formatDuration(stats.bestTimeMs ?? stats.timeMs)} ${t('seconds_short')}`
  }
  void win
}

function fillStats(grid: HTMLDListElement): void {
  grid.innerHTML = ''
  const add = (labelKey: Parameters<typeof t>[0], valueId: string): void => {
    const dt = el('dt', undefined, t(labelKey))
    const dd = el('dd', 'stat-value')
    dd.dataset.stat = valueId
    grid.append(dt, dd)
  }
  add('stats_time', 'time')
  add('stats_accuracy', 'accuracy')
  add('stats_headshots', 'headshots')
  add('stats_rating', 'rating')
}

function fillStatsValues(grid: HTMLDListElement, stats: RunStats): void {
  const set = (id: string, value: string): void => {
    const node = grid.querySelector(`[data-stat="${id}"]`)
    if (node) node.textContent = value
  }
  set('time', `${formatDuration(stats.timeMs)} ${t('seconds_short')}`)
  set('accuracy', stats.shots > 0
    ? formatNumber(((stats.hitsBody + stats.headshots) / stats.shots) * 100, 0) + '%'
    : '—')
  set('headshots', formatNumber(stats.headshots))
  set('rating', formatNumber(stats.rating))
}
