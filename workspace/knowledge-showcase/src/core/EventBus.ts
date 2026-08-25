import type { GameEvents } from './types';

type Listener<T> = (payload: T) => void;

export class EventBus {
  private readonly listeners = new Map<keyof GameEvents, Set<Listener<never>>>();

  on<K extends keyof GameEvents>(event: K, listener: Listener<GameEvents[K]>): () => void {
    let bucket = this.listeners.get(event);
    if (!bucket) {
      bucket = new Set<Listener<never>>();
      this.listeners.set(event, bucket);
    }
    const typed = listener as Listener<never>;
    bucket.add(typed);
    return () => bucket?.delete(typed);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const bucket = this.listeners.get(event);
    if (!bucket) return;
    for (const listener of bucket) listener(payload as never);
  }

  clear(): void {
    this.listeners.clear();
  }
}
