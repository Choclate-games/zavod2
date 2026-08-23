export interface ButtonOptions {
  text: string;
  variant?: 'primary' | 'secondary' | 'success';
  icon?: string;
  className?: string;
  onClick?: () => void;
}

export class Button {
  public element: HTMLButtonElement;

  constructor(options: ButtonOptions) {
    this.element = document.createElement('button');
    this.element.type = 'button';
    const variantClass = options.variant ? `btn-${options.variant}` : 'btn-secondary';
    this.element.className = `btn ${variantClass} ${options.className || ''}`.trim();

    if (options.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'btn-icon';
      iconSpan.innerHTML = options.icon;
      this.element.appendChild(iconSpan);
    }

    const textSpan = document.createElement('span');
    textSpan.className = 'btn-text';
    textSpan.textContent = options.text;
    this.element.appendChild(textSpan);

    if (options.onClick) {
      this.element.addEventListener('click', (e) => {
        e.stopPropagation();
        options.onClick!();
      });
    }
  }
}