import { Button } from '../components/Button';
import { ICONS } from '../icons';
import { PlaygamaService } from '../../platform/PlaygamaService';
import { EventBus } from '../../core/EventBus';

export class ReactorBreachedDefeatScreen {
  public element: HTMLDivElement;
  private reviveUsed = false;
  private reviveBtn: Button;

  constructor(onRevive: () => void, onToBunker: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'game-screen interactive';

    const card = document.createElement('div');
    card.className = 'panel';
    card.style.maxWidth = '540px';
    card.style.margin = 'auto';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = 'var(--space-4)';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.style.color = 'var(--color-danger-overheat)';
    header.textContent = 'ТРЕВОГА: РЕАКТОР УНИЧТОЖЕН // ОБОРОНА СМЯТА';
    card.appendChild(header);

    const desc = document.createElement('div');
    desc.style.fontSize = '14px';
    desc.style.lineHeight = '1.6';
    desc.textContent = 'Мутанты пробили защитный бруствер и разрушили охладительный контур активной зоны. Бастион-13 пал.';
    card.appendChild(desc);

    // Кнопка «Аварийная перезагрузка реактора (Второй шанс)»
    this.reviveBtn = new Button({
      label: 'АВАРИЙНАЯ ПЕРЕЗАГРУЗКА (35% HP + СБРОС ТЕПЛА)',
      isPrimary: true,
      icon: ICONS.video,
      onClick: () => {
        if (this.reviveUsed) return;
        PlaygamaService.showRewarded(() => {
          this.reviveUsed = true;
          this.reviveBtn.element.style.display = 'none';
          EventBus.emit('TOAST_SHOW', { message: 'Реактор аварийно перезагружен! Орудия охлаждены!', type: 'info' });
          onRevive();
        });
      },
    });
    card.appendChild(this.reviveBtn.element);

    const retreatBtn = new Button({
      label: 'ОТСТУПИТЬ В БУНКЕР',
      className: 'btn-action',
      onClick: () => {
        PlaygamaService.showInterstitial(() => {
          onToBunker();
        });
      },
    });
    card.appendChild(retreatBtn.element);

    this.element.appendChild(card);
  }

  public reset(): void {
    this.reviveUsed = false;
    this.reviveBtn.element.style.display = 'inline-flex';
  }
}
