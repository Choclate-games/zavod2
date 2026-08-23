export class DuelHudScreen {
  public root: HTMLElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'screen-root';
  }

  public show(): void {
    this.root.classList.add('active');
  }

  public hide(): void {
    this.root.classList.remove('active');
  }
}