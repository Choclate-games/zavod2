/**
 * Typed EventBus for decoupled game systems
 */

export interface EventMap {
  'game:start': void;
  'game:pause': boolean;
  'game:resume': void;
  'game:over': { nights: number; kills: number; coins: number; reason: string };
  'game:revive': void;
  'game:victory': { nights: number; coins: number };
  
  'wave:start': { waveIndex: number; title: string; enemyCount: number };
  'wave:clear': { waveIndex: number; rewardCoins: number };
  'wave:dawn': { waveIndex: number };
  
  'entity:hit': { x: number; y: number; damage: number; isCrit: boolean; isBackstab: boolean; targetType: string };
  'entity:damaged': { entityId: string; currentHp: number; maxHp: number; damage: number };
  'entity:death': { entityId: string; type: string; x: number; y: number; droppedCoins: number; droppedHerbs: number };
  
  'stealth:state': { isHidden: boolean; concealment: number; isSpotted: boolean };
  'action:light_torch': { x: number; y: number; id: string };
  'action:draw_salt': { x: number; y: number; radius: number; id: string };
  'action:collect_herb': { x: number; y: number; amount: number };
  'action:dash': { x: number; y: number; dirX: number; dirY: number };
  'action:attack': { x: number; y: number; radius: number; dirX: number; dirY: number };
  
  'upgrade:selected': { cardId: string; name: string };
  'upgrade:rerolled': void;
  
  'player:stats': { hp: number; maxHp: number; salt: number; herbs: number; coins: number; stamina: number };
  'colony:favor': { favor: number; tier: number };
  
  'ui:fct': { text: string; x: number; y: number; color?: string; size?: number };
  'audio:sfx': { name: string; volume?: number; pitch?: number };
}

export type EventCallback<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<keyof EventMap, Set<EventCallback<unknown>>>();

  on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    const castCb = callback as EventCallback<unknown>;
    set.add(castCb);

    return () => {
      set.delete(castCb);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  emit<K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K] extends void ? [] : [EventMap[K]]
  ): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    const payload = args[0];
    for (const callback of set) {
      try {
        callback(payload);
      } catch (err) {
        console.error(`[EventBus] Error in handler for event "${event}":`, err);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
