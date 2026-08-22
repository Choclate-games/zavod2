import { audio } from '../../audio/AudioManager';

export interface ButtonOptions {
  label: string;
  variant?: 'default' | 'primary' | 'ct' | 't' | 'danger';
  icon?: string;
  className?: string;
  onClick?: (e: MouseEvent | TouchEvent) => void;
}

export class Button {
  public readonly element: HTMLButtonElement;

  constructor(options: ButtonOptions) {
    this.element = document.createElement('button');
    this.element.className = `btn btn-${options.variant || 'default'} ${options.className || ''}`;

    if (options.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.innerHTML = options.icon;
      this.element.appendChild(iconSpan);
    }

    const textSpan = document.createElement('span');
    textSpan.textContent = options.label;
    this.element.appendChild(textSpan);

    this.element.addEventListener('click', (e) => {
      audio.playUiClick();
      if (options.onClick) {
        options.onClick(e);
      }
    });
  }

  public setLabel(text: string): void {
    const textSpan = this.element.querySelector('span:last-child');
    if (textSpan) {
      textSpan.textContent = text;
    }
  }

  public setSelected(selected: boolean): void {
    this.element.classList.toggle('selected', selected);
  }

  public setDisabled(disabled: boolean): void {
    this.element.disabled = disabled;
    this.element.classList.toggle('disabled', disabled);
  }
}
