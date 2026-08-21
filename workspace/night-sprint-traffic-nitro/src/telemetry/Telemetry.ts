import { eventBus } from '../core/EventBus';

export class TelemetryService {
  private fpsHistory: number[] = [];
  private lastFpsUpdate = performance.now();
  private frameCount = 0;

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    eventBus.on('game:start_run', (data) => {
      this.track('run_started', data);
    });

    eventBus.on('checkpoint:hit', (data) => {
      this.track('checkpoint_hit', data);
    });

    eventBus.on('game:finish_run', (data) => {
      this.track('run_finished', data);
    });
  }

  track(eventName: string, params?: any): void {
    // Telemetry event logging (disabled in production if needed)
    if (typeof window !== 'undefined' && (window as any).__DEBUG_LOGS__) {
      console.log(`[Telemetry] ${eventName}`, params);
    }
  }

  update(): void {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 1000) {
      const fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }
    }
  }
}

export const telemetryService = new TelemetryService();
