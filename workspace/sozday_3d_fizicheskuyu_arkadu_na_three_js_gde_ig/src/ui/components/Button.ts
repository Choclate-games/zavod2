/**
 * Standard reusable UI Button component.
 * Adheres strictly to >=64px size rule (>=96px for primary action).
 */

export interface ButtonOptions {
  text: string;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  iconHtml?: string;
  onClick?: () => void;
  className?: string;
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `metro-btn metro-btn-${options.variant || 'secondary'} ${options.className || ''}`;

  if (options.iconHtml) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'btn-icon';
    iconSpan.innerHTML = options.iconHtml;
    btn.appendChild(iconSpan);
  }

  const textSpan = document.createElement('span');
  textSpan.className = 'btn-text';
  textSpan.textContent = options.text;
  btn.appendChild(textSpan);

  if (options.onClick) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      options.onClick!();
    });
  }

  return btn;
}
