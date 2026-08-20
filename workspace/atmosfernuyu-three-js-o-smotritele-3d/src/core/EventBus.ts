/**
 * Typed publish/subscribe event bus. Systems communicate only through this,
 * keeping the architecture decoupled (Core Engine Layer).
 */

export interface GameEventMap {
  'game:state': { state: string; prev: string };
  'player:damage': { amount: number; source: string };
  'player:air': { air: number; max: number };
  'player:energy': { energy: number; max: number };
  'player:hull': { hull: number; max: number };
  'player:depth': { depth: number };
  'player:spotlight': { tier: number };
  'sample:collect': { value: number; total: number };
  'favor:change': { favor: number; max: number };
  'wave:start': { wave: number };
  'wave:clear': { wave: number };
  'enemy:killed': { remaining: number };
  'entity:hit': { target: '#player' | '#enemy'; damage: number; crit: boolean };
  'combo:strike': { count: number };
  'pulse:fired': { heavy: boolean };
  'run:over': { victory: boolean; depth: number; samples: number; wave: number };
  'upgrade:applied': { id: string };
  'ui:toast': { text: string };
  'first:action': undefined;
  'first:reward': undefined;
  'game:ready': undefined;
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private readonly handlers = new Map<keyof GameEventMap, Set<Handler<unknown>>>();

  on<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => this.off(event, handler);
  }

  off<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        (handler as Handler<GameEventMap[K]>)(payload);
      } catch (err) {
        console.error(`[EventBus] handler error for "${String(event)}":`, err);
      }
    }
  }
}

/** Shared singleton bus for the whole game. */
export const bus = new EventBus();
