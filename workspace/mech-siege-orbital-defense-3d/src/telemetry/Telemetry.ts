// src/telemetry/Telemetry.ts
// Implementation matching TELEMETRY_SPEC.md

export type TelemetryEventName =
  | 'session_start'
  | 'first_action'
  | 'first_reward'
  | 'wave_start'
  | 'wave_complete'
  | 'card_selected'
  | 'turret_built'
  | 'run_start'
  | 'run_end'
  | 'ad_rewarded'
  | 'ad_interstitial'
  | 'boss_fight_start'
  | 'boss_defeated';

export interface TelemetryPayload {
  [key: string]: string | number | boolean | undefined;
}

class Telemetry {
  private readonly sessionStartedAt = performance.now();
  private readonly sent = new Set<TelemetryEventName>();

  /** Время от старта сессии в миллисекундах — общий параметр всех событий. */
  private t(): number {
    return Math.round(performance.now() - this.sessionStartedAt);
  }

  track(name: TelemetryEventName, payload: TelemetryPayload = {}): void {
    const body = { ...payload, t_ms: this.t() };
    // Отправка не должна ронять игру и не должна блокировать кадр.
    try {
      queueMicrotask(() => this.sink(name, body));
    } catch {
      /* телеметрия никогда не ломает геймплей */
    }
  }

  /** События «первый раз за сессию» отправляются ровно один раз. */
  trackOnce(name: TelemetryEventName, payload: TelemetryPayload = {}): void {
    if (this.sent.has(name)) return;
    this.sent.add(name);
    this.track(name, payload);
  }

  private sink(name: TelemetryEventName, body: TelemetryPayload): void {
    // В dev режиме выводим в консоль
    if (import.meta.env.DEV) {
      console.debug('[telemetry]', name, body);
    }
  }
}

export const telemetry = new Telemetry();
