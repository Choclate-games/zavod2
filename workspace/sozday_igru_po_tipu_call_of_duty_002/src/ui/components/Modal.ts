export class Modal {
  public element: HTMLDivElement;
  private contentPanel: HTMLDivElement;

  constructor(title: string) {
    this.element = document.createElement('div');
    this.element.className = 'modal-backdrop ui-layer';
    this.element.style.display = 'none';

    this.contentPanel = document.createElement('div');
    this.contentPanel.className = 'panel modal-content';

    const titleEl = document.createElement('h2');
    titleEl.className = 'modal-title';
    titleEl.textContent = title;
    this.contentPanel.appendChild(titleEl);

    this.element.appendChild(this.contentPanel);
  }

  public show(): void {
    this.element.style.display = 'flex';
  }

  public hide(): void {
    this.element.style.display = 'none';
  }

  public addContent(el: HTMLElement): void {
    this.contentPanel.appendChild(el);
  }
}