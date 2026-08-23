import { EventBus } from '../../core/EventBus';

export class ToastManager {
  public container: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.top = 'calc(var(--space-6) * var(--ui-scale) + var(--safe-inset-top))';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.alignItems = 'center';
    this.container.style.gap = 'var(--space-2)';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = 'var(--z-toast)';

    EventBus.on('TOAST_SHOW', (payload) => {
      this.show(payload.message, payload.type);
    });
  }

  public show(message: string, type: 'info' | 'warn' | 'error' = 'info'): void {
    const toast = document.createElement('div');
    toast.className = 'panel';
    toast.style.padding = 'calc(var(--space-2) * var(--ui-scale)) calc(var(--space-4) * var(--ui-scale))';
    toast.style.borderRadius = 'var(--radius-md)';
    toast.style.fontSize = '14px';
    toast.style.fontFamily = 'var(--font-display)';
    toast.style.textTransform = 'uppercase';
    toast.style.letterSpacing = '0.5px';
    toast.style.boxShadow = '0 4px 14px var(--color-overlay-shadow)';

    if (type === 'warn') {
      toast.style.borderColor = 'var(--color-power-charged)';
      toast.style.color = 'var(--color-power-charged)';
    } else if (type === 'error') {
      toast.style.borderColor = 'var(--color-danger-overheat)';
      toast.style.color = 'var(--color-danger-overheat)';
    } else {
      toast.style.borderColor = 'var(--color-cooling-ready)';
      toast.style.color = 'var(--color-cooling-ready)';
    }

    toast.textContent = message;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 2400);
  }
}
