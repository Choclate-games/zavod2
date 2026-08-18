import { Game, GameState } from '../core/Game.ts';
import { UpgradeOption } from '../systems/UpgradeManager.ts';
import { eventBus } from '../core/EventBus.ts';

export class UIManager {
  private readonly game: Game;
  private readonly layer: HTMLElement;
  private currentState: GameState = 'boot';

  constructor(game: Game) {
    this.game = game;
    const el = document.getElementById('ui-layer');
    if (!el) throw new Error('ui-layer element not found');
    this.layer = el;
  }

  init(): void {
    this.bindEvents();
  }

  syncState(state: GameState): void {
    this.currentState = state;
    this.render();
  }

  showUpgradeModal(options: UpgradeOption[]): void {
    this.layer.innerHTML = '';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;';

    const title = document.createElement('h2');
    title.textContent = 'Улучшение';
    title.style.color = '#fff';
    overlay.appendChild(title);

    const cards = document.createElement('div');
    cards.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;justify-content:center;';
    for (const opt of options) {
      const card = document.createElement('button');
      card.style.cssText = 'width:180px;min-height:220px;padding:16px;border:2px solid rgba(255,255,255,0.2);border-radius:12px;background:rgba(255,255,255,0.08);color:#fff;cursor:pointer;';
      const name = document.createElement('div');
      name.textContent = opt.name;
      name.style.cssText = 'font-weight:bold;margin-bottom:8px;';
      const rarity = document.createElement('div');
      rarity.textContent = opt.rarity.toUpperCase();
      rarity.style.color = this.rarityColor(opt.rarity);
      rarity.style.marginBottom = '8px';
      const desc = document.createElement('div');
      desc.textContent = opt.description;
      desc.style.fontSize = '14px';
      card.appendChild(name);
      card.appendChild(rarity);
      card.appendChild(desc);
      card.addEventListener('pointerdown', () => eventBus.emit('ui:select-upgrade', opt.id));
      cards.appendChild(card);
    }
    overlay.appendChild(cards);
    this.layer.appendChild(overlay);
  }

  private bindEvents(): void {
    eventBus.on('hud:depth-changed', (depth: number) => {
      this.game.renderer.updateHud(depth, this.game.getRunOre());
    });
    eventBus.on('hud:ore-changed', (ore: number) => {
      this.game.renderer.updateHud(this.game.getDepth(), ore);
    });
    eventBus.on('camera:shake', (amount: number) => {
      this.game.renderer.addScreenShake(amount);
    });
    eventBus.on('platform:pause', (paused: boolean) => {
      if (paused && this.currentState === 'playing') this.game.setState('paused');
    });
    eventBus.on('platform:audio', (enabled: boolean) => {
      this.game.audio.setPlatformMuted(!enabled);
    });
  }

  private render(): void {
    this.layer.innerHTML = '';
    switch (this.currentState) {
      case 'menu':
        this.renderMenu();
        break;
      case 'paused':
        this.renderPause();
        break;
      case 'gameover':
        this.renderGameOver();
        break;
      case 'victory':
        this.renderVictory();
        break;
      case 'playing':
      case 'upgrade':
        break;
    }
  }

  private renderMenu(): void {
    const menu = document.createElement('div');
    menu.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;';

    const title = document.createElement('h1');
    title.textContent = 'Бурильщик Бездны: Рикошет Руды';
    title.style.textAlign = 'center';
    menu.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = `Накоплено руды: ${this.game.getSave().coins}`;
    subtitle.style.fontSize = '18px';
    menu.appendChild(subtitle);

    const start = this.makeButton('Начать спуск', () => eventBus.emit('ui:start-run'));
    menu.appendChild(start);

    this.layer.appendChild(menu);
  }

  private renderPause(): void {
    const menu = document.createElement('div');
    menu.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:rgba(0,0,0,0.7);';
    const title = document.createElement('h2');
    title.textContent = 'Пауза';
    menu.appendChild(title);
    menu.appendChild(this.makeButton('Продолжить', () => eventBus.emit('ui:resume-run')));
    menu.appendChild(this.makeButton('В меню', () => eventBus.emit('ui:quit-run')));
    this.layer.appendChild(menu);
  }

  private renderGameOver(): void {
    const menu = document.createElement('div');
    menu.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:rgba(60,0,0,0.8);';
    const title = document.createElement('h2');
    title.textContent = 'Мех уничтожен';
    menu.appendChild(title);
    menu.appendChild(this.statLine(`Глубина: ${Math.floor(this.game.getDepth())} м`));
    menu.appendChild(this.statLine(`Руда: ${this.game.getRunOre()}`));
    menu.appendChild(this.makeButton('В меню', () => eventBus.emit('ui:quit-run')));
    this.layer.appendChild(menu);
  }

  private renderVictory(): void {
    const menu = document.createElement('div');
    menu.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:rgba(0,60,0,0.8);';
    const title = document.createElement('h2');
    title.textContent = 'Босс повержен!';
    menu.appendChild(title);
    menu.appendChild(this.statLine(`Глубина: ${Math.floor(this.game.getDepth())} м`));
    menu.appendChild(this.statLine(`Руда: ${this.game.getRunOre()}`));
    menu.appendChild(this.makeButton('В меню', () => eventBus.emit('ui:quit-run')));
    this.layer.appendChild(menu);
  }

  private makeButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = 'padding:16px 32px;font-size:18px;border:none;border-radius:8px;background:#00aaff;color:#fff;cursor:pointer;';
    btn.addEventListener('pointerdown', onClick);
    return btn;
  }

  private statLine(text: string): HTMLDivElement {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.fontSize = '18px';
    return div;
  }

  private rarityColor(rarity: string): string {
    switch (rarity) {
      case 'common': return '#aaaaaa';
      case 'rare': return '#00aaff';
      case 'epic': return '#ff55ff';
      default: return '#fff';
    }
  }
}
