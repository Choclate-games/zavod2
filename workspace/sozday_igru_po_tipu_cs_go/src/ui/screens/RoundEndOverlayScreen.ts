import { EventBus } from '../../core/EventBus';

export class RoundEndOverlayScreen {
  public root: HTMLElement;
  private resultBanner: HTMLElement;
  private scoreBanner: HTMLElement;
  private timeBanner: HTMLElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'screen-root';

    // Zone 1: Header (Winner announcement)
    const header = document.createElement('div');
    header.className = 'zone-header';
    header.style.justifyContent = 'center';

    this.resultBanner = document.createElement('div');
    this.resultBanner.className = 'cyber-panel';
    this.resultBanner.style.textAlign = 'center';
    this.resultBanner.innerHTML = `<h2 style="font-family: var(--font-display); font-size: clamp(24px, 4vw, 38px); font-weight: 800; color: var(--color-highlight); text-transform: uppercase;">РАУНД ВЫИГРАН!</h2>`;
    header.appendChild(this.resultBanner);
    this.root.appendChild(header);

    // Zone 2: Content (Score + Time)
    const content = document.createElement('div');
    content.className = 'zone-content';

    const card = document.createElement('div');
    card.className = 'cyber-panel';
    card.style.textAlign = 'center';

    this.scoreBanner = document.createElement('div');
    this.scoreBanner.className = 'tabular-nums';
    this.scoreBanner.style.fontFamily = 'var(--font-display)';
    this.scoreBanner.style.fontSize = '32px';
    this.scoreBanner.style.fontWeight = '700';
    this.scoreBanner.style.color = 'var(--color-text-bright)';
    this.scoreBanner.textContent = 'СЧЕТ: 1 - 0';
    card.appendChild(this.scoreBanner);

    this.timeBanner = document.createElement('div');
    this.timeBanner.className = 'tabular-nums';
    this.timeBanner.style.color = 'var(--color-metallic)';
    this.timeBanner.style.fontSize = '15px';
    this.timeBanner.style.marginTop = '6px';
    this.timeBanner.textContent = 'ВРЕМЯ: 7.2 с';
    card.appendChild(this.timeBanner);

    content.appendChild(card);
    this.root.appendChild(content);

    // Zone 3: Actions (Auto countdown)
    const actions = document.createElement('div');
    actions.className = 'zone-actions';
    const hint = document.createElement('div');
    hint.className = 'cyber-panel';
    hint.innerHTML = `<span style="color: var(--color-metallic); font-size: 13px;">СМЕНА ПОЗИЦИЙ СПАВНА...</span>`;
    actions.appendChild(hint);
    this.root.appendChild(actions);

    this.setupListeners();
  }

  private setupListeners(): void {
    EventBus.get().on('ROUND_ENDED', (data: { winner: 'player' | 'bot' | 'draw'; isHeadshot: boolean; playerScore: number; botScore: number; roundTime: number }) => {
      let title = 'РАУНД ПРОИГРАН';
      let titleColor = 'var(--color-critical-alert)';

      if (data.winner === 'player') {
        title = data.isHeadshot ? 'ВАН-ТАП! ХЕДШОТ!' : 'РАУНД ВЫИГРАН!';
        titleColor = 'var(--color-highlight)';
      } else if (data.winner === 'draw') {
        title = 'НИЧЬЯ ПО ТАЙМЕРУ';
        titleColor = 'var(--color-metallic)';
      }

      this.resultBanner.innerHTML = `<h2 style="font-family: var(--font-display); font-size: clamp(24px, 4vw, 38px); font-weight: 800; color: ${titleColor}; text-transform: uppercase;">${title}</h2>`;
      this.scoreBanner.textContent = `СЧЕТ: ${data.playerScore} - ${data.botScore}`;
      this.timeBanner.textContent = `ВРЕМЯ РАУНДА: ${data.roundTime.toFixed(1)} с`;
    });
  }
}