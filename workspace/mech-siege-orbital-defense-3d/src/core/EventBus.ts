// src/core/EventBus.ts
// Typed publish/subscribe event dispatcher for decoupled architecture

export type EventCallback<T = any> = (data: T) => void;

export interface GameEvents {
  // Input & Player
  'input:move': { x: number; y: number };
  'input:attack': boolean;
  'input:dash': void;
  'input:shield': void;
  'input:build': string | null;

  // Combat & Entities
  'entity:hit': { target: string; damage: number; isCrit: boolean; x: number; y: number; z: number };
  'player:damaged': { currentHp: number; maxHp: number; currentShield: number; maxShield: number };
  'player:died': void;
  'player:revived': void;
  'player:dash': { x: number; z: number };

  // Base Core
  'base:damaged': { currentHp: number; maxHp: number };
  'base:destroyed': void;

  // Enemies & Waves
  'enemy:spawned': { id: number; type: string };
  'enemy:killed': { id: number; type: string; x: number; y: number; z: number; scrapValue: number };
  'wave:started': { waveNumber: number; totalWaves: number; enemyCount: number };
  'wave:cleared': { waveNumber: number };
  'boss:spawned': { name: string; hp: number };
  'boss:defeated': void;

  // Build System
  'turret:placed': { type: string; x: number; z: number; cost: number };
  'turret:fired': { type: string; x: number; z: number; targetX: number; targetZ: number };
  'turret:destroyed': { x: number; z: number };

  // Economy & Progression
  'scrap:collected': { amount: number; total: number };
  'upgrade:selected': { id: string; name: string };
  'upgrade:open_modal': void;
  'upgrade:close_modal': void;

  // Game Lifecycle & State
  'game:state_changed': { state: string };
  'game:pause': boolean;
  'game:over': { victory: boolean; wave: number; kills: number; scrap: number };
  'game:restart': void;

  // Sensory Feedback
  'fx:screenshake': { intensity: number; duration: number };
  'fx:hitstop': { durationMs: number };
  'audio:play': { sfx: string; volume?: number };
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

  public on<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public off<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  public emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[EventBus] Error in handler for event "${String(event)}":`, e);
        }
      });
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = EventBus.getInstance();
