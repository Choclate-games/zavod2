import { MAX_TIER, upgradeCost } from '../game/config';
import type { EventBus } from '../core/EventBus';
import type { GameSnapshot, SlotIndex, TurretTier } from '../game/types';
import type { InputManager } from './InputManager';
import { TouchControls } from './TouchControls';

export interface UIActions {
  buyTurret: () => void;
  moveOrMerge: (from: SlotIndex, to: SlotIndex) => void;
  sellTurret: (index: SlotIndex) => void;
  upgrade: (type: 'damage' | 'income' | 'crateSpeed' | 'critChance') => void;
  rewardedGift: () => void;
  frenzy: () => void;
  togglePause: () => void;
  revive: () => void;
  focusEnemyAt: (x: number, y: number) => void;
}

export class UIManager {
  readonly root: HTMLDivElement;
  readonly canvasHost: HTMLDivElement;
  private readonly uiRoot: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly modalLayer: HTMLDivElement;
  private readonly coins: HTMLDivElement;
  private readonly wave: HTMLDivElement;
  private readonly hp: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly touch: TouchControls;
  private snapshot: GameSnapshot | null = null;
  private dragIndex: number | null = null;

  constructor(app: HTMLElement, input: InputManager, private readonly bus: EventBus, private readonly actions: UIActions) {
    this.root = document.createElement('div');
    this.root.className = 'game-root';
    this.canvasHost = document.createElement('div');
    this.canvasHost.className = 'canvas-host';
    this.uiRoot = document.createElement('div');
    this.uiRoot.className = 'ui-root';
    this.touch = new TouchControls(input);

    this.coins = document.createElement('div');
    this.wave = document.createElement('div');
    this.hp = document.createElement('div');
    this.fill = document.createElement('div');
    this.grid = document.createElement('div');
    this.modalLayer = document.createElement('div');
    this.modalLayer.className = 'modal-layer';

    this.buildHud();
    this.root.append(this.canvasHost, this.uiRoot, this.touch.element, this.modalLayer);
    app.replaceChildren(this.root);

    this.canvasHost.addEventListener('pointerdown', (event) => {
      if (event.clientY < window.innerHeight * 0.58) this.actions.focusEnemyAt(event.clientX, event.clientY);
    });

    this.bus.on('ui:snapshot', (snapshot) => this.render(snapshot));
    this.bus.on('state:changed', ({ state }) => {
      this.touch.setVisible(state === 'playing');
      if (state === 'defeat') this.showDefeat();
    });
  }

  showOfflineReward(coins: number, onCollect: () => void, onDouble: () => void, canDouble: boolean): void {
    if (coins <= 0) return;
    const buttons = canDouble
      ? `<button class="action-button primary" data-action="double">x2 за видео</button>`
      : '';
    this.modalLayer.className = 'modal-layer visible';
    this.modalLayer.innerHTML = `<div class="modal"><h2>С возвращением!</h2><p>База накопила ${coins} монет, пока вы отсутствовали.</p><div class="actions"><button class="action-button primary" data-action="collect">Забрать</button>${buttons}</div></div>`;
    this.modalLayer.querySelector('[data-action="collect"]')?.addEventListener('click', () => {
      this.closeModal();
      onCollect();
    });
    this.modalLayer.querySelector('[data-action="double"]')?.addEventListener('click', () => {
      this.closeModal();
      onDouble();
    });
  }

  closeModal(): void {
    this.modalLayer.className = 'modal-layer';
    this.modalLayer.replaceChildren();
  }

