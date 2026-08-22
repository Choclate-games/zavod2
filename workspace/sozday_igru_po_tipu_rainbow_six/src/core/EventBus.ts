import type {
  GameState,
  RoomConfig,
  AssaultStats,
  BreachPointData,
  ExplosiveConfig,
  WeaponConfig,
  WireColor,
  PlayerProgressSave,
} from "./Types";

export type EventMap = {
  "game:state_changed": { from: GameState; to: GameState };
  "room:started": { room: RoomConfig };
  "room:cleared": { stats: AssaultStats };
  "room:failed": { reason: string };
  "breach:planted": { point: BreachPointData; explosive: ExplosiveConfig };
  "breach:detonated": {
    point: BreachPointData;
    explosive: ExplosiveConfig;
    position: { x: number; y: number; z: number };
  };
  "slowmo:started": { duration: number; timeScale: number };
  "slowmo:ended": void;
  "slowmo:refund": { seconds: number };
  "weapon:fired": {
    weapon: WeaponConfig;
    origin: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
  };
  "weapon:reloaded": { ammoInMag: number; ammoInReserve: number };
  "enemy:hit": {
    enemyId: string;
    damage: number;
    isHeadshot: boolean;
    position: { x: number; y: number; z: number };
    killed: boolean;
  };
  "enemy:killed": { enemyId: string; isHeadshot: boolean; isBreachKill: boolean };
  "shield:blocked": {
    damage: number;
    point: { x: number; y: number; z: number };
    glassHit: boolean;
  };
  "shield:broken": void;
  "player:damaged": {
    damage: number;
    currentHp: number;
    sourcePosition: { x: number; y: number; z: number };
  };
  "player:died": { reason: string };
  "recon:toggled": { active: boolean };
  "tripmine:destroyed": { id: string; position: { x: number; y: number; z: number } };
  "bomb:wire_cut": { color: WireColor; correct: boolean; remainingTime: number };
  "bomb:defused": void;
  "bomb:exploded": void;
  "ui:show_screen": { screen: string };
  "ui:show_modal": { modal: string };
  "ui:hide_modal": void;
  "save:updated": { save: PlayerProgressSave };
};

type Handler<T> = (payload: T) => void;

export class EventBus {
  private listeners: { [K in keyof EventMap]?: Handler<EventMap[K]>[] } = {};

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
    const list = this.listeners[event];
    if (!list) return;
    const index = list.indexOf(handler);
    if (index !== -1) {
      list.splice(index, 1);
    }
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const list = this.listeners[event];
    if (!list || list.length === 0) return;
    // Iterate over shallow copy in case listener unbinds itself
    const copy = list.slice();
    for (let i = 0; i < copy.length; i++) {
      copy[i](payload);
    }
  }

  clear(): void {
    this.listeners = {};
  }
}

export const globalEventBus = new EventBus();
