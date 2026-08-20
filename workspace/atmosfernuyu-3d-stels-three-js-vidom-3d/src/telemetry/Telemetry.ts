export type TelemetryEventName =
  | 'session_start'
  | 'first_action'
  | 'first_reward'
  | 'wave_start'
  | 'wave_clear'
  | 'upgrade_selected'
  | 'boss_encounter'
  | 'game_over'
  | 'game_victory'
  | 'revive_used'
  | 'reroll_used'
  | 'purchase_attempt'
  | 'stealth_detected';

export interface TelemetryPayload {
  [key: string]: string | number | boolean | undefined;
}

class Telemetry {
  private readonly sessionStartedAt = performance.now();
  private readonly sent = new Set<string>();

  /** Time in ms since session start */
  private t(): number {
    return Math.round(performance.now() - this.sessionStartedAt);
  }

  track(name: TelemetryEventName, payload: TelemetryPayload = {}): void {
    const body = { ...payload, t_ms: this.t() };
    try {
      queueMicrotask(() => this.sink(name, body));
    } catch {
      // Telemetry must never crash game logic
    }
  }

  /** One-time events per session (e.g. first_action, first_reward) */
  trackOnce(name: TelemetryEventName, payload: TelemetryPayload = {}): void {
    if (this.sent.has(name)) return;
    this.sent.add(name);
    this.track(name, payload);
  }

  private sink(name: TelemetryEventName, body: TelemetryPayload): void {
    if ((import.meta as any).env?.DEV) {
      console.debug('[telemetry]', name, body);
    }
  }
}

export const telemetry = new Telemetry();
