import * as THREE from 'three';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { RacingTrack3D, CHECKPOINTS } from '../world/RacingTrack3D';
import { RacingCarController, type RacingCarInput } from '../vehicle/RacingCarController';
import { RacingVFX } from '../rendering/RacingVFX';

const LAPS = 3;
const BOTS = 5;

interface RacerEntry {
  controller: RacingCarController;
  isPlayer: boolean;
  t: number;
  lap: number;
  cp: number;
  laneBias: number;
  basePowerMultiplier: number;
  name: string;
  finished: boolean;
  bestLapMs: number;
  lapStartMs: number;
  stuckTimer: number;
  wheelBaseId: number;
}

export class RacingDemo implements Demo {
  readonly id = 'racing';
  readonly title = ['🏁 Гонка: трасса и соперники (Rapier 3D)', '🏁 Racing: track & rivals (Rapier 3D)'] as const;
  readonly hint = [
    '<b>W</b>/<b>S</b> газ и тормоз · <b>A</b>/<b>D</b> руль · <b>Space</b> ручник (дрифт) · <b>C</b> камера · <b>R</b> рестарт',
    '<b>W</b>/<b>S</b> throttle & brake · <b>A</b>/<b>D</b> steer · <b>Space</b> handbrake (drift) · <b>C</b> camera · <b>R</b> restart',
  ] as const;
  readonly category = ['🚚 Физика и транспорт', '🚚 Physics & Vehicles'] as const;
  readonly tags = ['гонка', 'трасса', 'соперники', 'дрифт', 'rapier3d', 'физика', 'racing', 'car', 'drift', 'opponents'] as const;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(56, 1, 0.4, 850);

  private ctx!: DemoContext;
  private physics!: PhysicsWorld;
  private track!: RacingTrack3D;
  private vfx!: RacingVFX;

  private racers: RacerEntry[] = [];
  private playerRacer!: RacerEntry;
  private playerCar!: RacingCarController;

  private camMode: 'chase' | 'hood' | 'orbit' = 'chase';
  private readonly camTarget = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();
  private readonly smoothedForward = new THREE.Vector3(0, 0, 1);

  private unsubscribe: (() => void) | null = null;
  private statusTimer = 0;
  private countdown = 3.999;
  private raceStartMs = 0;
  private lastBeep = 4;

  async init(ctx: DemoContext): Promise<void> {
    this.ctx = ctx;

    this.physics = new PhysicsWorld();
    await this.physics.initialize();

    // Scene Sky & Fog
    const skyColor = new THREE.Color(0x8bb8e8);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.Fog(skyColor, 120, 560);

    const sun = new THREE.DirectionalLight(0xfffae0, 2.8);
    sun.position.set(-70, 110, 50);
    sun.castShadow = ctx.tier === 'high';
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -95;
    sun.shadow.camera.right = 95;
    sun.shadow.camera.top = 95;
    sun.shadow.camera.bottom = -95;
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 300;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun, sun.target);

    this.scene.add(new THREE.HemisphereLight(0xddeeff, 0x445533, 1.8));

    // Build 3D Track & Terrain
    this.track = new RacingTrack3D();
    this.track.buildWorld(this.scene, this.physics);

    // Initialize VFX (skidmarks, smoke, sparks)
    this.vfx = new RacingVFX(this.scene, 24);

