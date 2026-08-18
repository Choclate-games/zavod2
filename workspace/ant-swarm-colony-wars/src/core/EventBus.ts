export type EventCallback<T = unknown> = (payload: T) => void;

export interface GameEvents {
  // Game lifecycle
  'game:state_changed': { state: string };
  'level:start': { levelNumber: number };
  'level:victory': { levelNumber: number; biomassEarned: number };
  'level:defeat': { levelNumber: number };
  'level:restart': { levelNumber: number };

  // Swarm & Castes
  'caste:selected': { caste: number }; // 0: Worker, 1: Soldier, 2: Bomber
  'swarm:count_changed': { playerCount: number; enemyCount: number; maxCount: number };
  'swarm:disperse': void;
  'swarm:sphere': { active: boolean };

  // Biomass & Upgrades
  'biomass:collected': { amount: number; x: number; y: number };
  'biomass:changed': { total: number };
  'upgrade:purchased': { upgradeKey: string; level: number };

  // Entities & Interactions
  'nest:captured': { nestId: number; team: number; x: number; y: number };
  'nest:damaged': { nestId: number; hp: number; maxHp: number; x: number; y: number };
  'nest:spawn': { nestId: number; team: number; count: number };
  'structure:formed': { type: 'bridge' | 'sphere'; x1: number; y1: number; x2: number; y2: number };
  'structure:broken': { type: 'bridge' | 'sphere' };
  'obstacle:destroyed': { obstacleId: number; x: number; y: number };

  // Visuals & Feedback
  'vfx:explosion': { x: number; y: number; radius: number; color?: number };
  'vfx:acid': { x: number; y: number; radius: number };
  'vfx:sparks': { x: number; y: number; count: number; color?: number };
  'vfx:text': { text: string; x: number; y: number; color?: string };
  'camera:shake': { intensity: number; durationMs: number };

  // Audio
  'audio:play_sfx': { name: string; volume?: number };
  'audio:mute_toggled': { sound: boolean; music: boolean };

  // Platform & Ads
  'ad:reward_granted': { placement: string };
}

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, Set<EventCallback<any>>> = new Map();

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
    this.listeners.get(event)!.add(callback as EventCallback<any>);

    return () => {
      this.off(event, callback);
    };
  }

  public off<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback as EventCallback<any>);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<K extends keyof GameEvents>(
    event: K,
    ...args: GameEvents[K] extends void ? [] : [GameEvents[K]]
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      const payload = args[0];
      for (const cb of set) {
        try {
          cb(payload);
        } catch (e) {
          console.error(`[EventBus] Error in listener for ${String(event)}:`, e);
        }
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = EventBus.getInstance();
