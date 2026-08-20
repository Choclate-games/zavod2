/**
 * Telemetry subsystem implementing TELEMETRY_SPEC.md
 */

export type TelemetryEventName =
  | 'session_start'
  | 'first_action'
  | 'first_reward'
  | 'wave_start'
  | 'wave_clear'
  | 'stealth_hide'
  | 'torch_lit'
  | 'salt_circle_drawn'
  | 'upgrade_picked'
  | 'player_death'
  | 'boss_slain'
  | 'run_finish';

export interface TelemetryPayload {
  [key: string]: string | number | boolean | undefined;
}

class Telemetry {
  private readonly sessionStartedAt = performance.now();
  private readonly sent = new Set<TelemetryEventName>();

  private t(): number {
    return Math.round(performance.now() - this.sessionStartedAt);
  }

  track(name: TelemetryEventName, payload: TelemetryPayload = {}): void {
    const body = { ...payload, t_ms: this.t() };
    try {
      queueMicrotask(() => this.sink(name, body));
    } catch {
      // Telemetry never breaks gameplay
    }
  }

  trackOnce(name: TelemetryEventName, payload: TelemetryPayload = {}): void {
    if (this.sent.has(name)) return;
    this.sent.add(name);
    this.track(name, payload);
  }

  private sink(name: TelemetryEventName, body: TelemetryPayload): void {
    if (import.meta.env.DEV) {
      console.debug('[telemetry]', name, body);
    }
  }
}

export const telemetry = new Telemetry();
