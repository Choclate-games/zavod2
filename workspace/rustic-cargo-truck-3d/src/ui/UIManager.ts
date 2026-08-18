import type { EventBus } from '../core/EventBus';
import type { InputManager } from '../input/InputManager';
import type { AudioManager } from '../audio/AudioManager';
import type { RunResult, SaveData } from '../core/types';

interface HudState { speed: number; cargo: number; totalCargo: number; progress: number; }

export class UIManager {
  private readonly layer = document.createElement('div');
  private readonly hud = document.createElement('div');
  private readonly cargoFill = document.createElement('div');
  private readonly progressFill = document.createElement('div');
  private readonly speedNumber = document.createElement('div');
  private readonly cargoText = document.createElement('div');
  private readonly input: InputManager;
  private readonly audio: AudioManager;
  private state: 'menu' | 'running' | 'paused' | 'result' = 'menu';
  private toastTimer = 0;

  constructor(root: HTMLElement, private readonly events: EventBus, input: InputManager, audio: AudioManager) {
    this.input = input;
    this.audio = audio;
    const shell = document.createElement('div');
    shell.className = 'game-shell';
    this.layer.className = 'ui-layer';
    this.hud.className = 'hud hidden';
    this.layer.append(this.hud);
    shell.append(this.layer, input.touchLayer);
    root.append(shell);
    document.addEventListener('contextmenu', this.preventGesture, true);
    document.addEventListener('selectstart', this.preventGesture, true);
    document.addEventListener('dragstart', this.preventGesture, true);
  }

  showMenu(save: SaveData): void {
    this.state = 'menu';
    this.input.setEnabled(false);
    this.input.touchLayer.classList.remove('visible');
    this.clearScreen();
    const screen = this.createScreen();
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = '<div class="eyebrow">Сезон 01 · просёлок</div><h1>Лесной Рейс</h1><p class="subtitle">Довези ценный груз из деревни на лесопилку. Не спеши на ухабах: каждое бревно превращается в монеты.</p>';
    const start = this.button('Начать рейс', true);
    start.addEventListener('click', () => this.events.emit('game:start', undefined));
    const meta = document.createElement('div');
    meta.className = 'menu-meta';
    meta.innerHTML = `<div><strong>${save.coins}</strong>монет</div><div><strong>${save.bestDelivery}/8</strong>лучший груз</div><div><strong>3 мин</strong>рейс</div>`;
    panel.append(start, meta);
    screen.append(panel);
    this.layer.append(screen);
  }

  showHud(): void {
    this.state = 'running';
    this.clearScreen();
    this.hud.classList.remove('hidden');
    this.hud.innerHTML = '';
    const top = document.createElement('div');
    top.className = 'hud-top';
    const cargoCard = document.createElement('div');
    cargoCard.className = 'hud-card cargo-wrap';
    cargoCard.innerHTML = '<div class="hud-label">Целостность груза</div>';
    this.cargoText.className = 'hud-value';
    this.cargoText.textContent = '8 / 8';
    this.cargoFill.className = 'bar-fill';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.append(this.cargoFill);
    cargoCard.append(this.cargoText, bar);
    const distance = document.createElement('div');
    distance.className = 'hud-card';
    distance.innerHTML = '<div class="hud-label">Маршрут</div><div class="hud-value">Деревня → Пилорама</div>';
    const pause = this.button('Ⅱ', false);
    pause.className = 'pause-btn';
    pause.addEventListener('click', () => this.events.emit('game:pause', { paused: true }));
    top.append(cargoCard, distance, pause);
    this.hud.append(top);
    const speed = document.createElement('div');
    speed.className = 'speedometer';
    this.speedNumber.className = 'speed-number';
    this.speedNumber.textContent = '0';
    speed.append(this.speedNumber);
    const unit = document.createElement('div');
    unit.className = 'speed-unit';
    unit.textContent = 'КМ/Ч';
    speed.append(unit);
    const track = document.createElement('div');
    track.className = 'progress-track';
    this.progressFill.className = 'progress-fill';
    track.append(this.progressFill);
    speed.append(track);
    this.hud.append(speed);
    this.input.setEnabled(true);
    this.input.touchLayer.classList.toggle('visible', this.touchEnabled());
  }