  private buildHud(): void {
    const top = document.createElement('div');
    top.className = 'top-bar';
    top.innerHTML = '<div class="title">Слияние Турелей 3D: Оборона Базы</div>';
    this.coins.className = 'pill';
    this.wave.className = 'pill';
    this.hp.className = 'pill';
    const progress = document.createElement('div');
    progress.className = 'wave-progress';
    this.fill.className = 'wave-fill';
    progress.append(this.fill);
    top.append(this.coins, this.wave, this.hp, progress);

    const bottom = document.createElement('div');
    bottom.className = 'bottom-panel';
    this.grid.className = 'grid';
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.innerHTML = [
      '<button class="action-button primary" data-action="buy">Купить</button>',
      '<button class="action-button" data-action="damage">Урон</button>',
      '<button class="action-button" data-action="income">Доход</button>',
      '<button class="action-button warn" data-action="gift">Подарок</button>'
    ].join('');
    bottom.append(this.grid, actions);
    this.uiRoot.append(top, document.createElement('div'), bottom);

    actions.querySelector('[data-action="buy"]')?.addEventListener('click', () => this.actions.buyTurret());
    actions.querySelector('[data-action="damage"]')?.addEventListener('click', () => this.actions.upgrade('damage'));
    actions.querySelector('[data-action="income"]')?.addEventListener('click', () => this.actions.upgrade('income'));
    actions.querySelector('[data-action="gift"]')?.addEventListener('click', () => this.actions.rewardedGift());
  }

  private render(snapshot: GameSnapshot): void {
    this.snapshot = snapshot;
    this.coins.textContent = `${snapshot.coins} мон.`;
    this.wave.textContent = `Волна ${snapshot.wave}`;
    this.hp.textContent = `${snapshot.baseHp} HP`;
    this.fill.style.width = `${Math.max(0, Math.min(100, (snapshot.baseHp / 100) * 100))}%`;
    this.renderGrid(snapshot.slots);
  }

  private renderGrid(slots: readonly (TurretTier | null)[]): void {
    this.grid.replaceChildren();
    for (let i = 0; i < slots.length; i += 1) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.index = String(i);
      const tier = slots[i];
      if (tier !== null) {
        const token = document.createElement('div');
        token.className = 'turret-token';
        token.textContent = String(tier);
        token.style.background = `linear-gradient(135deg, hsl(${tier * 21}, 78%, 55%), hsl(${tier * 21 + 55}, 84%, 42%))`;
        slot.append(token);
      }
      slot.addEventListener('pointerdown', (event) => this.beginDrag(event, i));
      slot.addEventListener('pointerup', (event) => this.endDrag(event, i));
      slot.addEventListener('pointercancel', () => this.cancelDrag());
      slot.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        this.actions.sellTurret(i);
      });
      this.grid.append(slot);
    }
  }

  private beginDrag(event: PointerEvent, index: number): void {
    const snapshot = this.snapshot;
    if (!snapshot || snapshot.slots[index] === null) return;
    event.preventDefault();
    this.dragIndex = index;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    for (const child of Array.from(this.grid.children)) {
      const slot = child as HTMLElement;
      const target = Number(slot.dataset.index ?? -1);
      const sourceTier = snapshot.slots[index];
      const compatible = sourceTier !== null && snapshot.slots[target] === sourceTier && sourceTier !== MAX_TIER;
      slot.classList.toggle('compatible', compatible);
      slot.classList.toggle('blocked', snapshot.slots[target] !== null && !compatible && target !== index);
    }
  }

  private endDrag(event: PointerEvent, index: number): void {
    event.preventDefault();
    if (this.dragIndex !== null) this.actions.moveOrMerge(this.dragIndex, index);
    this.cancelDrag();
  }

  private cancelDrag(): void {
    this.dragIndex = null;
    for (const child of Array.from(this.grid.children)) child.className = 'slot';
  }

  private showDefeat(): void {
    this.modalLayer.className = 'modal-layer visible';
    this.modalLayer.innerHTML = '<div class="modal"><h2>База пробита</h2><p>Восстановите щит и повторите волну без потери турелей.</p><div class="actions"><button class="action-button primary" data-action="revive">Второе дыхание</button></div></div>';
    this.modalLayer.querySelector('[data-action="revive"]')?.addEventListener('click', () => {
      this.closeModal();
      this.actions.revive();
    });
  }
}
