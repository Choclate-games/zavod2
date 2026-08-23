/**
 * Центральная строго типизированная шина событий.
 */

export type GameEventMap = {
  'GAME_STATE_CHANGED': 'MENU' | 'ARMORY' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'DEFEAT';
  'MUTE_STATE_CHANGED': boolean;
  'PAUSE_TRIGGERED': boolean;
  'TURRET_MOUNTED': { slotId: number; level: number; cost: number };
  'TURRET_UPGRADED': { slotId: number; level: number };
  'HEAT_LEVEL_CHANGED': { slotId: number; heat: number; jammed: boolean };
  'REACTOR_HP_CHANGED': { hp: number; maxHp: number };
  'SCRAP_CHANGED': number;
  'CRYO_LEVEL_CHANGED': number;
  'WAVE_PROGRESS': { wave: number; totalWaves: number; remainingEnemies: number; totalEnemies: number };
  'ENEMY_KILLED': { type: string; scrapReward: number; position: { x: number; y: number; z: number } };
  'BARREL_DETONATED': { type: 'cryo' | 'diesel'; position: { x: number; y: number; z: number } };
  'OVERCHARGE_CELL_PICKED': void;
  'OVERCHARGE_CELL_INSERTED': { slotId: number };
  'TOAST_SHOW': { message: string; type?: 'info' | 'warn' | 'error' };
};

type EventKey = keyof GameEventMap;
type EventHandler<K extends EventKey> = (payload: GameEventMap[K]) => void;

class EventBusService {
  private handlers: { [K in EventKey]?: Array<EventHandler<K>> } = {};

  public on<K extends EventKey>(event: K, handler: EventHandler<K>): void {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event]!.push(handler);
  }

  public off<K extends EventKey>(event: K, handler: EventHandler<K>): void {
    const list = this.handlers[event];
    if (!list) return;
    const index = list.indexOf(handler);
    if (index !== -1) {
      list.splice(index, 1);
    }
  }

  public emit<K extends EventKey>(event: K, payload: GameEventMap[K]): void {
    const list = this.handlers[event];
    if (!list || list.length === 0) return;
    for (let i = 0; i < list.length; i++) {
      list[i](payload);
    }
  }
}

export const EventBus = new EventBusService();
