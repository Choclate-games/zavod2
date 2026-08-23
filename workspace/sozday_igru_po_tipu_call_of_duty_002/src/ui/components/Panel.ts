export class Panel {
  public element: HTMLDivElement;

  constructor(className: string = '') {
    this.element = document.createElement('div');
    this.element.className = `panel ${className}`.trim();
  }

  public append(child: HTMLElement): void {
    this.element.appendChild(child);
  }
}