/**
 * Аркадная модель машины — общая для игрока и соперников.
 *
 * knowledge/threejs/racing_track_and_opponents.md §3: бот управляется тем же
 * `CarInput`, что и игрок. Бот, которому пишут position напрямую, невозможно
 * догнать, столкнуть или обогнать — гонка исчезает.
 *
 * Модуль намеренно НЕ импортирует three: он проверяется головно
 * (`npm run check:racing`) без рендерера. Векторы — плоские числа в XZ.
 */

export interface CarInput {
  throttle: number;   // 0..1
  brake: number;      // 0..1
  steer: number;      // -1..1
  handbrake: boolean;
}

export interface CarTuning {
  enginePower: number;      // м/с² при полном газе
  brakePower: number;
  maxSpeed: number;         // м/с
  steerRate: number;        // рад/с при полном руле
  gripLateral: number;      // поперечное сцепление, м/с²
  gripHandbrake: number;
  drag: number;
  rollingResistance: number;
}

export const DEFAULT_TUNING: CarTuning = {
  enginePower: 15,
  brakePower: 24,
  maxSpeed: 52,
  steerRate: 2.0,
  gripLateral: 16,
  gripHandbrake: 4.5,
  // Подобрано так, чтобы enginePower уравновешивалось с сопротивлением на maxSpeed:
  // drag ≈ enginePower / maxSpeed². Иначе машина упирается в случайную скорость.
  drag: 0.0055,
  rollingResistance: 0.6,
};

export const SURFACES = {
  asphalt: { grip: 1.0, drag: 1.0 },
  gravel: { grip: 0.62, drag: 1.25 },
  grass: { grip: 0.4, drag: 1.7 },
} as const;
export type SurfaceId = keyof typeof SURFACES;

export class ArcadeCar {
  x = 0;
  z = 0;
  /** Курс в радианах: 0 = +Z. */
  heading = 0;
  /** Скорость в мировых координатах. */
  vx = 0;
  vz = 0;
  steerAngle = 0;
  /** Текущий множитель сцепления, меняется ПЛАВНО (см. §5 документа). */
  gripFactor = 1;
  /** Модуль поперечного скольжения, м/с — из него считается занос и дым. */
  slip = 0;
  boost = 0;

  constructor(readonly tuning: CarTuning = DEFAULT_TUNING) {}

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  get forwardX(): number { return Math.sin(this.heading); }
  get forwardZ(): number { return Math.cos(this.heading); }

  /** Продольная составляющая скорости (со знаком). */
  get forwardSpeed(): number {
    return this.vx * this.forwardX + this.vz * this.forwardZ;
  }

  reset(x: number, z: number, heading: number): void {
    this.x = x; this.z = z; this.heading = heading;
    this.vx = 0; this.vz = 0;
    this.steerAngle = 0; this.slip = 0; this.boost = 0;
    this.gripFactor = 1;
  }

  /**
   * Один шаг. `surface` меняет сцепление не порогом, а lerp'ом: пороговое
   * переключение даёт «щелчок» на границе асфальт/гравий.
   */
  step(dt: number, input: CarInput, surface: SurfaceId = 'asphalt'): void {
    const s = SURFACES[surface];
    this.gripFactor += (s.grip - this.gripFactor) * Math.min(1, dt * 5);

    // Руль: пружинный возврат к нейтрали, скорость поворота падает со скоростью.
    const speedFactor = 1 - Math.min(0.62, this.speed / this.tuning.maxSpeed * 0.62);
    const target = input.steer * speedFactor;
    this.steerAngle += (target - this.steerAngle) * Math.min(1, dt * 9);

    const fwdSpeed = this.forwardSpeed;
    this.heading += this.steerAngle * this.tuning.steerRate * dt
      * Math.sign(fwdSpeed || 1) * Math.min(1, Math.abs(fwdSpeed) / 4);

    const fx = this.forwardX;
    const fz = this.forwardZ;
    const rx = fz;          // правый вектор = поворот forward на -90°
    const rz = -fx;

    // Разложение скорости на продольную и поперечную.
    let long = this.vx * fx + this.vz * fz;
    let lat = this.vx * rx + this.vz * rz;

    const power = this.tuning.enginePower * (1 + this.boost);
    long += input.throttle * power * dt;
    long -= input.brake * this.tuning.brakePower * dt * Math.sign(long || 1);
    long -= long * this.tuning.drag * this.speed * s.drag * dt;
    long -= Math.sign(long) * this.tuning.rollingResistance * dt;
    long = Math.max(-this.tuning.maxSpeed * 0.35, Math.min(this.tuning.maxSpeed, long));

    // Поперечное сцепление: ручник резко снижает его — это и есть занос.
    const grip = (input.handbrake ? this.tuning.gripHandbrake : this.tuning.gripLateral) * this.gripFactor;
    const latDrop = grip * dt;
    lat = Math.abs(lat) <= latDrop ? 0 : lat - Math.sign(lat) * latDrop;
    this.slip = Math.abs(lat);

    this.vx = fx * long + rx * lat;
    this.vz = fz * long + rz * lat;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    this.boost = Math.max(0, this.boost - dt * 0.8);
  }

  /** Угол заноса в радианах: 0 — едем прямо, ~1.2 — почти боком. */
  get slipAngle(): number {
    const sp = this.speed;
    if (sp < 1) return 0;
    return Math.abs(Math.atan2(this.slip, Math.abs(this.forwardSpeed)));
  }
}

/**
 * Очки за занос. Копятся, пока угол в рабочем диапазоне; банкуются при
 * выпрямлении, теряются при остановке или развороте.
 */
export class DriftScorer {
  pending = 0;
  banked = 0;
  multiplier = 1;
  private idleFrames = 0;

  update(dt: number, car: ArcadeCar): 'idle' | 'drifting' | 'banked' | 'lost' {
    const angle = car.slipAngle;
    const scoring = angle > 0.21 && angle < 0.9 && car.speed > 8;

    if (scoring) {
      this.idleFrames = 0;
      this.pending += car.speed * angle * dt * 12;
      return 'drifting';
    }

    if (this.pending > 0) {
      // Разворот или остановка — цепочка потеряна, а не забанкована.
      if (angle >= 0.9 || car.speed < 4) {
        this.pending = 0;
        this.multiplier = 1;
        return 'lost';
      }
      this.idleFrames += dt;
      if (this.idleFrames > 0.55) {
        this.banked += Math.round(this.pending * this.multiplier);
        this.pending = 0;
        this.multiplier = Math.min(5, this.multiplier + 1);
        this.idleFrames = 0;
        return 'banked';
      }
    }
    return 'idle';
  }

  reset(): void {
    this.pending = 0;
    this.banked = 0;
    this.multiplier = 1;
    this.idleFrames = 0;
  }
}

/**
 * Честная резинка: меняет параметры вождения, а не телепортирует.
 * Границы −8 % … +12 % не произвольные: за ними игрок замечает, что его
 * «догоняют магией», и победа обесценивается (§4 документа).
 */
export function rubberBandFactor(gapInCheckpoints: number): number {
  return Math.max(-0.08, Math.min(0.12, gapInCheckpoints * 0.02));
}

/** Безопасная скорость входа в поворот радиуса `r`. */
export function cornerSpeed(radius: number, lateralGrip: number): number {
  return Math.sqrt(Math.max(0, lateralGrip * radius));
}
