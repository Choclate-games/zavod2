/**
 * Telemetry (part of Definition of Done). Every event ships through a
 * microtask so it can never block or throw inside the game loop, and
 * `first_action` / `first_reward` fire at most once per session.
 */

export type TelemetryEventName =
  | 'session_start'
  | 'first_action'
  | 'first_reward'
  | 'run_over'
  | 'wave_clear'
  | 'wave_start'
  | 'sample_collect'
  | 'upgrade_choose'
  | 'game_ready'
  | 'revive'
  | 'double_gold';

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
      /* telemetry never breaks gameplay */
    }
  }

  trackOnce(name: TelemetryEventName, payload: TelemetryPayload = {}): void {
    if (this.sent.has(name)) return;
    this.sent.add(name);
    this.track(name, payload);
  }

  private sink(name: TelemetryEventName, body: TelemetryPayload): void {
    if (import.meta.env.DEV) console.debug('[telemetry]', name, body);
  }
}

export const telemetry = new Telemetry();
