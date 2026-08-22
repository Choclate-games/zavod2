export type EventCallback<T = unknown> = (data: T) => void;

export interface GameEvents {
  'GAME_STATE_CHANGED': 'MENU' | 'MATCHMAKING' | 'PLAYING' | 'ROUND_END' | 'MATCH_END' | 'PAUSED' | 'ARSENAL';
  'HUD_UPDATE': {
    health: number;
    armor: number;
    ammo: number;
    reserveAmmo: number;
    weaponName: string;
    weaponId: string;
    hasDefuseKit: boolean;
    c4Ticking: boolean;
    c4TimeRemaining: number;
    isDefusing: boolean;
    defuseProgress: number;
    scoreCT: number;
    scoreT: number;
    roundNumber: number;
    playerTeam: 'CT' | 'T';
    crosshairSpread: number;
    radarEntities: Array<{ id: string; x: number; z: number; team: 'CT' | 'T'; isPlayer: boolean; isAlive: boolean; hasC4?: boolean }>;
    c4Position?: { x: number; z: number };
  };
  'KILLFEED_EVENT': {
    killerName: string;
    victimName: string;
    weapon: string;
    isHeadshot: boolean;
    isWallbang: boolean;
    killerTeam: 'CT' | 'T';
    victimTeam: 'CT' | 'T';
  };
  'HITMARKER': {
    isHeadshot: boolean;
    isWallbang: boolean;
    damage: number;
  };
  'ROUND_END': {
    winnerTeam: 'CT' | 'T';
    reason: string;
    mvpName: string;
    mvpScore: number;
    roundCT: number;
    roundT: number;
  };
  'MATCH_END': {
    winnerTeam: 'CT' | 'T';
    playerWon: boolean;
    scoreCT: number;
    scoreT: number;
    kills: number;
    deaths: number;
    headshots: number;
    headshotPercent: number;
    eloDelta: number;
    newElo: number;
    rankName: string;
  };
  'AUDIO_PLAY': {
    sound: string;
    pitch?: number;
    volume?: number;
    position?: { x: number; y: number; z: number };
  };
  'CAMERA_SHAKE': {
    intensity: number;
    duration: number;
  };
  'NAVIGATE_SCREEN': 'MainMenu' | 'GameplayHUD' | 'RoundEndModal' | 'MatchResultScreen' | 'ArsenalScreen' | 'PauseModal';
  'TEAM_SELECTED': 'CT' | 'T';
  'EQUIP_SKIN': { weaponId: string; skinId: string };
  'SET_SENSITIVITY': number;
  'SET_SOUND_VOLUME': number;
  'SET_MUTED': boolean;
}

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<keyof GameEvents, Set<EventCallback<any>>> = new Map();

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
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  public off<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    const list = this.listeners.get(event);
    if (list) {
      list.delete(callback);
    }
  }

  public emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in event listener for ${String(event)}:`, err);
        }
      });
    }
  }
}

export const events = EventBus.getInstance();
