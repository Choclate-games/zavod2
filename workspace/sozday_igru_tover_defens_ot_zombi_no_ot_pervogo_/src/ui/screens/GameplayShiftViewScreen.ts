import { Meter } from '../components/Meter';
import { IconButton } from '../components/IconButton';
import { ICONS } from '../icons';

export class GameplayShiftViewScreen {
  public element: HTMLDivElement;

  public reactorMeter: Meter;
  public cryoMeter: Meter;
  public scrapDisplay: HTMLSpanElement;
  public waveDisplay: HTMLSpanElement;
  public promptDisplay: HTMLDivElement;
  public actionBtn: HTMLButtonElement;
  public flareBtn: HTMLButtonElement;
  public sprintBtn: HTMLButtonElement;

  constructor(onPause: () => void, onContextAction: () => void, onThrowFlare: () => void, onToggleSprint: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'game-screen hud-layer';

    // 1. Top-Center: Реактор и Волна
    const topCenter = document.createElement('div');
    topCenter.className = 'hud-top-center';

    this.reactorMeter = new Meter('ЦЕЛОСТНОСТЬ РЕАКТОРА');
    this.reactorMeter.element.style.minWidth = '220px';
    topCenter.appendChild(this.reactorMeter.element);

    const waveBox = document.createElement('div');
    waveBox.className = 'panel';
    waveBox.style.padding = 'var(--space-1) var(--space-3)';
    waveBox.style.fontSize = '13px';
    waveBox.innerHTML = `СМЕНА: <strong class="tabular-stat" id="hud-wave-val">ВОЛНА 1/3</strong>`;
    this.waveDisplay = waveBox.querySelector('#hud-wave-val')!;
    topCenter.appendChild(waveBox);
    this.element.appendChild(topCenter);

    // 2. Top-Left: Радар и Пауза
    const topLeft = document.createElement('div');
    topLeft.className = 'hud-top-left';
    topLeft.style.display = 'flex';
    topLeft.style.alignItems = 'center';
    topLeft.style.gap = 'var(--space-3)';

    const pauseBtn = new IconButton({
      iconSvg: ICONS.pause,
      ariaLabel: 'Пауза',
      onClick: onPause,
    });
    topLeft.appendChild(pauseBtn.element);
    this.element.appendChild(topLeft);

    // 3. Center: Прицел и Контекстная подсказка
    const center = document.createElement('div');
    center.className = 'hud-center';

    const crosshair = document.createElement('div');
    crosshair.className = 'crosshair';
    center.appendChild(crosshair);

    this.promptDisplay = document.createElement('div');
    this.promptDisplay.className = 'panel';
    this.promptDisplay.style.marginTop = 'var(--space-4)';
    this.promptDisplay.style.fontSize = '12px';
    this.promptDisplay.style.display = 'none';
    center.appendChild(this.promptDisplay);

    this.element.appendChild(center);

    // 4. Bottom-Left: Скрап и Крио-ранец
    const bottomLeft = document.createElement('div');
    bottomLeft.className = 'hud-bottom-left';

    const scrapPanel = document.createElement('div');
    scrapPanel.className = 'panel';
    scrapPanel.style.display = 'flex';
    scrapPanel.style.alignItems = 'center';
    scrapPanel.style.gap = 'var(--space-2)';
    scrapPanel.innerHTML = `${ICONS.scrap}<span class="tabular-stat" id="hud-scrap-val">150</span> СКРАПА`;
    this.scrapDisplay = scrapPanel.querySelector('#hud-scrap-val')!;
    bottomLeft.appendChild(scrapPanel);

    this.cryoMeter = new Meter('БАК ФРЕОНА РАНЦА');
    this.cryoMeter.setValue(1.0, '100.0 ЕД', 'var(--color-cooling-ready)');
    bottomLeft.appendChild(this.cryoMeter.element);

    this.element.appendChild(bottomLeft);

    // 5. Bottom-Right: Кнопки мобильного/тач действия
    const bottomRight = document.createElement('div');
    bottomRight.className = 'hud-bottom-right';

    // Кнопка фаера
    this.flareBtn = document.createElement('button');
    this.flareBtn.className = 'btn interactive btn-action';
    this.flareBtn.style.minHeight = '64px';
    this.flareBtn.style.minWidth = '140px';
    this.flareBtn.innerHTML = `${ICONS.flare} <span>ФАЕР [Q]</span>`;
    this.flareBtn.addEventListener('click', onThrowFlare);
    bottomRight.appendChild(this.flareBtn);

    // Кнопка спринта
    this.sprintBtn = document.createElement('button');
    this.sprintBtn.className = 'btn interactive';
    this.sprintBtn.style.minHeight = '64px';
    this.sprintBtn.style.minWidth = '140px';
    this.sprintBtn.innerHTML = `${ICONS.play} <span>СПРИНТ</span>`;
    this.sprintBtn.addEventListener('click', onToggleSprint);
    bottomRight.appendChild(this.sprintBtn);

    // Главная контекстная кнопка действия
    this.actionBtn = document.createElement('button');
    this.actionBtn.className = 'btn interactive btn-primary';
    this.actionBtn.style.minHeight = '84px';
    this.actionBtn.style.minWidth = '200px';
    this.actionBtn.innerHTML = `${ICONS.turret} <span>ДЕЙСТВИЕ [E]</span>`;
    this.actionBtn.addEventListener('click', onContextAction);
    bottomRight.appendChild(this.actionBtn);

    this.element.appendChild(bottomRight);
  }

  public setPrompt(text: string | null): void {
    if (text) {
      this.promptDisplay.style.display = 'block';
      this.promptDisplay.textContent = text;
    } else {
      this.promptDisplay.style.display = 'none';
    }
  }

  public setActionLabel(text: string): void {
    const span = this.actionBtn.querySelector('span');
    if (span) span.textContent = text;
  }
}
