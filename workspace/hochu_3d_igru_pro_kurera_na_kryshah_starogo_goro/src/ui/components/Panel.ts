export interface PanelOptions {
  className?: string
}

export function createPanel(options: PanelOptions = {}): HTMLElement {
  const panel = document.createElement('div')
  panel.className = `panel ${options.className || ''}`
  return panel
}
