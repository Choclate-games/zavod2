export type EventCallback<T = any> = (payload: T) => void;

export interface GameEvents {
  "state:changed": { from: string; to: string };
  "player:hp_changed": { hp: number; maxHp: number };
  "player:energy_changed": { energy: number; maxEnergy: number };
  "player:noise_changed": { noiseLevel: number; alertLevel: number };
  "player:hurt": { damage: number; source: string };
  "player:died": { reason: string };
  "player:revived": void;
  "player:fell_into_abyss": void;
  "sonar:pulse": { origin: { x: number; y: number; z: number }; range: number; isPlayer: boolean };
  "decoy:thrown": { position: { x: number; y: number; z: number } };
  "decoy:ping": { position: { x: number; y: number; z: number } };
  "crystal:collected": { amount: number; totalInRun: number };
  "crystal:shattered": { position: { x: number; y: number; z: number }; value: number };
  "stalker:alert": { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } };
  "stalker:stunned": { position: { x: number; y: number; z: number }; duration: number };
  "station:activated": { floorIndex: number };
  "floor:completed": { floorIndex: number };
  "expedition:victory": { crystals: number; floorsCleared: number };
  "upgrade:chosen": { upgradeId: string };
  "ui:toast": { message: string; type: "info" | "warning" | "success" | "danger" };
}

export class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  public on<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);

    return () => this.off(event, callback);
  }

  public off<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error in event listener for '${event}':`, err);
        }
      });
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}
