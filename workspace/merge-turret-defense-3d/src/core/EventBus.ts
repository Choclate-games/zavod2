import type { GameSnapshot, SaveData, SlotIndex, TurretTier } from '../game/types';

export type GameEvents = {
  'state:changed': { state: 'boot' | 'playing' | 'paused' | 'defeat' };
  'save:changed': { save: SaveData };
  'coins:changed': { coins: number };
  'grid:changed': { slots: readonly (TurretTier | null)[] };
  'turret:merged': { tier: TurretTier; index: SlotIndex };
  'turret:bought': { tier: TurretTier; index: SlotIndex; cost: number };
  'enemy:hit': { enemyId: number; damage: number; critical: boolean };
  'enemy:killed': { enemyId: number; coins: number };
  'wave:changed': { wave: number; alive: number; spawned: number; target: number; baseHp: number };
  'wave:cleared': { wave: number; reward: number };
  'base:damaged': { hp: number };
  'input:focusEnemy': { enemyId: number | null };
  'audio:mute': { muted: boolean };
  'platform:pause': { paused: boolean };
  'platform:audio': { enabled: boolean };
  'ui:snapshot': GameSnapshot;
};

type Handler<T> = (payload: T) => void;

export class EventBus {
  private readonly handlers = new Map<keyof GameEvents, Set<Handler<GameEvents[keyof GameEvents]>>>();

  on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): () => void {
    let bucket = this.handlers.get(event);
    if (!bucket) {
      bucket = new Set<Handler<GameEvents[keyof GameEvents]>>();
      this.handlers.set(event, bucket);
    }
    bucket.add(handler as Handler<GameEvents[keyof GameEvents]>);
    return () => this.off(event, handler);
  }

  off<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<GameEvents[keyof GameEvents]>);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const bucket = this.handlers.get(event);
    if (!bucket) return;
    for (const handler of bucket) handler(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
