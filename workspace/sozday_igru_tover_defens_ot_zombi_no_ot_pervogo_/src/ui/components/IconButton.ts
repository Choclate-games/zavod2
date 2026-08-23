import { AudioManager } from '../../audio/AudioManager';

export interface IconButtonOptions {
  iconSvg: string;
  ariaLabel: string;
  className?: string;
  onClick: () => void;
}

export class IconButton {
  public element: HTMLButtonElement;

  constructor(options: IconButtonOptions) {
    this.element = document.createElement('button');
    this.element.className = `icon-btn interactive ${options.className || ''}`;
    this.element.setAttribute('aria-label', options.ariaLabel);
    this.element.innerHTML = options.iconSvg;

    this.element.addEventListener('click', () => {
      AudioManager.playUiClick();
      options.onClick();
    });
  }
}
