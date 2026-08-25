import * as THREE from 'three';

/**
 * Трасса: одна кривая — один источник истины.
 *
 * knowledge/threejs/racing_track_and_opponents.md §1-2. Из кривой выводятся
 * полотно, отбойники, чекпойнты, гоночная линия, стартовая решётка, респавн и
 * миникарта. Трасса из отдельных повёрнутых сегментов даёт уступ на каждом
 * стыке (CRITICAL_RULES §64), а восстановление после вылета становится
 * нерешаемой задачей.
 */
export const CHECKPOINTS = 40;

export interface TrackSample {
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  halfWidth: number;
}

export class RaceTrack {
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;
  readonly checkpoints: THREE.Vector3[] = [];
  readonly checkpointSpacing: number;

  private readonly samples = 720;
  private readonly cachedRight: THREE.Vector3[] = [];
  private readonly cachedTangent: THREE.Vector3[] = [];
  private readonly cachedPoint: THREE.Vector3[] = [];
  private readonly racingOffset: number[] = [];

  constructor(controlPoints: THREE.Vector3[]) {
    // 'centripetal': 'catmullrom' на близко лежащих точках даёт петли, и
    // трасса начинает заворачиваться сама в себя.
    this.curve = new THREE.CatmullRomCurve3(controlPoints, true, 'centripetal', 0.5);
    this.length = this.curve.getLength();
    this.checkpointSpacing = this.length / CHECKPOINTS;

    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= this.samples; i++) {
      const t = i / this.samples;
      const p = this.curve.getPointAt(t % 1);
      const tan = this.curve.getTangentAt(t % 1).normalize();
      // up-стабилизированный репер: собственный «up» кривой (Frenet)
      // переворачивается на прямых и скручивает полотно.
      const right = new THREE.Vector3().crossVectors(tan, up).normalize();
      this.cachedPoint.push(p);
      this.cachedTangent.push(tan);
      this.cachedRight.push(right);
    }

    for (let i = 0; i < CHECKPOINTS; i++) {
      this.checkpoints.push(this.curve.getPointAt(i / CHECKPOINTS));
    }

