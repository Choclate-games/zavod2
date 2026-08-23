export type GameState = 'MENU' | 'BRIEFING' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'DEFEAT';
export type BreathState = 'NORMAL' | 'HOLDING' | 'RECOVERY' | 'HYPERVENTILATION';
export type AlarmState = 'CLEAR' | 'SUSPICIOUS' | 'PANIC' | 'TRIGGERED';

export interface ShotFiredData {
  originX: number;
  originY: number;
  originZ: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  isMasked: boolean;
}

export interface TargetHitData {
  targetId: string;
  isHeadshot: boolean;
  isAccident: boolean;
  damage: number;
}

export interface HazardTriggeredData {
  hazardId: string;
  hazardType: string;
  posX: number;
  posY: number;
  posZ: number;
}

export type EventCallback<T = any> = (payload: T) => void;

class EventBusClass {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  public on<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  public off(event: string, callback: EventCallback): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<T = any>(event: string, payload?: T): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of Array.from(set)) {
        cb(payload);
      }
    }
  }
}

export const EventBus = new EventBusClass();
