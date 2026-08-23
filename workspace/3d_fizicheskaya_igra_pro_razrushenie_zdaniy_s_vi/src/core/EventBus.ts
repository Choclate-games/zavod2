export type EventMap = {
  'aim:start': { x: number; y: number }
  'aim:move': { x: number; y: number }
  'aim:end': { x: number; y: number }
  'cam:orbit': { dx: number; dy: number; zoom: number }
  'act:restart': Record<string, never>
  'act:pause': Record<string, never>
  'act:view': Record<string, never>
  'charge:request': { x: number; y: number }
  'delay:adjust': { delta: number }
  'delay:value': { seconds: number }
  'level:start': { index: number }
  'charges:changed': { left: number; total: number }
  'progress:collapse': { ratio: number }
  'level:result': { win: boolean; ratio: number; score: number; stars: number; breach: boolean }
  'platform:pause': { paused: boolean }
  'platform:audio': { enabled: boolean }
  'audio:muted': { muted: boolean }
  'loading:progress': { value: number }
  'screen:show': { name: string }
  'chain:hit': { x: number; y: number; z: number; power: number }
}

type Handler<T> = (payload: T) => void

export class EventBus {
  private readonly handlers = new Map<keyof EventMap, Set<Handler<never>>>()

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as Handler<never>)
  }

  off<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>)
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of set) (handler as Handler<EventMap[K]>)(payload)
  }

  clear(): void {
    this.handlers.clear()
  }
}
