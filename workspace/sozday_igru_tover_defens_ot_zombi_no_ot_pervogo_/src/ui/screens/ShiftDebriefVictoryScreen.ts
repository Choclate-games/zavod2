import { Button } from '../components/Button';
import { ICONS } from '../icons';
import { PlaygamaService } from '../../platform/PlaygamaService';
import { StorageService } from '../../platform/StorageService';
import { EventBus } from '../../core/EventBus';

export class ShiftDebriefVictoryScreen {
  public element: HTMLDivElement;
  private blueprintsEarned = 150;
  private isDoubled = false;
  private bpValueSpan: HTMLSpanElement;
  private doubleBtn: Button;

  constructor(onToBunker: () => void) {
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
    header.style.color = 'var(--color-reactor-health)';
    header.textContent = 'СМЕНА ВЫПОЛНЕНА // ПЕРИМЕТР УДЕРЖАН!';
    card.appendChild(header);

    const statsBlock = document.createElement('div');
    statsBlock.style.fontSize = '14px';
    statsBlock.style.lineHeight = '1.8';
    statsBlock.innerHTML = `
      <div>Все 3 волны мутантов успешно отражены.</div>
      <div>Целостность реактора: <strong style="color: var(--color-reactor-health)">100%</strong></div>
      <div style="font-size: 16px; margin-top: var(--space-2);">
        Жалование: <strong class="tabular-stat" style="color: var(--color-power-charged); font-size: 20px;" id="victory-bp-val">150</strong> ЧЕРТЕЖЕЙ
      </div>
    `;
    this.bpValueSpan = statsBlock.querySelector('#victory-bp-val')!;
    card.appendChild(statsBlock);

    // Кнопка удвоения наград за Rewarded Video
    this.doubleBtn = new Button({
      label: 'УДВОИТЬ ЧЕРТЕЖИ (+100%)',
      isPrimary: true,
      icon: ICONS.video,
      onClick: () => {
        if (this.isDoubled) return;
        PlaygamaService.showRewarded(() => {
          this.isDoubled = true;
          this.blueprintsEarned *= 2;
          this.bpValueSpan.textContent = String(this.blueprintsEarned);
          this.doubleBtn.element.style.display = 'none';
          EventBus.emit('TOAST_SHOW', { message: 'Награда удвоена: +300 чертежей!', type: 'info' });
        });
      },
    });
    card.appendChild(this.doubleBtn.element);

    const exitBtn = new Button({
      label: 'ПРИНЯТЬ ЖАЛОВАНИЕ И В БУНКЕР',
      className: 'btn-action',
      onClick: () => {
        const data = StorageService.getData();
        data.blueprints += this.blueprintsEarned;
        data.totalKills += 150;
        StorageService.save(data);
        PlaygamaService.showInterstitial(() => {
          onToBunker();
        });
      },
    });
    card.appendChild(exitBtn.element);

    this.element.appendChild(card);
  }

  public reset(earned: number): void {
    this.blueprintsEarned = earned;
    this.isDoubled = false;
    this.bpValueSpan.textContent = String(earned);
    this.doubleBtn.element.style.display = 'inline-flex';
  }
}
