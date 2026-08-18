// src/core/EventBus.ts
export type EventCallback<T = unknown> = (data: T) => void;

export interface GameEvents {
  // Game state events
  'game:stateChanged': { state: 'menu' | 'loading' | 'playing' | 'paused' | 'victory' | 'gameover' | 'shop' };
  'level:loaded': { levelIndex: number; totalGrains: number };
  'level:restarted': { levelIndex: number };
  'level:completed': { levelIndex: number; stars: number; grainsCollected: number; timeElapsed: number };
  'level:failed': { reason: 'caught' | 'spotted' };

  // Stealth & Gameplay events
  'player:move': { x: number; z: number; isMoving: boolean; speed: number };
  'player:boxToggle': { isHiding: boolean };
  'player:grainCollected': { current: number; total: number; grainX: number; grainZ: number };
  'player:revived': { x: number; z: number };
  'player:caught': { dogPosition: { x: number; z: number } };

  // Dog & Alert events
  'dog:alert': { dogId: string; state: 'patrol' | 'suspicious' | 'alert' | 'search'; position: { x: number; z: number } };
  'gate:unlocked': { gatePosition: { x: number; z: number } };

  // UI & Audio
  'ui:notification': { message: string; type?: 'info' | 'warning' | 'success' };
  'audio:playSfx': { name: string; volume?: number; pitch?: number };
  'audio:setBgm': { track: 'stealth' | 'pursuit' | 'menu' | 'none' };
  'audio:volumeChanged': { sfx: number; music: number; muted: boolean };

  // Platform & Economy
  'save:updated': { totalGrains: number; unlockedLevels: number };
  'skin:changed': { chickenSkinId: string; boxSkinId: string };
}

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<keyof GameEvents, Set<EventCallback<any>>> = new Map();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(callback as EventCallback<any>);

    return () => {
      set.delete(callback as EventCallback<any>);
    };
  }

  public off<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback as EventCallback<any>);
    }
  }

  public emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in event listener for ${event}:`, err);
        }
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = EventBus.getInstance();
