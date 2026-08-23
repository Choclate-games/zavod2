export interface ProgressBarHandle {
  element: HTMLElement
  setProgress: (percent: number) => void
}

export function createProgressBar(className = ''): ProgressBarHandle {
  const container = document.createElement('div')
  container.className = `progress-bar-container ${className}`
  container.style.position = 'relative'
  container.style.overflow = 'hidden'
  container.style.width = '100%'
  container.style.height = '14px'
  container.style.background = 'var(--color-bg)'
  container.style.border = '1px solid var(--color-panel-border)'
  container.style.borderRadius = 'calc(var(--space-1) * var(--ui-scale))'

  const fill = document.createElement('div')
  fill.className = 'progress-bar-fill'
  fill.style.position = 'absolute'
  fill.style.top = '0'
  fill.style.left = '0'
  fill.style.width = '100%'
  fill.style.height = '100%'
  fill.style.background = 'var(--color-safe)'
  fill.style.transformOrigin = 'left center'
  fill.style.transform = 'scaleX(0)'
  fill.style.transition = 'transform 120ms linear'

  container.appendChild(fill)

  return {
    element: container,
    setProgress: (percent: number) => {
      const clamped = Math.max(0, Math.min(100, percent)) / 100
      fill.style.transform = `scaleX(${clamped})`
    },
  }
}