  setPaused(paused: boolean): void {
    if (this.state === 'result' || this.state === 'menu') return;
    this.state = paused ? 'paused' : 'running';
    this.input.touchLayer.classList.toggle('visible', !paused && this.touchEnabled());
    if (paused) {
      const screen = this.createScreen();
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML = '<div class="eyebrow">Передышка на обочине</div><h1>Пауза</h1><p class="subtitle">Груз никуда не денется. Вернись в рейс, когда будешь готов.</p>';
      const resume = this.button('Продолжить', true);
      resume.addEventListener('click', () => this.events.emit('game:pause', { paused: false }));
      panel.append(resume);
      screen.append(panel);
      this.layer.append(screen);
    } else {
      this.removeScreen();
    }
  }

  updateHud(state: HudState): void {
    this.speedNumber.textContent = Math.round(state.speed).toString();
    this.cargoText.textContent = `${state.cargo} / ${state.totalCargo}`;
    const ratio = state.cargo / Math.max(1, state.totalCargo);
    this.cargoFill.style.width = `${ratio * 100}%`;
    this.cargoFill.style.background = ratio > .6 ? '#76bd6b' : ratio > .3 ? '#e8ad61' : '#d8574b';
    this.progressFill.style.width = `${Math.min(100, state.progress * 100)}%`;
  }

  showResult(result: RunResult, save: SaveData): void {
    this.state = 'result';
    this.hud.classList.add('hidden');
    this.input.setEnabled(false);
    this.input.touchLayer.classList.remove('visible');
    this.audio.playFinish();
    this.clearScreen();
    const screen = this.createScreen();
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `<div class="eyebrow">Рейс завершён</div><h1>${result.delivered === result.total ? 'Идеальная доставка' : 'Груз доставлен'}</h1><p class="subtitle">Лесопилка приняла твой груз. Осторожный водитель получает больше за следующий апгрейд.</p>`;
    const stats = document.createElement('div');
    stats.className = 'result-stats';
    stats.innerHTML = `<div class="stat"><strong>${result.delivered}/${result.total}</strong><span>груз</span></div><div class="stat"><strong>+${result.coins}</strong><span>монет</span></div><div class="stat"><strong>${Math.round(result.duration)}с</strong><span>в пути</span></div>`;
    const replay = this.button('Новый рейс', true);
    replay.addEventListener('click', () => this.events.emit('game:start', undefined));
    panel.append(stats, replay);
    if (save.coins >= 80 && save.upgrades.engine < 3) {
      const upgrade = this.button(`Усилить мотор · 80 монет`, false);
      upgrade.style.marginTop = '12px';
      upgrade.addEventListener('click', () => {
        if (save.coins < 80) return;
        save.coins -= 80;
        save.upgrades.engine += 1;
        this.events.emit('game:save', undefined);
        upgrade.textContent = 'Мотор усилен';
        upgrade.setAttribute('disabled', 'true');
      });
      panel.append(upgrade);
    }
    screen.append(panel);
    this.layer.append(screen);
  }

  toast(text: string, tone: 'good' | 'warn' | 'bad'): void {
    const node = document.createElement('div');
    node.className = `toast ${tone}`;
    node.textContent = text;
    this.layer.append(node);
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => node.remove(), 1800);
  }

  private createScreen(): HTMLDivElement {
    const screen = document.createElement('div');
    screen.className = 'screen';
    return screen;
  }

  private button(text: string, primary: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = primary ? 'primary-btn' : 'ghost-btn';
    button.textContent = text;
    return button;
  }

  private clearScreen(): void {
    this.removeScreen();
    this.hud.classList.add('hidden');
  }

  private removeScreen(): void {
    this.layer.querySelector('.screen')?.remove();
  }

  private touchEnabled(): boolean {
    const forced = new URLSearchParams(window.location.search).get('touch');
    if (forced === '1') return true;
    if (forced === '0') return false;
    return navigator.maxTouchPoints > 0 || window.innerWidth < 900;
  }

  private readonly preventGesture = (event: Event): void => {
    event.preventDefault();
  };
}
