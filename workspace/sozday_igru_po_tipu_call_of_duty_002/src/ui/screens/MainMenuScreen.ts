import { Button } from '../components/Button';
import { ICONS } from '../icons';
import { eventBus } from '../../core/EventBus';
import { StorageService } from '../../platform/StorageService';

export class MainMenuScreen {
  public element: HTMLDivElement;

  constructor(onStartGame: () => void) {
    this.element = document.createElement('div');
    this.element.id = 'screen-main-menu';
    this.element.className = 'screen';

    // 1. Top Section: Game Title & Player Rank Card
    const topSection = document.createElement('div');
    topSection.className = 'panel';
    topSection.style.maxWidth = '420px';

    const titleEl = document.createElement('h1');
    titleEl.textContent = 'ГАНГЕЙМ: ПРОРЫВ';
    titleEl.style.fontSize = 'clamp(20px, calc(28px * var(--ui-scale)), 34px)';
    titleEl.style.color = 'var(--color-primary)';
    titleEl.style.letterSpacing = '2px';
    topSection.appendChild(titleEl);

    const subTitleEl = document.createElement('div');
    subTitleEl.textContent = 'ТЕРМИНАЛ SHIPMENT // ГОНКА ВООРУЖЕНИЙ';
    subTitleEl.style.color = 'var(--color-text-muted)';
    subTitleEl.style.fontSize = '12px';
    subTitleEl.style.marginTop = '4px';
    topSection.appendChild(subTitleEl);

    const stats = StorageService.getData();
    const rankEl = document.createElement('div');
    rankEl.className = 'tabular-numbers';
    rankEl.style.marginTop = '12px';
    rankEl.style.fontSize = '14px';
    rankEl.textContent = `РАНГ ОПЕРАТИВНИКА: ${stats.rank} | ПОБЕД: ${stats.totalWins} | ФРАГОВ: ${stats.totalFrags}`;
    topSection.appendChild(rankEl);
    this.element.appendChild(topSection);

    // 2. Middle Section: Rules / Camo Info
    const midSection = document.createElement('div');
    midSection.className = 'panel';
    midSection.style.maxWidth = '360px';

    const rulesTitle = document.createElement('div');
    rulesTitle.textContent = 'ПРАВИЛА БОЯ:';
    rulesTitle.style.fontWeight = '700';
    rulesTitle.style.color = 'var(--color-text)';
    midSection.appendChild(rulesTitle);

    const rulesList = document.createElement('div');
    rulesList.style.fontSize = '13px';
    rulesList.style.color = 'var(--color-text-muted)';
    rulesList.style.marginTop = '6px';
    rulesList.style.lineHeight = '1.4';
    rulesList.innerHTML = `• 12 рангов оружия (смена за 0.08с)<br/>• Подкат: Спринт + C / Свайп вниз<br/>• БПЛА «Оверлорд» за 3 фрага без смерти`;
    midSection.appendChild(rulesList);
    this.element.appendChild(midSection);

    // 3. Bottom Section: Big Play Button
    const bottomSection = document.createElement('div');
    bottomSection.style.display = 'flex';
    bottomSection.style.justifyContent = 'flex-end';

    const playBtn = new Button({
      text: 'В БОЙ',
      variant: 'primary',
      icon: ICONS.play,
      onClick: () => {
        onStartGame();
      }
    });
    playBtn.element.style.minWidth = '220px';
    bottomSection.appendChild(playBtn.element);

    this.element.appendChild(bottomSection);
  }

  public show(): void {
    this.element.classList.remove('hidden');
  }

  public hide(): void {
    this.element.classList.add('hidden');
  }
}