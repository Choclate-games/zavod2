export interface GameEvents {
  'route:created': { length: number; cost: number };
  'mail:delivered': { reward: number };
  'mail:failed': { reason: string };
  'threat:spawned': { kind: string };
  'toast': { message: string };
}
