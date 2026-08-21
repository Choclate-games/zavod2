import * as THREE from 'three';
import type { RaceTrack } from './raceTrack';
import { ArcadeCar, cornerSpeed, DEFAULT_TUNING, type CarInput } from './arcadeCar';

/**
 * Водитель-бот: выдаёт ТОЛЬКО `CarInput` — тот же интерфейс, что у игрока.
 *
 * knowledge/threejs/racing_track_and_opponents.md §3. Живёт отдельно от демо,
 * чтобы прогоняться головно (`npm run check:racing`): «бот проезжает 3 круга
 * без вылетов» — это обычный тест, а не 10 минут смотрения в экран.
 */
export interface BotState {
  /** Прогресс по кривой, 0..1. */
  t: number;
  /** Смещение полосы от гоночной линии, метры. */
  laneBias: number;
  maxSpeed: number;
}

const _target = new THREE.Vector3();
const _right = new THREE.Vector3();

export function driveBot(track: RaceTrack, car: ArcadeCar, state: BotState): CarInput {
  // Дальность взгляда растёт со скоростью: фиксированная даёт виляние на
  // прямых и вылеты в поворотах.
  const lookahead = 7 + car.speed * 0.38;
  const t = (state.t + lookahead / track.length) % 1;

  track.pointOnRacingLine(t, _target);
  track.rightAt(t, _right);
  _target.addScaledVector(_right, state.laneBias);

  const dx = _target.x - car.x;
  const dz = _target.z - car.z;
  const localX = dx * car.forwardZ - dz * car.forwardX;
  const steer = THREE.MathUtils.clamp(localX * 0.32, -1, 1);

  // Скорость входа в поворот — из радиуса кривизны, а не «газ всегда в пол».
  const radius = track.curvatureRadiusAhead(t, lookahead + 14);
  const vMax = Math.min(cornerSpeed(radius, DEFAULT_TUNING.gripLateral), state.maxSpeed);

  return {
    throttle: car.speed < vMax ? 1 : 0,
    brake: car.speed > vMax * 1.1 ? 1 : 0,
    steer,
    handbrake: car.speed > 24 && Math.abs(steer) > 0.8,
  };
}
