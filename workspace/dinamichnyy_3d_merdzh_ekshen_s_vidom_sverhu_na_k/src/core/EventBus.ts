export type GameEvents = {
  'input:pointer-down': { x: number; y: number; pointerId: number; pointerType: string }
  'input:pointer-move': { x: number; y: number; pointerId: number }
  'input:pointer-up': { x: number; y: number; pointerId: number }
  'input:chomp': undefined
  'input:pause': undefined
  'input:restart': undefined
  'game:state': { state: string }
  'game:hud': { wave: number; time: number; score: number; ringouts: number; tier: number; combo: number; radius: number }
  'platform:pause': 'PAUSED' | 'PLAYING'
  'platform:audio': 'MUTED' | 'AUDIBLE'
}

type Listener<T> = (payload: T) => void

export class EventBus {
  private readonly listeners = new Map<keyof GameEvents, Set<Listener<never>>>()

  on<K extends keyof GameEvents>(event: K, listener: Listener<GameEvents[K]>): () => void {
    let bucket = this.listeners.get(event)
    if (!bucket) {
      bucket = new Set<Listener<never>>()
      this.listeners.set(event, bucket)
    }
    const typed = listener as Listener<never>
    bucket.add(typed)
    return () => bucket?.delete(typed)
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const bucket = this.listeners.get(event)
    if (!bucket) return
    bucket.forEach((listener) => listener(payload as never))
  }
}