    // Spawn Field
    this.spawnField();
    this.resetRace();
  }

  enter(): void {
    this.unsubscribe = this.ctx.input.onKey((code) => {
      if (code === 'KeyC') {
        this.camMode = this.camMode === 'chase' ? 'hood' : (this.camMode === 'hood' ? 'orbit' : 'chase');
      }
      if (code === 'KeyR') {
        this.recoverPlayer();
      }
    });
    this.ctx.audio.startEngine();
  }

  exit(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.ctx.audio.stopEngine();
  }

  fixedUpdate(dt: number): void {
    const isStarting = this.countdown > 0;
    if (isStarting) {
      this.countdown -= dt;
      const currentBeep = Math.ceil(this.countdown);
      if (currentBeep !== this.lastBeep && currentBeep > 0) {
        this.lastBeep = currentBeep;
        this.ctx.audio.playDash();
      }
      if (this.countdown <= 0) {
        this.raceStartMs = performance.now();
        this.ctx.audio.playCoinPickup();
        this.ctx.addTrauma(0.2);
      }
    }

    // 1. Compute Inputs for all cars (Player + Bots)
    const inputs: RacingCarInput[] = [];

    for (const r of this.racers) {
      if (isStarting) {
        inputs.push({ throttle: 0, brake: 1.0, steer: 0, handbrake: true });
      } else if (r.isPlayer) {
        inputs.push(this.readPlayerInput());
      } else {
        inputs.push(this.driveBotAI(r, dt));
      }
    }

    // 2. Pre-Step Phase: Apply driving forces & update wheel raycasts
    for (let i = 0; i < this.racers.length; i++) {
      this.racers[i].controller.fixedUpdate(dt, inputs[i]);
    }

    // 3. Physics Step: Rapier integrates all rigid bodies
    this.physics.step();

    // 4. Post-Step Phase: Read transforms, velocities, drift scoring
    for (let i = 0; i < this.racers.length; i++) {
      const racer = this.racers[i];
      racer.controller.postStep(dt);
      this.updateRacerProgress(racer, dt);
      this.updateRacerVFX(racer, inputs[i], dt);
    }

    // Dynamic Rubber-Banding for Competitive Field
    this.applyRubberBanding();
  }

  update(dt: number, alpha: number): void {
    // Sub-step render interpolation for all cars
    for (const r of this.racers) {
      r.controller.render(alpha);
    }

    // Update VFX & Start Lights
    this.vfx.update(dt);
    this.track.updateStartLights(this.countdown);

    // Engine Audio
    const rpmRatio = Math.min(1.0, this.playerCar.speed / 185);
    const throttle = this.readPlayerInput().throttle;
    this.ctx.audio.updateEngineRPM(rpmRatio, throttle);

    // Dynamic 3D Chase Camera
    this.updateCamera(dt);

    // Status / HUD
    this.statusTimer += dt;
    if (this.statusTimer > 0.08) {
      this.statusTimer = 0;
      this.pushStatus();
    }
  }

  dispose(): void {
    this.exit();
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  private readPlayerInput(): RacingCarInput {
    const inp = this.ctx.input;
    const snap = inp.vehicleSnapshot();

    const up = inp.isDown('KeyW') || inp.isDown('ArrowUp');
    const down = inp.isDown('KeyS') || inp.isDown('ArrowDown');
    const left = inp.isDown('KeyA') || inp.isDown('ArrowLeft');
    const right = inp.isDown('KeyD') || inp.isDown('ArrowRight');

    const rawSteer = (right ? 1 : 0) - (left ? 1 : 0);
    const steer = snap.steer || rawSteer;

    return {
      throttle: Math.max(snap.throttle, up ? 1 : 0),
      brake: Math.max(snap.brake, down ? 1 : 0),
      steer: THREE.MathUtils.clamp(steer, -1, 1),
      handbrake: snap.handbrake || inp.isDown('Space'),
      recover: inp.isDown('KeyR'),
    };
  }

  private driveBotAI(racer: RacerEntry, dt: number): RacingCarInput {
    const car = racer.controller;
    const speed = car.speed;
    const t = racer.t;

    // Lookahead expands with speed
    const lookaheadMeters = 7.5 + speed * 0.28;
    const targetT = (t + lookaheadMeters / this.track.length) % 1;

    // Target point on the 3D racing line with bot's lane bias
    const target = this.track.pointOnRacingLine(targetT)
      .addScaledVector(this.track.rightAt(targetT), racer.laneBias);

    // Local coordinates of target point
    const toTarget = target.clone().sub(car.position);
    const invRot = car.rotation.clone().invert();
    toTarget.applyQuaternion(invRot);

    let steer = 0;
    if (toTarget.z < 0) {
      // Facing backward: orient towards track tangent
      const trackTan = this.track.tangentAt(t).applyQuaternion(invRot);
      steer = THREE.MathUtils.clamp(trackTan.x * 2.2, -1, 1);
    } else {
      steer = THREE.MathUtils.clamp(toTarget.x * 1.6, -1, 1);
    }

    // Safe entry speed based on 3D track curvature ahead
    const curveRadius = this.track.curvatureRadiusAhead(targetT, 25);
    const maxSafeSpeed = Math.sqrt(curveRadius * 36) * 3.6; // km/h

    let throttle = 1.0;
    let brake = 0.0;

    if (speed > maxSafeSpeed * 1.06) {
      throttle = 0;
      brake = Math.min(1.0, (speed - maxSafeSpeed) / 14);
    } else if (speed > maxSafeSpeed * 0.96) {
      throttle = 0.35;
      brake = 0;
    }

    // Dynamic Lane Bias shift for overtaking nearby cars
    for (const other of this.racers) {
      if (other === racer) continue;
      const d = car.position.distanceTo(other.controller.position);
      if (d < 6.5 && toTarget.z > 0) {
        const sign = racer.laneBias >= 0 ? 0.4 : -0.4;
        racer.laneBias = THREE.MathUtils.clamp(racer.laneBias + sign * dt, -2.2, 2.2);
      }
    }

    return {
      throttle,
      brake,
      steer,
      handbrake: false,
    };
  }

  private updateRacerVFX(racer: RacerEntry, input: RacingCarInput, dt: number): void {
    const car = racer.controller;
    const baseId = racer.wheelBaseId;
    const shouldSkid = (car.isDrifting && car.speed > 15) || (input.brake > 0.4 && car.speed > 25);

    for (let i = 0; i < 4; i++) {
      const wheelId = baseId + i;
      const isRear = i >= 2;
      const wheelPos = car.interpPosition.clone()
        .addScaledVector(car.interpForward, isRear ? -1.25 : 1.25)
        .addScaledVector(new THREE.Vector3(-car.interpForward.z, 0, car.interpForward.x).normalize(), (i % 2 === 0 ? -0.88 : 0.88))
        .setY(car.interpPosition.y - 0.28);

      if (shouldSkid) {
        this.vfx.addSkid(wheelId, wheelPos, car.interpForward, 0.16, 0.85);
        if (Math.random() < 0.35) {
          this.vfx.emitTireSmoke(wheelPos, car.interpForward, isRear ? 1.0 : 0.5);
        }
      } else {
        this.vfx.breakSkid(wheelId);
      }
    }

    // Exhaust Backfire Sparks & Flames on Player full throttle
    if (racer.isPlayer && input.throttle > 0.8 && car.speed > 80 && Math.random() < 0.08) {
      const exhaustPos = car.interpPosition.clone()
        .addScaledVector(car.interpForward, -1.98)
        .setY(car.interpPosition.y + 0.04);
      this.vfx.emitExhaustFlame(exhaustPos, car.interpForward);
      this.vfx.emitSparks(exhaustPos, car.interpForward);
    }
  }

  private updateRacerProgress(r: RacerEntry, dt: number): void {
    const car = r.controller;
    r.t = this.track.nearestT(car.position, r.t);

    const nextCp = (r.cp + 1) % CHECKPOINTS;
    const distToCp = car.position.distanceTo(this.track.checkpoints[nextCp]);

    // Stuck check & recovery for bots
    if (!r.isPlayer) {
      if (car.speed < 2.0 && this.countdown <= 0) {
        r.stuckTimer += dt;
        if (r.stuckTimer > 3.0) {
          this.recoverBot(r);
        }
      } else {
        r.stuckTimer = 0;
      }
    }

    if (distToCp < this.track.checkpointSpacing * 1.2) {
      r.cp = nextCp;
      if (nextCp === 0) {
        const now = performance.now();
        const lapTime = now - r.lapStartMs;
        if (r.lap > 0 && lapTime < r.bestLapMs) {
          r.bestLapMs = lapTime;
        }
        r.lapStartMs = now;
        r.lap++;
        if (r.lap > LAPS) {
          r.finished = true;
        }
        if (r.isPlayer) {
          this.ctx.audio.playCoinPickup();
          this.ctx.addTrauma(0.15);
        }
      }
    }
  }

  private scoreRacer(r: RacerEntry): number {
    const nextCp = (r.cp + 1) % CHECKPOINTS;
    const dist = r.controller.position.distanceTo(this.track.checkpoints[nextCp]);
    return r.lap * CHECKPOINTS + r.cp + (1 - Math.min(1, dist / this.track.checkpointSpacing));
  }

  private getStandings(): RacerEntry[] {
    return [...this.racers].sort((a, b) => this.scoreRacer(b) - this.scoreRacer(a));
  }

  private applyRubberBanding(): void {
    const playerScore = this.scoreRacer(this.playerRacer);
    for (const r of this.racers) {
      if (r.isPlayer) continue;
      const gap = playerScore - this.scoreRacer(r);
      const factor = THREE.MathUtils.clamp(gap * 0.035, -0.12, 0.18);
      r.controller.spec.engine.baseForce = 4200 * r.basePowerMultiplier * (1 + factor);
    }
  }

  private spawnField(): void {
    this.racers = [];

    const botColors = [0x2266dd, 0xddaa11, 0x22aa44, 0x8822cc, 0xee6611];
    const botNames = ['Бот Apex', 'Бот Turbo', 'Бот Drift', 'Бот Shadow', 'Бот Storm'];

    // 1. Player Sports Car (Red GT)
    this.playerCar = new RacingCarController(this.physics, this.scene, true, 0xdd2222);
    const pSlot = this.track.gridSlot(0);
    this.playerCar.build(pSlot.pos, Math.atan2(pSlot.heading.x, pSlot.heading.z));

    this.playerRacer = {
      controller: this.playerCar,
      isPlayer: true,
      t: 0,
      lap: 0,
      cp: 0,
      laneBias: 0,
      basePowerMultiplier: 1.0,
      name: 'Вы',
      finished: false,
      bestLapMs: Infinity,
      lapStartMs: 0,
      stuckTimer: 0,
      wheelBaseId: 0,
    };
    this.racers.push(this.playerRacer);

    // 2. 5 Opponent Bots
    for (let i = 0; i < BOTS; i++) {
      const slot = this.track.gridSlot(i + 1);
      const botCar = new RacingCarController(this.physics, this.scene, false, botColors[i]);
      botCar.build(slot.pos, Math.atan2(slot.heading.x, slot.heading.z));

      this.racers.push({
        controller: botCar,
        isPlayer: false,
        t: 0,
        lap: 0,
        cp: 0,
        laneBias: (i % 2 === 0 ? -1.6 : 1.6),
        basePowerMultiplier: 0.93 + (i % 3) * 0.03,
        name: botNames[i],
        finished: false,
        bestLapMs: Infinity,
        lapStartMs: 0,
        stuckTimer: 0,
        wheelBaseId: (i + 1) * 4,
      });
    }
  }

  private resetRace(): void {
    this.countdown = 3.999;
    this.lastBeep = 4;
    this.racers.forEach((r, i) => {
      const slot = this.track.gridSlot(i);
      const heading = Math.atan2(slot.heading.x, slot.heading.z);
      r.controller.reset(slot.pos, heading);
      r.t = this.track.nearestT(slot.pos);
      r.cp = CHECKPOINTS - 1;
      r.lap = 0;
      r.finished = false;
      r.bestLapMs = Infinity;
      r.lapStartMs = performance.now();
      r.stuckTimer = 0;
    });

    const pSlot = this.track.gridSlot(0);
    this.smoothedForward.set(pSlot.heading.x, 0, pSlot.heading.z).normalize();
  }

  private recoverPlayer(): void {
    const t = this.track.nearestT(this.playerCar.position);
    const sample = this.track.sample(t, {
      point: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      halfWidth: 8,
    });
    const respawnPos = sample.point.clone().addScaledVector(sample.up, 0.40);
    const heading = Math.atan2(sample.tangent.x, sample.tangent.z);
    this.playerCar.reset(respawnPos, heading);
    this.smoothedForward.set(sample.tangent.x, 0, sample.tangent.z).normalize();
  }

  private recoverBot(r: RacerEntry): void {
    r.stuckTimer = 0;
    const sample = this.track.sample(r.t, {
      point: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      halfWidth: 8,
    });
    const respawnPos = sample.point.clone()
      .addScaledVector(sample.right, r.laneBias)
      .addScaledVector(sample.up, 0.40);
    const heading = Math.atan2(sample.tangent.x, sample.tangent.z);
    r.controller.reset(respawnPos, heading);
  }

  private updateCamera(dt: number): void {
    const car = this.playerCar;
    const targetPos = car.interpPosition;
    const forward = car.interpForward;

    const forwardXZ = new THREE.Vector3(forward.x, 0, forward.z).normalize();
    const forwardSmooth = 1 - Math.exp(-9 * dt);
    this.smoothedForward.lerp(forwardXZ, forwardSmooth).normalize();

    if (this.camMode === 'chase') {
      const dist = 7.4 + Math.min(2.8, (car.speed / 200) * 2.8);
      const height = 2.4 + Math.min(0.6, (car.speed / 200) * 0.6);

      this.camTarget.copy(targetPos)
        .addScaledVector(this.smoothedForward, -dist)
        .setY(targetPos.y + height);

      this.camLook.copy(targetPos).addScaledVector(this.smoothedForward, 5.5).setY(targetPos.y + 0.85);

      const posSmooth = 1 - Math.exp(-8 * dt);
      const lookSmooth = 1 - Math.exp(-12 * dt);

      this.camera.position.lerp(this.camTarget, posSmooth);
      this.camera.lookAt(this.camLook);
    } else if (this.camMode === 'hood') {
      this.camTarget.copy(targetPos).addScaledVector(forward, 0.35).setY(targetPos.y + 0.85);
      this.camLook.copy(targetPos).addScaledVector(forward, 15.0).setY(targetPos.y + 0.75);
      this.camera.position.copy(this.camTarget);
      this.camera.lookAt(this.camLook);
    } else {
      // Orbit / High Overview
      this.camTarget.set(targetPos.x, targetPos.y + 34, targetPos.z + 22);
      this.camLook.copy(targetPos);
      this.camera.position.lerp(this.camTarget, 1 - Math.exp(-6 * dt));
      this.camera.lookAt(this.camLook);
    }
  }

  private pushStatus(): void {
    const standings = this.getStandings();
    const place = standings.indexOf(this.playerRacer) + 1;
    const car = this.playerCar;
    const bestStr = this.playerRacer.bestLapMs === Infinity ? '—' : formatTime(this.playerRacer.bestLapMs);
    const curStr = this.countdown > 0 ? '—' : formatTime(performance.now() - this.playerRacer.lapStartMs);

    const head = this.countdown > 0
      ? `<b>${Math.ceil(this.countdown) || 'СТАРТ!'}</b> · `
      : (this.playerRacer.finished ? '<b>ФИНИШ!</b> · ' : '');

    this.ctx.setStatus(
      `${head}место <b>${place}/${this.racers.length}</b>`
      + ` · круг <b>${Math.max(1, Math.min(this.playerRacer.lap, LAPS))}/${LAPS}</b>`
      + ` · скорость <b>${Math.round(car.speed)}</b> км/ч`
      + (car.isDrifting ? ` · <span style="color:#ff9900"><b>ДРИФТ!</b></span>` : '')
      + (car.driftPoints > 0 ? ` · очки <b>${car.driftPoints}</b> (×${car.driftMultiplier.toFixed(1)})` : '')
      + ` · текущий ${curStr} · лучший ${bestStr}`,
    );
  }
}

function formatTime(ms: number): string {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${m}:${sec}`;
}
