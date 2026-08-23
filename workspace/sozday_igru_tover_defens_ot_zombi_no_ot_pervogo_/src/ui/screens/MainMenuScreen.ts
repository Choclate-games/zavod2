import { Button } from '../components/Button';
import { ICONS } from '../icons';
import { StorageService } from '../../platform/StorageService';

export class MainMenuScreen {
  public element: HTMLDivElement;

  constructor(onStartShift: () => void, onOpenArmory: () => void, onOpenSettings: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'game-screen';

    // 1. Шапка экрана
    const headerZone = document.createElement('div');
    headerZone.style.display = 'flex';
    headerZone.style.justifyContent = 'space-between';
    headerZone.style.alignItems = 'flex-start';
    headerZone.style.width = '100%';

    const titleBox = document.createElement('div');
    const title = document.createElement('h1');
    title.style.fontFamily = 'var(--font-display)';
    title.style.fontSize = 'clamp(24px, calc(32px * var(--ui-scale)), 44px)';
    title.style.color = 'var(--color-power-charged)';
    title.style.textShadow = '0 2px 10px var(--color-overlay-shadow)';
    title.textContent = 'БАСТИОН 13: САПЁР ПЕРИМЕТРА';

    const subtitle = document.createElement('div');
    subtitle.style.fontSize = '13px';
    subtitle.style.color = 'var(--color-text-muted)';
    subtitle.textContent = 'ТАКТИЧЕСКИЙ FPS // THERMAL DEFENSE HARBOR';

    titleBox.appendChild(title);
    titleBox.appendChild(subtitle);
    headerZone.appendChild(titleBox);

    const bpBadge = document.createElement('div');
    bpBadge.className = 'panel';
    bpBadge.style.display = 'flex';
    bpBadge.style.alignItems = 'center';
    bpBadge.style.gap = 'var(--space-2)';
    bpBadge.innerHTML = `${ICONS.blueprint}<span class="tabular-stat" id="menu-bp-count">0</span> ЧЕРТЕЖЕЙ`;
    headerZone.appendChild(bpBadge);

    this.element.appendChild(headerZone);

    // 2. Контентная сводка (прозрачная для живой 3D сцены)
    const contentZone = document.createElement('div');
    contentZone.style.display = 'flex';
    contentZone.style.gap = 'var(--space-4)';
    contentZone.style.alignItems = 'center';
    contentZone.style.maxWidth = '600px';

    const summaryCard = document.createElement('div');
    summaryCard.className = 'panel';
    summaryCard.innerHTML = `
      <div class="panel-header">СВОДКА ГАРНИЗОНА // СЕКТОР 13</div>
      <div style="font-size: 13px; color: var(--color-text-main); line-height: 1.5;">
        Ледяной буран усиливается. По данным тепловизоров, приближается плотная волна мутантов.
        Проверьте систему охлаждения пулеметов, доставьте Overcharge-батареи и держите бруствер!
      </div>
    `;
    contentZone.appendChild(summaryCard);
    this.element.appendChild(contentZone);

    // 3. Зона действий
    const actionZone = document.createElement('div');
    actionZone.style.display = 'flex';
    actionZone.style.flexWrap = 'wrap';
    actionZone.style.alignItems = 'center';
    actionZone.style.gap = 'calc(var(--space-4) * var(--ui-scale))';

    const playBtn = new Button({
      label: 'ЗАСТУПИТЬ НА СМЕНУ',
      isPrimary: true,
      icon: ICONS.play,
      onClick: onStartShift,
    });
    actionZone.appendChild(playBtn.element);

    const armoryBtn = new Button({
      label: 'АРСЕНАЛ И ПАТЕНТЫ',
      icon: ICONS.turret,
      onClick: onOpenArmory,
    });
    actionZone.appendChild(armoryBtn.element);

    const settingsBtn = new Button({
      label: 'ФОРМУЛЯР НАСТРОЕК',
      icon: ICONS.settings,
      onClick: onOpenSettings,
    });
    actionZone.appendChild(settingsBtn.element);

    this.element.appendChild(actionZone);
  }

  public updateData(): void {
    const data = StorageService.getData();
    const bpSpan = this.element.querySelector('#menu-bp-count');
    if (bpSpan) {
      bpSpan.textContent = String(data.blueprints);
    }
  }
}
