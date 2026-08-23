export class Panel {
  public element: HTMLDivElement;

  constructor(title?: string, className?: string) {
    this.element = document.createElement('div');
    this.element.className = `panel interactive ${className || ''}`;

    if (title) {
      const header = document.createElement('div');
      header.className = 'panel-header';
      header.textContent = title;
      this.element.appendChild(header);
    }
  }

  public appendChild(child: HTMLElement): void {
    this.element.appendChild(child);
  }
}
