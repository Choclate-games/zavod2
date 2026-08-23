/**
 * Typed publish/subscribe EventBus.
 * Ensures strict decoupling between physics, rendering, audio, platform and UI.
 */

export type GameStateType = 'LOADING' | 'MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';

export interface GameEvents {
  'STATE_CHANGED': GameStateType;
  'SPEED_CHANGED': number; // km/h
  'TILT_CHANGED': { angleDeg: number; isCritical: boolean };
  'PROGRESS_CHANGED': { progress01: number; distanceM: number; timeLeftSec: number };
  'GRIP_COOLDOWN_CHANGED': { normalized: number; ready: boolean };
  'SLOSH_CHANGED': { displacement: number };
  'CRASH_OCCURRED': { reason: string; preservedPercent: number };
  'RUN_COMPLETED': { preservedPercent: number; tipsEarned: number; itemsSaved: number; totalItems: number };
  'PLAY_SOUND': string;
  'TRIGGER_VFX': { type: string; x: number; y: number; z: number };
}

type EventCallback<T = any> = (payload: T) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners = new Map<string, Set<EventCallback>>();

  public static get(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  public off<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  public emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error in event handler for ${String(event)}:`, err);
        }
      }
    }
  }
}
