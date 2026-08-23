export type GameState = 'MENU' | 'TRACK_SELECT' | 'RACING' | 'PAUSED' | 'RESULTS';

export interface EventMap {
  'GAME_STATE_CHANGED': GameState;
  'SPEED_CHANGED': { speedKmh: number; rpm: number; gear: number };
  'NITRO_CHANGED': { nitroRatio: number; bottles: number; isBoosting: boolean };
  'DRIFT_STATE_CHANGED': { isDrifting: boolean; score: number; multiplier: number; angleDeg: number; isNearMiss: boolean };
  'RACE_PROGRESS_CHANGED': { lap: number; totalLaps: number; position: number; totalRacers: number; progress: number; timeSec: number };
  'RACE_FINISHED': { position: number; timeSec: number; driftScore: number; creditsEarned: number; isWin: boolean; trackId: string };
  'SETTINGS_CHANGED': { soundEnabled: boolean; musicVolume: number; sfxVolume: number };
  'VEHICLE_UPGRADED': { engineLevel: number; turboLevel: number; tiresLevel: number; nitroLevel: number; neonColorIndex: number };
}

type EventKey = keyof EventMap;
type EventHandler<T extends EventKey> = (payload: EventMap[T]) => void;

export class EventBus {
  private listeners: { [K in EventKey]?: Set<EventHandler<K>> } = {};

  on<K extends EventKey>(event: K, handler: EventHandler<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as any;
    }
    this.listeners[event]!.add(handler);
    return () => this.off(event, handler);
  }

  off<K extends EventKey>(event: K, handler: EventHandler<K>): void {
    const set = this.listeners[event];
    if (set) {
      set.delete(handler);
    }
  }

  emit<K extends EventKey>(event: K, payload: EventMap[K]): void {
    const set = this.listeners[event];
    if (set) {
      for (const handler of set) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[EventBus] Error in handler for event "${event}":`, err);
        }
      }
    }
  }
}

export const events = new EventBus();
