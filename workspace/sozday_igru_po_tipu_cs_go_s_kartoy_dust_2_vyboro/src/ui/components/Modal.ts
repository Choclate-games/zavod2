export interface ModalOptions {
  title: string;
  content: HTMLElement | string;
  onClose?: () => void;
}

export class Modal {
  public readonly overlay: HTMLDivElement;
  public readonly contentContainer: HTMLDivElement;

  constructor(options: ModalOptions) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';

    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'modal-content';

    const header = document.createElement('h2');
    header.className = 'game-title';
    header.style.fontSize = '1.4rem';
    header.textContent = options.title;
    this.contentContainer.appendChild(header);

    const body = document.createElement('div');
    if (typeof options.content === 'string') {
      body.innerHTML = options.content;
    } else {
      body.appendChild(options.content);
    }
    this.contentContainer.appendChild(body);

    this.overlay.appendChild(this.contentContainer);

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay && options.onClose) {
        options.onClose();
      }
    });
  }

  public show(): void {
    this.overlay.classList.add('active');
  }

  public hide(): void {
    this.overlay.classList.remove('active');
  }
}
