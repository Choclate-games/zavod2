export type EventCallback<T = unknown> = (data: T) => void;

export interface GameEvents {
  'game:start': void;
  'game:pause': boolean;
  'game:over': { won: boolean; wave: number; kills: number; gold: number };
  'player:damaged': { currentHp: number; maxHp: number; damage: number };
  'player:died': void;
  'player:revived': void;
  'player:stamina_changed': { current: number; max: number };
  'enemy:spawned': { id: number; type: string };
  'enemy:hit': { enemyId: number; damage: number; isCrit: boolean; shearedArmor: boolean; position: { x: number; y: number; z: number } };
  'enemy:killed': { enemyId: number; type: string; position: { x: number; y: number; z: number }; gold: number };
  'combat:parry': { position: { x: number; y: number; z: number } };
  'combat:knockdown': { enemyId: number; impulse: number };
  'wave:started': { wave: number; totalEnemies: number };
  'wave:enemy_killed': { remaining: number; total: number };
  'wave:cleared': { wave: number };
  'favor:changed': { current: number; max: number; level: number };
  'favor:gift_dropped': { type: string; position: { x: number; y: number; z: number } };
  'upgrade:selected': { cardId: string };
  'gold:changed': { current: number; delta: number };
  'camera:shake': { intensity: number; duration: number };
  'audio:play_sfx': { sound: string; pitchVariation?: number; volume?: number };
}

export class EventBus {
  private listeners: Map<keyof GameEvents, Set<EventCallback<any>>> = new Map();

  public on<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  public off<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(callback);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in event listener for ${String(event)}:`, err);
        }
      });
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const globalEventBus = new EventBus();
