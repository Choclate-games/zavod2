import { iconSvg, type IconName } from './icons.js'

/**
 * Закрытый набор DOM-компонентов интерфейса. Всё на экране собирается из них;
 * значения приходят из theme.css классами и токенами.
 */
export function el(tag: string, className: string | null = null, text: string | null = null): HTMLElement {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== null) node.textContent = text
  return node
}

export interface ButtonOptions {
  icon?: IconName
  label?: string
  primary?: boolean
  ariaLabel?: string
}

export function button(options: ButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  let className = 'btn'
  if (options.primary) className += ' btn-primary'
  else if (!options.label) className += ' btn-icon'
  btn.className = className
  if (options.ariaLabel) btn.setAttribute('aria-label', options.ariaLabel)
  if (options.icon) {
    const span = document.createElement('span')
    span.innerHTML = iconSvg(options.icon)
    btn.appendChild(span)
  }
  if (options.label) {
    const labelSpan = document.createElement('span')
    labelSpan.className = 'btn-label'
    labelSpan.textContent = options.label
    btn.appendChild(labelSpan)
  }
  return btn
}

/** Полоса состояния: анимация через transform: scaleX(), не width. */
export class Meter {
  readonly root: HTMLElement
  private readonly fill: HTMLElement

  constructor(className: string) {
    this.root = el('div', className)
    this.fill = el('div', `${className}-fill`)
    this.root.appendChild(this.fill)
  }

  set(ratio: number): void {
    const clamped = Math.max(0, Math.min(1, ratio))
    this.fill.style.transform = `scaleX(${clamped.toFixed(3)})`
  }

  toggleDanger(danger: boolean): void {
    this.fill.classList.toggle('is-hurt', danger)
  }
}

/** Круговой прибор (термометр линзы) на SVG-дуге. */
export class CircularGauge {
  readonly root: SVGSVGElement
  private readonly valuePath: SVGPathElement
  private readonly label: SVGTextElement

  constructor() {
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('viewBox', '0 0 64 64')
    svg.classList.add('gauge')

    const arc = document.createElementNS(ns, 'path')
    arc.setAttribute('d', this.arcPath())
    arc.classList.add('gauge-arc')

    this.valuePath = document.createElementNS(ns, 'path')
    this.valuePath.setAttribute('d', this.arcPath())
    this.valuePath.classList.add('gauge-value')
    // Длина дуги 270 градусов радиуса 24.
    this.valuePath.style.strokeDasharray = '113.1'
    this.valuePath.style.strokeDashoffset = '0'

    this.label = document.createElementNS(ns, 'text')
    this.label.setAttribute('x', '32')
    this.label.setAttribute('y', '37')
    this.label.setAttribute('text-anchor', 'middle')
    this.label.classList.add('gauge-label')
    this.label.textContent = '0%'

    svg.appendChild(arc)
    svg.appendChild(this.valuePath)
    svg.appendChild(this.label)
    this.root = svg
  }

  private arcPath(): string {
    const startAngle = 135
    const sweep = 270
    const toXY = (angleDeg: number): [number, number] => {
      const rad = (angleDeg * Math.PI) / 180
      return [32 + 24 * Math.cos(rad), 32 + 24 * Math.sin(rad)]
    }
    const [x0, y0] = toXY(startAngle)
    const [x1, y1] = toXY(startAngle + sweep)
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A 24 24 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
  }

  set(ratio: number, hot: boolean): void {
    const clamped = Math.max(0, Math.min(1, ratio))
    this.valuePath.style.strokeDashoffset = (-clamped * 113.1).toFixed(1)
    this.valuePath.classList.toggle('is-hot', hot || clamped > 0.7)
    this.label.textContent = `${Math.round(clamped * 100)}%`
  }
}
