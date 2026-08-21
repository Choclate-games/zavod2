import * as THREE from 'three';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import { RaceTrack, CHECKPOINTS, defaultTrackPoints, type TrackSample } from '../game/raceTrack';
import {
  ArcadeCar, DriftScorer, DEFAULT_TUNING, rubberBandFactor,
  type CarInput, type SurfaceId,
} from '../game/arcadeCar';
import { driveBot } from '../game/botDriver';
import { buildCarMesh } from '../world/carRig';

const LAPS = 3;
const BOTS = 5;

interface Racer {
  car: ArcadeCar;
  mesh: THREE.Group;
  isPlayer: boolean;
  /** Прогресс по кривой, 0..1 — подсказка для nearestT. */
  t: number;
  lap: number;
  cp: number;
  laneBias: number;
  baseMaxSpeed: number;
  finished: boolean;
  bestLapMs: number;
  lapStartMs: number;
  name: string;
}

/**
 * Гонка: трасса из одной кривой, чекпойнты и круги, гоночная линия,
 * соперники на том же вводе, честная резинка.
 *
 * Прямая проверка knowledge/threejs/racing_track_and_opponents.md.
 * Управление машиной здесь аркадное (renderer-free `ArcadeCar`); честная
 * физика ray-cast подвески — во вкладке грузовика.
 */
