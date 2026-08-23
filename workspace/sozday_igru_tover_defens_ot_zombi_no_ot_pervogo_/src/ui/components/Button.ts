import { AudioManager } from '../../audio/AudioManager';

export interface ButtonOptions {
  label: string;
  className?: string;
  isPrimary?: boolean;
  icon?: string;
  onClick: (e: MouseEvent | TouchEvent) => void;
}

export class Button {
  public element: HTMLButtonElement;

  constructor(options: ButtonOptions) {
    this.element = document.createElement('button');
    let classes = 'btn interactive';
    if (options.isPrimary) classes += ' btn-primary';
    if (options.className) classes += ` ${options.className}`;
    this.element.className = classes;

    let content = '';
    if (options.icon) {
      content += options.icon;
    }
    content += `<span>${options.label}</span>`;
    this.element.innerHTML = content;

    this.element.addEventListener('click', (e) => {
      AudioManager.playUiClick();
      options.onClick(e);
    });
  }

  public setLabel(text: string): void {
    const span = this.element.querySelector('span');
    if (span) span.textContent = text;
  }
}
