import { BaseScreen } from '../ScreenRouter';
import { ui } from '../UiRoot';
import { events, GameEvents } from '../../core/EventBus';

export class RoundEndModalScreen implements BaseScreen {
  public readonly element: HTMLElement;
  private resultTitle!: HTMLElement;
  private resultReason!: HTMLElement;
  private scoreText!: HTMLElement;
  private mvpText!: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'screen';
    this.element.id = 'screen-round-end';

    this.buildMarkup();
    ui.screenLayer.appendChild(this.element);

    events.on('ROUND_END', (data) => this.update(data));
  }

  private buildMarkup(): void {
    // Center Card Modal
    const centerZone = document.createElement('div');
    centerZone.className = 'zone-primary';
    centerZone.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;';

    const card = document.createElement('div');
    card.className = 'card-panel';
    card.style.cssText = 'max-width:540px;width:90%;text-align:center;padding:24px;display:flex;flex-direction:column;gap:16px;align-items:center;';

    this.resultTitle = document.createElement('h2');
    this.resultTitle.className = 'game-title';
    this.resultTitle.style.fontSize = '1.8rem';
    this.resultTitle.textContent = 'РАУНД ЗАВЕРШЁН';

    this.resultReason = document.createElement('div');
    this.resultReason.style.cssText = 'font-size:1.1rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--color-primary-action);';
    this.resultReason.textContent = 'БОМБА ОБЕЗВРЕЖЕНА';

    this.scoreText = document.createElement('div');
    this.scoreText.className = 'num-slot';
    this.scoreText.style.fontSize = '2.4rem';
    this.scoreText.textContent = 'CT 2 : 1 T';

    this.mvpText = document.createElement('div');
    this.mvpText.style.cssText = 'font-size:0.95rem;color:var(--color-text-muted);';
    this.mvpText.textContent = 'MVP раунда: Игрок (3 фрага)';

    card.appendChild(this.resultTitle);
    card.appendChild(this.resultReason);
    card.appendChild(this.scoreText);
    card.appendChild(this.mvpText);

    centerZone.appendChild(card);
    this.element.appendChild(centerZone);
  }

  public update(data: GameEvents['ROUND_END']): void {
    const isCT = data.winnerTeam === 'CT';
    this.resultTitle.textContent = isCT ? 'СПЕЦНАЗ ВЫИГРАЛ РАУНД' : 'ТЕРРОРИСТЫ ВЫИГРАЛИ РАУНД';
    this.resultTitle.style.color = isCT ? 'var(--color-ct)' : 'var(--color-t)';
    this.resultReason.textContent = data.reason;
    this.scoreText.textContent = `CT ${data.roundCT} : ${data.roundT} T`;
    this.mvpText.textContent = `⭐ MVP раунда: ${data.mvpName} (+${data.mvpScore} очков)`;
  }

  public show(): void {
    this.element.classList.add('active');
  }

  public hide(): void {
    this.element.classList.remove('active');
  }
}