export class RacingDemo implements Demo {
  readonly id = 'racing';
  readonly title = ['🏁 Гонка: трасса и соперники', '🏁 Racing: track and rivals'] as const;
  readonly hint = [
    '<b>W</b>/<b>S</b> газ и тормоз · <b>A</b>/<b>D</b> руль · <b>Space</b> ручник (занос копит очки) · <b>C</b> камера · <b>R</b> рестарт',
    '<b>W</b>/<b>S</b> throttle and brake · <b>A</b>/<b>D</b> steer · <b>Space</b> handbrake (drift scores) · <b>C</b> camera · <b>R</b> restart',
  ] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.5, 900);

  private ctx!: DemoContext;
  private track!: RaceTrack;
  private racers: Racer[] = [];
  private player!: Racer;
  private drift = new DriftScorer();
  private chaseCam = true;
  private unsubscribe: (() => void) | null = null;
  private statusTimer = 0;
  private raceStartMs = 0;
  private countdown = 3.999;
  private readonly sample: TrackSample = {
    point: new THREE.Vector3(), tangent: new THREE.Vector3(),
    right: new THREE.Vector3(), halfWidth: 8,
  };
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly camTarget = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();
  private minimap: THREE.Line | null = null;

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.track = new RaceTrack(defaultTrackPoints());

    this.scene.background = new THREE.Color(0x8fb8d8);
    this.scene.fog = new THREE.Fog(0x8fb8d8, 120, 460);

    const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
    sun.position.set(-60, 90, 40);
    sun.castShadow = ctx.tier === 'high';
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
    sun.shadow.camera.far = 260;
    this.scene.add(sun, sun.target);
    this.scene.add(new THREE.HemisphereLight(0xcfe4f5, 0x3a4a30, 1.6));

    this.buildWorld();
    this.spawnField();
    this.resetRace();
  }

  enter(): void {
    this.unsubscribe = this.ctx.input.onKey((code) => {
      if (code === 'KeyC') this.chaseCam = !this.chaseCam;
      if (code === 'KeyR') this.resetRace();
    });
  }

  exit(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  fixedUpdate(dt: number): void {
    if (this.countdown > 0) {
      this.countdown -= dt;
      // Физика уже шагает: машины оседают, но ввод заблокирован.
      for (const r of this.racers) r.car.step(dt, IDLE_INPUT, 'asphalt');
      if (this.countdown <= 0) this.raceStartMs = performance.now();
      return;
    }

    for (const r of this.racers) {
      const input = r.isPlayer ? this.playerInput() : this.botInput(r);
      r.car.step(dt, input, this.surfaceUnder(r));
      this.applyBounds(r);
      this.updateProgress(r);
    }
    this.applySlipstream();
    this.drift.update(dt, this.player.car);
  }

  update(dt: number): void {
    for (const r of this.racers) {
      r.mesh.position.set(r.car.x, 0.35, r.car.z);
      r.mesh.rotation.y = r.car.heading;
      // Крен кузова от заноса: дешёвый и самый читаемый признак сцепления.
      r.mesh.rotation.z = THREE.MathUtils.clamp(-r.car.slip * 0.035, -0.14, 0.14);
    }
    this.updateCamera(dt);

    this.statusTimer += dt;
    if (this.statusTimer > 0.1) { this.statusTimer = 0; this.pushStatus(); }
  }

  dispose(): void {
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  // ─────────────────────────────────────────────────────────────── ввод
  private playerInput(): CarInput {
    const i = this.ctx.input;
    const snap = i.vehicleSnapshot();      // клавиатура + тач-педали
    return {
      throttle: Math.max(snap.throttle, i.isDown('KeyW') ? 1 : 0),
      brake: Math.max(snap.brake, i.isDown('KeyS') ? 1 : 0),
      steer: snap.steer || (i.isDown('KeyD') ? 1 : 0) - (i.isDown('KeyA') ? 1 : 0),
      handbrake: snap.handbrake || i.isDown('Space'),
    };
  }

  /** Бот выдаёт ТОЛЬКО ввод — тот же код, что гоняется головно в check:racing. */
  private botInput(r: Racer): CarInput {
    return driveBot(this.track, r.car, {
      t: r.t,
      laneBias: r.laneBias,
      maxSpeed: r.car.tuning.maxSpeed,
    });
  }

  // ────────────────────────────────────────────────────────── прогресс
  private updateProgress(r: Racer): void {
    r.t = this.track.nearestT(this.tmpA.set(r.car.x, 0, r.car.z), r.t);

    const next = (r.cp + 1) % CHECKPOINTS;
    if (this.track.checkpoints[next].distanceTo(this.tmpA) < this.track.checkpointSpacing * 0.9) {
      r.cp = next;
      // Круг засчитывается ТОЛЬКО переходом «последний → 0»: отдельная линия
      // финиша даёт двойные засчёты при качании машины на линии.
      if (next === 0) {
        const now = performance.now();
        const lap = now - r.lapStartMs;
        if (r.lap > 0 && lap < r.bestLapMs) r.bestLapMs = lap;
        r.lapStartMs = now;
        r.lap++;
        if (r.lap > LAPS) r.finished = true;
        if (r.isPlayer) this.ctx.audio.playCoinPickup();
      }
    }
  }

  /** Позиция в заезде: круг → чекпойнт → близость к следующему. */
  private score(r: Racer): number {
    const d = this.track.checkpoints[(r.cp + 1) % CHECKPOINTS]
      .distanceTo(this.tmpB.set(r.car.x, 0, r.car.z));
    return r.lap * CHECKPOINTS + r.cp + (1 - Math.min(1, d / this.track.checkpointSpacing));
  }

  private standings(): Racer[] {
    return [...this.racers].sort((a, b) => this.score(b) - this.score(a));
  }

  private surfaceUnder(r: Racer): SurfaceId {
    this.track.sample(r.t, this.sample);
    const off = this.lateralOffset(r);
    const hw = this.sample.halfWidth;
    if (Math.abs(off) <= hw) return 'asphalt';
    if (Math.abs(off) <= hw + 3.5) return 'gravel';
    return 'grass';
  }

  /** Знаковое смещение от осевой линии в метрах. */
  private lateralOffset(r: Racer): number {
    this.track.sample(r.t, this.sample);
    const dx = r.car.x - this.sample.point.x;
    const dz = r.car.z - this.sample.point.z;
    return dx * this.sample.right.x + dz * this.sample.right.z;
  }

  /** Мягкие отбойники: возвращают на трассу, а не отправляют в космос. */
  private applyBounds(r: Racer): void {
    const off = this.lateralOffset(r);
    const limit = this.sample.halfWidth + 7;
    if (Math.abs(off) <= limit) return;
    const excess = Math.abs(off) - limit;
    const dir = Math.sign(off);
    r.car.x -= this.sample.right.x * dir * excess;
    r.car.z -= this.sample.right.z * dir * excess;
    r.car.vx *= 0.72;
    r.car.vz *= 0.72;
    if (r.isPlayer && excess > 0.4) this.ctx.addTrauma(0.18);
  }

  /** Слипстрим: видимый игроку механизм догоняния вместо невидимой резинки. */
  private applySlipstream(): void {
    for (const r of this.racers) {
      for (const other of this.racers) {
        if (other === r) continue;
        const dx = other.car.x - r.car.x;
        const dz = other.car.z - r.car.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 25 || dist < 1) continue;
        const dot = (dx * r.car.forwardX + dz * r.car.forwardZ) / dist;
        if (dot > 0.97) r.car.boost = Math.max(r.car.boost, (1 - dist / 25) * 0.18);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────── мир
  private buildWorld(): void {
    const road = new THREE.Mesh(
      this.track.buildRoadGeometry(),
      new THREE.MeshLambertMaterial({ color: 0x3a3a42, side: THREE.DoubleSide }),
    );
    road.receiveShadow = true;
    this.scene.add(road);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshLambertMaterial({ color: 0x4d6b3a }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Разметка чекпойнтов: та же кривая, никакой второй геометрии.
    const markers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.6, 0.9, 0.6),
      new THREE.MeshLambertMaterial({ color: 0xf5d76e }),
      CHECKPOINTS * 2,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < CHECKPOINTS; i++) {
      const t = i / CHECKPOINTS;
      this.track.sample(t, this.sample);
      for (let s = 0; s < 2; s++) {
        const dir = s === 0 ? -1 : 1;
        dummy.position.copy(this.sample.point)
          .addScaledVector(this.sample.right, dir * (this.sample.halfWidth + 1.2));
        dummy.position.y = 0.45;
        dummy.updateMatrix();
        markers.setMatrixAt(i * 2 + s, dummy.matrix);
      }
    }
    markers.instanceMatrix.needsUpdate = true;
    this.scene.add(markers);

    // Миникарта — проекция той же кривой, без второй геометрии трассы.
    const pts = this.track.curve.getSpacedPoints(160);
    this.minimap = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    );
    this.minimap.position.y = 0.1;
    this.minimap.visible = false;      // включается отладкой, не нужен в 3D-виде
    this.scene.add(this.minimap);
  }

  private spawnField(): void {
    const colors = [0x2ecc71, 0xe74c3c, 0xf1c40f, 0x9b59b6, 0xe67e22, 0x1abc9c];
    for (let i = 0; i < BOTS + 1; i++) {
      const isPlayer = i === 0;
      const mesh = buildCarMesh(colors[i % colors.length], isPlayer);
      this.scene.add(mesh);
      const racer: Racer = {
        car: new ArcadeCar(),
        mesh,
        isPlayer,
        t: 0, lap: 0, cp: 0,
        laneBias: (i % 2 === 0 ? -1 : 1) * (1.2 + (i % 3) * 0.9),
        baseMaxSpeed: DEFAULT_TUNING.maxSpeed * (isPlayer ? 1 : 0.94 + (i % 3) * 0.02),
        finished: false,
        bestLapMs: Infinity,
        lapStartMs: 0,
        name: isPlayer ? 'Вы' : `Бот ${i}`,
      };
      this.racers.push(racer);
      if (isPlayer) this.player = racer;
    }
  }

  private resetRace(): void {
    this.racers.forEach((r, i) => {
      const slot = this.track.gridSlot(i);
      r.car.reset(slot.pos.x, slot.pos.z, Math.atan2(slot.heading.x, slot.heading.z));
      r.t = this.track.nearestT(this.tmpA.set(r.car.x, 0, r.car.z));
      r.cp = CHECKPOINTS - 1;
      r.lap = 0;
      r.finished = false;
      r.bestLapMs = Infinity;
      r.lapStartMs = performance.now();
    });
    this.drift.reset();
    this.countdown = 3.999;
  }

  private updateCamera(dt: number): void {
    const car = this.player.car;
    const k = 1 - Math.exp(-6 * dt);
    if (this.chaseCam) {
      const dist = 11 + Math.min(5, car.speed * 0.12);
      this.camTarget.set(
        car.x - car.forwardX * dist,
        5.2 + car.speed * 0.03,
        car.z - car.forwardZ * dist,
      );
      this.camLook.set(car.x + car.forwardX * 6, 1.4, car.z + car.forwardZ * 6);
    } else {
      this.camTarget.set(car.x, 46, car.z + 26);
      this.camLook.set(car.x, 0, car.z);
    }
    this.camera.position.lerp(this.camTarget, k);
    this.camera.lookAt(this.camLook);
  }

  private pushStatus(): void {
    const order = this.standings();
    const place = order.indexOf(this.player) + 1;
    const car = this.player.car;
    const best = this.player.bestLapMs === Infinity ? '—' : fmt(this.player.bestLapMs);
    const cur = this.countdown > 0 ? '—' : fmt(performance.now() - this.player.lapStartMs);

    // Резинка применяется к параметрам ботов, не к их позиции.
    for (const r of this.racers) {
      if (r.isPlayer) continue;
      const gap = this.score(this.player) - this.score(r);
      r.car.tuning.maxSpeed = r.baseMaxSpeed * (1 + rubberBandFactor(gap));
    }

    const head = this.countdown > 0
      ? `<b>${Math.ceil(this.countdown - 1) || 'СТАРТ'}</b> · `
      : this.player.finished ? '<b>ФИНИШ</b> · ' : '';

    this.ctx.setStatus(
      `${head}место <b>${place}/${this.racers.length}</b>`
      // Первое пересечение нулевого чекпойнта — старт первого круга, а не завершённый круг.
      + ` · круг <b>${Math.max(1, Math.min(this.player.lap, LAPS))}/${LAPS}</b>`
      + ` · ${Math.round(car.speed * 3.6)} км/ч`
      + ` · занос <b>${car.slipAngle.toFixed(2)}</b> рад`
      + ` · дрифт <span class="hp">${this.drift.banked}</span>`
      + (this.drift.pending > 0 ? ` (+${Math.round(this.drift.pending)} ×${this.drift.multiplier})` : '')
      + ` · круг ${cur} · лучший ${best}`,
    );
  }
}

const IDLE_INPUT: CarInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };

function fmt(ms: number): string {
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
}