    this.buildRacingLine();
  }

  halfWidthAt(t: number): number {
    // Переменная ширина: постоянная — главный признак «сгенерированной» трассы.
    const k = Math.abs(this.curvatureAt(t));
    return THREE.MathUtils.lerp(6.5, 9.0, THREE.MathUtils.clamp(k * 26, 0, 1));
  }

  sample(t: number, out: TrackSample): TrackSample {
    const idx = this.index(t);
    out.point = this.cachedPoint[idx];
    out.tangent = this.cachedTangent[idx];
    out.right = this.cachedRight[idx];
    out.halfWidth = this.halfWidthAt(t);
    return out;
  }

  /** Знаковая кривизна: + правый поворот, − левый. */
  curvatureAt(t: number): number {
    const i = this.index(t);
    const a = this.cachedTangent[(i - 6 + this.samples) % this.samples];
    const b = this.cachedTangent[(i + 6) % this.samples];
    return a.x * b.z - a.z * b.x;
  }

  /** Крен виража из кривизны: он и есть причина держать газ в повороте. */
  bankAt(t: number): number {
    return THREE.MathUtils.clamp(this.curvatureAt(t) * 3.2, -0.22, 0.22);
  }

  /** Смещение гоночной линии от осевой, −1..1. */
  racingOffsetAt(t: number): number {
    return this.racingOffset[this.index(t)];
  }

  pointOnRacingLine(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    const i = this.index(t);
    return out.copy(this.cachedPoint[i])
      .addScaledVector(this.cachedRight[i], this.racingOffset[i] * this.halfWidthAt(t) * 0.8);
  }

  rightAt(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.cachedRight[this.index(t)]);
  }

  tangentAt(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.cachedTangent[this.index(t)]);
  }

  /**
   * Радиус кривизны впереди — из него берётся безопасная скорость входа
   * (`vMax = sqrt(grip * r)`), а не «газ до упора всегда».
   */
  curvatureRadiusAhead(t: number, aheadMeters: number): number {
    const step = aheadMeters / this.length;
    let maxK = 0;
    for (let i = 0; i <= 6; i++) {
      maxK = Math.max(maxK, Math.abs(this.curvatureAt((t + (step * i) / 6) % 1)));
    }
    return maxK < 1e-4 ? 1e4 : THREE.MathUtils.clamp(1 / (maxK * 7), 12, 1e4);
  }

  /** Ближайший параметр кривой к точке — для прогресса и «еду не туда». */
  nearestT(pos: THREE.Vector3, hintT = -1): number {
    let bestT = 0;
    let bestD = Infinity;
    // При наличии подсказки ищем в окрестности: полный перебор 720 точек на
    // каждую машину каждый кадр — это и есть «гонка тормозит на 8 соперниках».
    const from = hintT >= 0 ? Math.floor(hintT * this.samples) - 40 : 0;
    const to = hintT >= 0 ? Math.floor(hintT * this.samples) + 40 : this.samples;
    for (let i = from; i < to; i++) {
      const idx = ((i % this.samples) + this.samples) % this.samples;
      const d = this.cachedPoint[idx].distanceToSquared(pos);
      if (d < bestD) { bestD = d; bestT = idx / this.samples; }
    }
    return bestT;
  }

  /** Геометрия полотна: протяжка профиля вдоль кривой с креном. */
  buildRoadGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3();

    for (let i = 0; i <= this.samples; i++) {
      const t = (i % this.samples) / this.samples;
      const idx = i % this.samples;
      const p = this.cachedPoint[idx];
      right.copy(this.cachedRight[idx]).applyAxisAngle(this.cachedTangent[idx], this.bankAt(t));
      const hw = this.halfWidthAt(t);
      positions.push(p.x - right.x * hw, p.y - right.y * hw, p.z - right.z * hw);
      positions.push(p.x + right.x * hw, p.y + right.y * hw, p.z + right.z * hw);
      normals.push(up.x, up.y, up.z, up.x, up.y, up.z);
      if (i < this.samples) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  /** Точки старта: шахматно вдоль кривой, всё та же геометрия. */
  gridSlot(index: number, out = new THREE.Vector3()): { pos: THREE.Vector3; heading: THREE.Vector3 } {
    const row = Math.floor(index / 2);
    const t = (1 - (row * 8 + 4) / this.length + 1) % 1;
    const side = index % 2 === 0 ? -1 : 1;
    const i = this.index(t);
    out.copy(this.cachedPoint[i]).addScaledVector(this.cachedRight[i], side * 2.6);
    return { pos: out, heading: this.cachedTangent[i].clone() };
  }

  private index(t: number): number {
    const wrapped = ((t % 1) + 1) % 1;
    return Math.min(this.samples - 1, Math.floor(wrapped * this.samples));
  }

  private buildRacingLine(): void {
    const raw: number[] = [];
    for (let i = 0; i < this.samples; i++) {
      const t = i / this.samples;
      const k = this.curvatureAt(t);
      const ahead = this.curvatureAt((t + 0.03) % 1);
      raw.push(THREE.MathUtils.clamp(-(k * 6 + ahead * 4), -0.85, 0.85));
    }
    // Сглаживание один раз на старте и запекание: считать это каждый кадр не нужно.
    for (let i = 0; i < this.samples; i++) {
      let sum = 0;
      for (let j = -4; j <= 4; j++) sum += raw[((i + j) % this.samples + this.samples) % this.samples];
      this.racingOffset.push(sum / 9);
    }
  }
}

/** Замкнутый контур трассы «восьмёркой с длинной прямой». */
export function defaultTrackPoints(): THREE.Vector3[] {
  const raw: Array<[number, number]> = [
    [0, -95], [42, -86], [66, -58], [70, -22], [54, 6], [24, 22],
    [-8, 30], [-34, 48], [-64, 56], [-88, 38], [-92, 6], [-78, -26],
    [-56, -52], [-30, -74],
  ];
  return raw.map(([x, z]) => new THREE.Vector3(x, 0, z));
}
