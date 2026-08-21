import { GameState, VehicleId, TrackDefinition, CarDefinition } from '../types';
import { eventBus } from './EventBus';
import { CAR_CATALOG, TRACK_CATALOG, CONFIG } from './Config';

export class GameStateManager {
  private state: GameState = 'BOOT';
  private activeTrack: TrackDefinition = TRACK_CATALOG[0];
  private activeCar: VehicleId = 'car_hatch_s';
  private invulnerableTimer = 0;

  constructor() {
    this.activeCar = 'car_hatch_s';

    eventBus.on('game:start_run', ({ trackId, carId }) => {
      const trk = TRACK_CATALOG.find((t) => t.id === trackId) || TRACK_CATALOG[0];
      this.activeTrack = trk;
      this.activeCar = carId;
      this.setState('PLAYING');
    });

    eventBus.on('game:pause', () => {
      if (this.state === 'PLAYING') {
        this.setState('PAUSED');
      }
    });

    eventBus.on('game:resume_run', () => {
      if (this.state === 'PAUSED') {
        this.setState('PLAYING');
      }
    });

    eventBus.on('game:revive', () => {
      this.invulnerableTimer = CONFIG.ads.reviveInvulnerableSec;
      this.setState('PLAYING');
    });

    eventBus.on('game:finish_run', () => {
      this.setState('VICTORY');
    });

    eventBus.on('game:crash', ({ fatal }) => {
      if (this.state === 'PLAYING') {
        if (this.invulnerableTimer > 0) return;
        this.setState('CRASH_REVIVE');
      }
    });
  }

  getState(): GameState {
    return this.state;
  }

  setState(to: GameState): void {
    if (this.state === to) return;
    const from = this.state;
    this.state = to;
    eventBus.emit('state:changed', { from, to });
  }

  getActiveTrack(): TrackDefinition {
    return this.activeTrack;
  }

  getActiveCarId(): VehicleId {
    return this.activeCar;
  }

  getActiveCarDefinition(): CarDefinition {
    return CAR_CATALOG.find((c) => c.id === this.activeCar) || CAR_CATALOG[0];
  }

  isInvulnerable(): boolean {
    return this.invulnerableTimer > 0;
  }

  update(dt: number): void {
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }
  }
}

export const gameStateManager = new GameStateManager();