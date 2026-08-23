import { Button } from '../components/Button';
import { ICONS } from '../icons';
import { StorageService } from '../../platform/StorageService';
import { EventBus } from '../../core/EventBus';

export class EngineerBunkerArmoryScreen {
  public element: HTMLDivElement;
  private cardsContainer: HTMLDivElement;
  private bpCounter: HTMLSpanElement;

  constructor(onBack: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'game-screen';

    // 1. Шапка
    const headerZone = document.createElement('div');
    headerZone.style.display = 'flex';
    headerZone.style.justifyContent = 'space-between';
    headerZone.style.alignItems = 'center';
    headerZone.style.width = '100%';

    const title = document.createElement('h2');
    title.style.fontFamily = 'var(--font-display)';
    title.style.color = 'var(--color-power-charged)';
    title.textContent = 'МАСТЕРСКАЯ ИНЖЕНЕРА // ТЕХНОЛОГИЧЕСКИЕ ПАТЕНТЫ';
    headerZone.appendChild(title);

    const bpBadge = document.createElement('div');
    bpBadge.className = 'panel';
    bpBadge.innerHTML = `${ICONS.blueprint}<span class="tabular-stat" id="armory-bp-val">0</span> ЧЕРТЕЖЕЙ`;
    this.bpCounter = bpBadge.querySelector('#armory-bp-val')!;
    headerZone.appendChild(bpBadge);

    this.element.appendChild(headerZone);

    // 2. Контент: Карточки патентов
    this.cardsContainer = document.createElement('div');
    this.cardsContainer.style.display = 'grid';
    this.cardsContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(240px, 1fr))';
    this.cardsContainer.style.gap = 'var(--space-4)';
    this.cardsContainer.style.overflowY = 'auto';
    this.cardsContainer.style.maxHeight = '55vh';
    this.cardsContainer.style.padding = 'var(--space-2)';
    this.element.appendChild(this.cardsContainer);

    // 3. Зона действий
    const actionZone = document.createElement('div');
    actionZone.style.display = 'flex';
    actionZone.style.justifyContent = 'flex-end';
    actionZone.style.gap = 'var(--space-4)';

    const backBtn = new Button({
      label: 'ВЕРНУТЬСЯ В ШТАБ',
      onClick: onBack,
    });
    actionZone.appendChild(backBtn.element);

    this.element.appendChild(actionZone);
  }

  public renderCards(): void {
    const data = StorageService.getData();
    if (this.bpCounter) {
      this.bpCounter.textContent = String(data.blueprints);
    }
    this.cardsContainer.innerHTML = '';

    const patentList = [
      { key: 'cryoEfficiency' as const, name: 'Крио-Форсунки (+15% сброс тепла)', cost: 50, lvl: data.patents.cryoEfficiency, icon: ICONS.cryo },
      { key: 'cryoCapacity' as const, name: 'Увеличенный Бак Фреона (+25 ед.)', cost: 60, lvl: data.patents.cryoCapacity, icon: ICONS.cryo },
      { key: 'sprintSpeed' as const, name: 'Сервоприводы Спринта (+10% скорость)', cost: 75, lvl: data.patents.sprintSpeed, icon: ICONS.play },
      { key: 'turretAlloy' as const, name: 'Тугоплавкий Сплав (+20% стойкость к клину)', cost: 90, lvl: data.patents.turretAlloy, icon: ICONS.turret },
      { key: 'rivetPower' as const, name: 'Пневмо-Усилитель Клепальника (+30% ремонт)', cost: 80, lvl: data.patents.rivetPower, icon: ICONS.repair },
    ];

    patentList.forEach((pat) => {
      const card = document.createElement('div');
      card.className = 'panel';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.justifyContent = 'space-between';
      card.style.gap = 'var(--space-3)';

      card.innerHTML = `
        <div>
          <div style="display: flex; align-items: center; gap: var(--space-2); color: var(--color-cooling-ready); font-family: var(--font-display);">
            ${pat.icon} <span>${pat.name}</span>
          </div>
          <div style="margin-top: var(--space-2); font-size: 13px; color: var(--color-text-muted);">
            Текущий уровень: <strong class="tabular-stat" style="color: var(--color-power-charged)">${pat.lvl}</strong> / 5
          </div>
        </div>
      `;

      const buyBtn = new Button({
        label: pat.lvl >= 5 ? 'МАКСИМУМ' : `ИЗУЧИТЬ (${pat.cost} ЧЕРТ.)`,
        className: pat.lvl >= 5 ? 'btn-success' : 'btn-action',
        onClick: () => {
          if (pat.lvl >= 5) return;
          if (data.blueprints >= pat.cost) {
            data.blueprints -= pat.cost;
            data.patents[pat.key] += 1;
            StorageService.save(data);
            this.renderCards();
            EventBus.emit('TOAST_SHOW', { message: `Патент «${pat.name}» успешно изучен!`, type: 'info' });
          } else {
            EventBus.emit('TOAST_SHOW', { message: 'Недостаточно инженерных чертежей!', type: 'warn' });
          }
        },
      });

      card.appendChild(buyBtn.element);
      this.cardsContainer.appendChild(card);
    });
  }
}
