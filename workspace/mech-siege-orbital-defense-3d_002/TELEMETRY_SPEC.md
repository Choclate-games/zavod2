# Спецификация телеметрии — Мех-Осада: Защита Орбитальной Базы 3D

Без телеметрии план плотности впечатлений не проверяем: вариант A/B невозможно
оценить, а допущения из [`ASSUMPTIONS.md`](./ASSUMPTIONS.md) остаются мнением.
Эти события — часть Definition of Done, а не опция.

## Обязательные события
| Событие | Когда отправляется | Параметры | Зачем | Проверяет |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

---

## Контракт реализации

```ts
// src/telemetry/Telemetry.ts
export type TelemetryEventName =
  | 'session_start';

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
    // По умолчанию — консоль в dev и платформенная аналитика в проде.
    if (import.meta.env.DEV) console.debug('[telemetry]', name, body);
  }
}

export const telemetry = new Telemetry();
```

## Правила
- Телеметрия не отправляет персональные данные: только идентификаторы событий, тайминги и категории устройств.
- `first_action` и `first_reward` отправляются через `trackOnce` — иначе воронка первой сессии искажается.
- События не должны выполняться синхронно в игровом цикле: только через микротаск или очередь.
- Отсутствие сети не должно приводить к исключению в геймплейном коде.
- Дашборд собирается по полям из [`EXPERIENCE_DENSITY.md`](./EXPERIENCE_DENSITY.md).
