export class Meter {
  public element: HTMLDivElement;
  private barFill: HTMLDivElement;
  private valueLabel: HTMLSpanElement;

  constructor(label: string, customClass = '') {
    this.element = document.createElement('div');
    this.element.className = `meter-container ${customClass}`;
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = 'var(--space-1)';
    this.element.style.minWidth = '140px';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.fontSize = '12px';
    header.style.color = 'var(--color-text-muted)';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = label;
    this.valueLabel = document.createElement('span');
    this.valueLabel.className = 'tabular-stat';
    this.valueLabel.textContent = '100%';

    header.appendChild(titleSpan);
    header.appendChild(this.valueLabel);
    this.element.appendChild(header);

    const track = document.createElement('div');
    track.style.height = '10px';
    track.style.background = 'var(--color-surface)';
    track.style.border = '1px solid var(--color-surface-border)';
    track.style.borderRadius = 'var(--radius-sm)';
    track.style.overflow = 'hidden';

    this.barFill = document.createElement('div');
    this.barFill.style.height = '100%';
    this.barFill.style.width = '100%';
    this.barFill.style.background = 'var(--color-reactor-health)';
    this.barFill.style.transformOrigin = 'left';
    this.barFill.style.transition = 'transform 0.15s ease';

    track.appendChild(this.barFill);
    this.element.appendChild(track);
  }

  public setValue(ratio: number, text?: string, colorVar?: string): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    this.barFill.style.transform = `scaleX(${clamped})`;
    if (colorVar) {
      this.barFill.style.background = colorVar;
    }
    this.valueLabel.textContent = text || `${Math.round(clamped * 100)}%`;
  }
}
