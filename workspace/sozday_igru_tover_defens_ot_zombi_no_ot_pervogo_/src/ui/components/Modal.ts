export class Modal {
  public element: HTMLDivElement;
  private contentContainer: HTMLDivElement;

  constructor(title: string) {
    this.element = document.createElement('div');
    this.element.className = 'game-screen interactive';

    const card = document.createElement('div');
    card.className = 'panel';
    card.style.maxWidth = '540px';
    card.style.margin = 'auto';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.textContent = title;
    card.appendChild(header);

    this.contentContainer = document.createElement('div');
    this.contentContainer.style.display = 'flex';
    this.contentContainer.style.flexDirection = 'column';
    this.contentContainer.style.gap = 'calc(var(--space-4) * var(--ui-scale))';
    card.appendChild(this.contentContainer);

    this.element.appendChild(card);
  }

  public setContent(element: HTMLElement): void {
    this.contentContainer.innerHTML = '';
    this.contentContainer.appendChild(element);
  }
}
