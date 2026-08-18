export type GameState = 'menu' | 'running' | 'paused' | 'result';

export interface InputSnapshot {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  pause: boolean;
}

export interface RunResult {
  delivered: number;
  total: number;
  coins: number;
  distance: number;
  duration: number;
}

export interface SaveData {
  version: number;
  coins: number;
  bestDelivery: number;
  upgrades: {
    engine: number;
    suspension: number;
    sides: number;
  };
  settings: {
    muted: boolean;
    volume: number;
    language: string;
  };
}

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  coins: 0,
  bestDelivery: 0,
  upgrades: { engine: 0, suspension: 0, sides: 0 },
  settings: { muted: false, volume: 0.65, language: 'ru' },
};

export interface GameEvents {
  'game:state': { state: GameState };
  'game:start': undefined;
  'game:pause': { paused: boolean };
  'cargo:lost': { remaining: number; total: number };
  'game:finish': RunResult;
  'game:save': undefined;
  'audio:impact': { strength: number };
  'ui:toast': { text: string; tone: 'good' | 'warn' | 'bad' };
}
