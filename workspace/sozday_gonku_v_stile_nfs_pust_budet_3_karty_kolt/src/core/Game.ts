import * as THREE from 'three';
import { GameState, events } from './EventBus';
import { GAME_BALANCE, TRACKS } from './Constants';
import { physicsWorld } from '../physics/PhysicsWorld';
import { VehicleBuilder, VehicleVisuals } from '../world/VehicleBuilder';
import { TrackGenerator, TrackData } from '../world/TrackGenerator';
import { DriftAndNitroSystem } from '../game/DriftAndNitroSystem';
import { BotDriver } from '../game/BotDriver';
import { RenderManager } from '../rendering/RenderManager';
import { FXAndCameraRig } from '../rendering/FXAndCameraRig';
import { InputManager } from '../input/InputManager';
import { audio } from '../audio/AudioManager';
import { playgama } from '../platform/PlaygamaService';
import { ScreenRouter } from '../ui/ScreenRouter';
import { MainMenuScreen } from '../ui/screens/MainMenuScreen';
import { TrackSelectScreen } from '../ui/screens/TrackSelectScreen';
import { RaceHudScreen } from '../ui/screens/RaceHudScreen';
import { PauseModal } from '../ui/screens/PauseModal';
import { ResultsScreen } from '../ui/screens/ResultsScreen';

interface RacerState {
  visuals: VehicleVisuals;
  pos: THREE.Vector3;
  rot: THREE.Quaternion;
  vx: number;
  vz: number;
  speedKmh: number;
  slipAngleRad: number;
  slipRatio: number;
  lap: number;
  currentCp: number;
  progress: number;
  isBot: boolean;
  botDriver?: BotDriver;
}

export class Game {
  private renderManager: RenderManager;
  private cameraRig: FXAndCameraRig;
  private inputManager: InputManager;
  private screenRouter: ScreenRouter;

  private mainMenuScreen: MainMenuScreen;
  private trackSelectScreen: TrackSelectScreen;
  private raceHudScreen: RaceHudScreen;
  private pauseModal: PauseModal;
  private resultsScreen: ResultsScreen;

  private driftSystem: DriftAndNitroSystem;

  private currentState: GameState = 'MENU';
  private currentTrackId = 'downtown_loop';
  private currentTrackData: TrackData | null = null;

  // Race & Racers
  private playerRacer!: RacerState;
  private opponentRacers: RacerState[] = [];
  private raceTimeSec = 0;
  private isRaceOver = false;

  // Physics Fixed Step Accumulator
  private lastTime = 0;
  private accumulator = 0;
  private readonly FIXED_STEP = 1 / 60;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderManager = new RenderManager(canvas);
    this.cameraRig = new FXAndCameraRig(this.renderManager.camera, this.renderManager.scene);

    const touchLayer = document.getElementById('touch') as HTMLElement;
    this.inputManager = new InputManager(touchLayer);

    const screensLayer = document.getElementById('screens') as HTMLElement;
    this.screenRouter = new ScreenRouter(screensLayer);

    this.driftSystem = new DriftAndNitroSystem();

    // Screens
    this.mainMenuScreen = new MainMenuScreen(() => {
      events.emit('GAME_STATE_CHANGED', 'TRACK_SELECT');
    });
    this.trackSelectScreen = new TrackSelectScreen(
      (trackId) => {
        this.currentTrackId = trackId;
        events.emit('GAME_STATE_CHANGED', 'RACING');
      },
      () => {
        events.emit('GAME_STATE_CHANGED', 'MENU');
      }
    );
    this.raceHudScreen = new RaceHudScreen(() => {
      events.emit('GAME_STATE_CHANGED', 'PAUSED');
    });
    this.pauseModal = new PauseModal(
      () => {
        this.resumeGame();
      },
      () => {
        events.emit('GAME_STATE_CHANGED', 'RACING');
      },
      () => {
        events.emit('GAME_STATE_CHANGED', 'MENU');
      }
    );
    this.resultsScreen = new ResultsScreen(() => {
      events.emit('GAME_STATE_CHANGED', 'MENU');
    });

    this.screenRouter.register('MENU', this.mainMenuScreen);
    this.screenRouter.register('TRACK_SELECT', this.trackSelectScreen);
    this.screenRouter.register('RACING', this.raceHudScreen);
    this.screenRouter.register('PAUSED', this.pauseModal);
    this.screenRouter.register('RESULTS', this.resultsScreen);

    this.bindEvents();
  }

  private bindEvents(): void {
    events.on('GAME_STATE_CHANGED', (state: GameState) => {
      switch (state) {
        case 'MENU':
          this.setMenuState();
          break;
        case 'TRACK_SELECT':
          this.setTrackSelectState();
          break;
        case 'RACING':
          this.startRace(this.currentTrackId);
          break;
        case 'PAUSED':
          this.pauseGame();
          break;
        case 'RESULTS':
          this.showResults();
          break;
      }
    });

    events.on('VEHICLE_UPGRADED', (payload) => {
      if (this.playerRacer) {
        this.playerRacer.visuals.setUnderglowColor(payload.neonColorIndex);
      }
    });

    events.on('RACE_FINISHED', (payload) => {
      const prof = playgama.getProfile();
      if (!prof.highscores[payload.trackId]) {
        prof.highscores[payload.trackId] = { bestTimeSec: payload.timeSec, bestDriftScore: payload.driftScore, stars: payload.isWin ? 3 : 1 };
      } else {
        const cur = prof.highscores[payload.trackId];
        cur.bestTimeSec = Math.min(cur.bestTimeSec, payload.timeSec);
        cur.bestDriftScore = Math.max(cur.bestDriftScore, payload.driftScore);
      }
      playgama.saveDebounced();
    });
  }

  async initialize(): Promise<void> {
    await physicsWorld.initialize();
    this.setupGarageScene();
    this.setMenuState();

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private setupGarageScene(): void {
    const prof = playgama.getProfile();
    const visuals = VehicleBuilder.buildCar(0x0055ff, prof.selectedNeon, true);
    this.renderManager.scene.add(visuals.group);

    this.playerRacer = {
      visuals,
      pos: new THREE.Vector3(0, 0, 0),
      rot: new THREE.Quaternion(),
      vx: 0,
      vz: 0,
      speedKmh: 0,
      slipAngleRad: 0,
      slipRatio: 0,
      lap: 1,
      currentCp: 0,
      progress: 0,
      isBot: false,
    };
  }

  private setMenuState(): void {
    this.currentState = 'MENU';
    this.inputManager.hideTouch();
    this.screenRouter.go('MENU');

    if (this.currentTrackData) {
      this.renderManager.scene.remove(this.currentTrackData.visualGroup);
      this.currentTrackData = null;
    }
    this.clearOpponents();

    this.playerRacer.pos.set(0, 0, 0);
    this.playerRacer.rot.set(0, 0, 0, 1);
    this.playerRacer.visuals.group.position.set(0, 0, 0);
    this.playerRacer.visuals.group.quaternion.set(0, 0, 0, 1);
  }

  private setTrackSelectState(): void {
    this.currentState = 'TRACK_SELECT';
    this.inputManager.hideTouch();
    this.screenRouter.go('TRACK_SELECT');
  }

  private startRace(trackId: string): void {
    this.currentState = 'RACING';
    this.screenRouter.go('RACING');
    this.inputManager.showTouch();
    this.driftSystem.reset();
    this.raceTimeSec = 0;
    this.isRaceOver = false;

    // Remove previous track if any
    if (this.currentTrackData) {
      this.renderManager.scene.remove(this.currentTrackData.visualGroup);
    }
    this.clearOpponents();

    // Generate new track
    this.currentTrackData = TrackGenerator.buildTrack(trackId, this.renderManager.scene, physicsWorld);

    // Position Player
    this.playerRacer.pos.copy(this.currentTrackData.startPosition);
    this.playerRacer.rot.copy(this.currentTrackData.startRotation);
    this.playerRacer.vx = 0;
    this.playerRacer.vz = 0;
    this.playerRacer.speedKmh = 0;
    this.playerRacer.lap = 1;
    this.playerRacer.currentCp = 0;
    this.playerRacer.progress = 0;

    // Spawn 3 Opponent Bots
    const botColors = [0xdd1122, 0xffaa00, 0x8800ee];
    const laneOffsets = [-0.6, 0.6, 0.0];

    this.currentTrackData.opponentStarts.forEach((st, idx) => {
      const botVis = VehicleBuilder.buildCar(botColors[idx], idx + 1, false);
      this.renderManager.scene.add(botVis.group);

      this.opponentRacers.push({
        visuals: botVis,
        pos: st.position.clone(),
        rot: st.rotation.clone(),
        vx: 0,
        vz: 0,
        speedKmh: 0,
        slipAngleRad: 0,
        slipRatio: 0,
        lap: 1,
        currentCp: 0,
        progress: 0,
        isBot: true,
        botDriver: new BotDriver(laneOffsets[idx], 0.92 + idx * 0.04),
      });
    });
  }

  private pauseGame(): void {
    this.currentState = 'PAUSED';
    this.inputManager.hideTouch();
    this.screenRouter.go('PAUSED');
  }

  private resumeGame(): void {
    this.currentState = 'RACING';
    this.inputManager.showTouch();
    this.screenRouter.go('RACING');
    this.lastTime = performance.now();
  }

  private showResults(): void {
    this.currentState = 'RESULTS';
    this.inputManager.hideTouch();
    this.screenRouter.go('RESULTS');
  }

  private clearOpponents(): void {
    this.opponentRacers.forEach((opp) => {
      this.renderManager.scene.remove(opp.visuals.group);
    });
    this.opponentRacers = [];
  }

  private loop(currentTime: number): void {
    requestAnimationFrame((t) => this.loop(t));

    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    if (this.currentState === 'RACING') {
      this.accumulator += dt;
      while (this.accumulator >= this.FIXED_STEP) {
        this.fixedPhysicsUpdate(this.FIXED_STEP);
        this.accumulator -= this.FIXED_STEP;
      }
      this.raceTimeSec += dt;
    }

    this.renderUpdate(dt);
  }

  private fixedPhysicsUpdate(dt: number): void {
    if (!this.currentTrackData) return;

    // 1. Process Player Input & Vehicle Physics
    const input = this.inputManager.getInput();
    const prof = playgama.getProfile();

    // Apply upgrade tuning
    const enginePower = 15.0 + prof.upgrades.engine * 1.5;
    const topSpeedMs = (190 + prof.upgrades.engine * 10) / 3.6;

    this.simulateCarPhysics(this.playerRacer, input, dt, enginePower, topSpeedMs);

    // 2. Drift, Near-Miss and Nitro System Update
    const distToBarrier = this.computeDistanceToTrackEdge(this.playerRacer.pos);
    const driftState = this.driftSystem.update(
      dt,
      this.playerRacer.speedKmh,
      this.playerRacer.slipAngleRad,
      this.playerRacer.slipRatio,
      distToBarrier,
      input.nitro
    );

    // Apply Nitro thrust if boosting
    if (driftState.isNitroBoosting) {
      const fwdX = Math.sin(this.getYaw(this.playerRacer.rot));
      const fwdZ = Math.cos(this.getYaw(this.playerRacer.rot));
      this.playerRacer.vx += fwdX * 22.0 * dt;
      this.playerRacer.vz += fwdZ * 22.0 * dt;
    }

    // 3. Update Audio Synthesizer
    const rpmRatio = Math.min(1.0, this.playerRacer.speedKmh / 230);
    audio.updateEngine(rpmRatio, input.throttle, this.playerRacer.speedKmh, driftState.isNitroBoosting);
    audio.updateDrift(driftState.slipRatio, this.playerRacer.speedKmh);
    audio.updateNitro(driftState.isNitroBoosting);

    // 4. Update Opponent Bots
    this.opponentRacers.forEach((opp) => {
      const distToPlayer = opp.pos.distanceTo(this.playerRacer.pos);
      const botInput = opp.botDriver!.computeInput(
        opp.pos,
        opp.rot,
        opp.speedKmh,
        this.currentTrackData!.curve,
        this.currentTrackData!.totalLength,
        opp.progress,
        distToPlayer
      );
      this.simulateCarPhysics(opp, botInput, dt, 15.5, 58.0);
    });

    // 5. Update Race Progress, Checkpoints & Laps
    this.updateRaceCheckpoints();

    // 6. Emit Events for UI HUD
    const gear = Math.min(6, Math.max(1, Math.floor(this.playerRacer.speedKmh / 40) + 1));
    events.emit('SPEED_CHANGED', {
      speedKmh: this.playerRacer.speedKmh,
      rpm: rpmRatio * 7500,
      gear,
    });

    events.emit('NITRO_CHANGED', {
      nitroRatio: driftState.nitroRatio,
      bottles: Math.floor(driftState.nitroRatio),
      isBoosting: driftState.isNitroBoosting,
    });

    events.emit('DRIFT_STATE_CHANGED', {
      isDrifting: driftState.isDrifting,
      score: driftState.currentComboScore,
      multiplier: driftState.comboMultiplier,
      angleDeg: driftState.driftAngleDeg,
      isNearMiss: driftState.isNearMiss,
    });

    // 7. Check Race Win / Loss Finish Conditions
    this.checkFinishConditions(driftState.driftScoreTotal);
  }

  private simulateCarPhysics(
    racer: RacerState,
    input: { steer: number; throttle: number; brake: number; handbrake: boolean },
    dt: number,
    enginePower: number,
    maxSpeedMs: number
  ): void {
    let yaw = this.getYaw(racer.rot);

    // Speed damping and steering angle
    const speed = Math.hypot(racer.vx, racer.vz);
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    const rightX = fwdZ;
    const rightZ = -fwdX;

    const fwdSpeed = racer.vx * fwdX + racer.vz * fwdZ;
    let latSpeed = racer.vx * rightX + racer.vz * rightZ;

    // Steering rotation with speed damping
    const steerRate = 2.4;
    const speedFactor = Math.max(0.35, 1 - (speed / 70) * 0.55);
    yaw += input.steer * steerRate * speedFactor * dt * Math.sign(fwdSpeed || 1);

    // Acceleration & Braking
    let newFwdSpeed = fwdSpeed + input.throttle * enginePower * dt;
    newFwdSpeed -= input.brake * 28.0 * dt * Math.sign(newFwdSpeed || 1);
    newFwdSpeed -= newFwdSpeed * 0.005 * speed * dt; // Aerodynamic drag
    newFwdSpeed = Math.max(-12.0, Math.min(maxSpeedMs, newFwdSpeed));

    // Lateral Grip & Handbrake Drift Sensation
    const baseGrip = input.handbrake ? GAME_BALANCE.drift.lateralGripDropCoeff * 18.0 : 16.0;
    const latDrop = baseGrip * dt;
    latSpeed = Math.abs(latSpeed) <= latDrop ? 0 : latSpeed - Math.sign(latSpeed) * latDrop;

    racer.vx = fwdX * newFwdSpeed + rightX * latSpeed;
    racer.vz = fwdZ * newFwdSpeed + rightZ * latSpeed;

    racer.pos.x += racer.vx * dt;
    racer.pos.z += racer.vz * dt;

    racer.rot.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    racer.speedKmh = speed * 3.6;
    racer.slipRatio = Math.abs(latSpeed) / Math.max(1, speed);
    racer.slipAngleRad = Math.abs(Math.atan2(latSpeed, Math.abs(fwdSpeed) || 1));

    racer.visuals.setBraking(input.brake > 0.2);
  }

  private getYaw(quat: THREE.Quaternion): number {
    const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
    return euler.y;
  }

  private computeDistanceToTrackEdge(pos: THREE.Vector3): number {
    if (!this.currentTrackData) return 999;
    const halfW = this.currentTrackData.roadWidth / 2;
    const cp = this.currentTrackData.checkpoints[this.playerRacer.currentCp];
    if (!cp) return halfW;
    const distToCenter = pos.distanceTo(cp.position);
    return Math.max(0.1, halfW - distToCenter);
  }

  private updateRaceCheckpoints(): void {
    if (!this.currentTrackData) return;
    const cps = this.currentTrackData.checkpoints;
    const totalCps = cps.length;
    const trackDef = TRACKS[this.currentTrackId] || TRACKS['downtown_loop'];

    // Update Player CP
    const nextCpIdx = (this.playerRacer.currentCp + 1) % totalCps;
    if (this.playerRacer.pos.distanceTo(cps[nextCpIdx].position) < cps[nextCpIdx].radius) {
      this.playerRacer.currentCp = nextCpIdx;
      if (nextCpIdx === 0) {
        this.playerRacer.lap++;
      }
    }
    this.playerRacer.progress = (this.playerRacer.lap - 1) + (this.playerRacer.currentCp / totalCps);

    // Update Opponents CP
    this.opponentRacers.forEach((opp) => {
      const oppNext = (opp.currentCp + 1) % totalCps;
      if (opp.pos.distanceTo(cps[oppNext].position) < cps[oppNext].radius) {
        opp.currentCp = oppNext;
        if (oppNext === 0) {
          opp.lap++;
        }
      }
      opp.progress = (opp.lap - 1) + (opp.currentCp / totalCps);
    });

    // Determine Standings Position
    const allRacers = [this.playerRacer, ...this.opponentRacers];
    allRacers.sort((a, b) => b.progress - a.progress);
    const playerPos = allRacers.indexOf(this.playerRacer) + 1;

    events.emit('RACE_PROGRESS_CHANGED', {
      lap: Math.min(trackDef.totalLaps, this.playerRacer.lap),
      totalLaps: trackDef.totalLaps,
      position: playerPos,
      totalRacers: 4,
      progress: this.playerRacer.progress,
      timeSec: this.raceTimeSec,
    });
  }

  private checkFinishConditions(driftScore: number): void {
    if (this.isRaceOver || !this.currentTrackData) return;
    const trackDef = TRACKS[this.currentTrackId] || TRACKS['downtown_loop'];

    const isLapFinished = this.playerRacer.lap > trackDef.totalLaps;
    const isDriftFinished = trackDef.type === 'drift' && (driftScore >= trackDef.targetDriftScore || this.playerRacer.lap > trackDef.totalLaps);

    if (isLapFinished || isDriftFinished) {
      this.isRaceOver = true;
      const allRacers = [this.playerRacer, ...this.opponentRacers];
      allRacers.sort((a, b) => b.progress - a.progress);
      const playerPos = allRacers.indexOf(this.playerRacer) + 1;

      let isWin = false;
      if (trackDef.type === 'drift') {
        isWin = driftScore >= trackDef.targetDriftScore;
      } else {
        isWin = playerPos === 1;
      }

      const reward = isWin ? trackDef.rewardCredits : Math.floor(trackDef.rewardCredits * 0.4);
      const prof = playgama.getProfile();
      prof.credits += reward;
      prof.repPoints += isWin ? trackDef.rewardRep : Math.floor(trackDef.rewardRep * 0.4);
      prof.repTier = Math.min(5, Math.floor(prof.repPoints / 500) + 1);
      playgama.saveDebounced();

      if (isWin) {
        audio.playVictory();
      }

      this.resultsScreen.setResults(playerPos, this.raceTimeSec, driftScore, reward, isWin);

      events.emit('RACE_FINISHED', {
        position: playerPos,
        timeSec: this.raceTimeSec,
        driftScore,
        creditsEarned: reward,
        isWin,
        trackId: this.currentTrackId,
      });

      events.emit('GAME_STATE_CHANGED', 'RESULTS');
    }
  }

  private renderUpdate(dt: number): void {
    // 1. Sync visual meshes with physics bodies
    if (this.playerRacer) {
      this.playerRacer.visuals.group.position.copy(this.playerRacer.pos);
      this.playerRacer.visuals.group.quaternion.copy(this.playerRacer.rot);
    }

    this.opponentRacers.forEach((opp) => {
      opp.visuals.group.position.copy(opp.pos);
      opp.visuals.group.quaternion.copy(opp.rot);
    });

    // 2. Camera and Visual Effects
    const isMenu = this.currentState === 'MENU' || this.currentState === 'TRACK_SELECT';
    const isBoosting = this.driftSystem.update(0, 0, 0, 0, 99, false).isNitroBoosting;

    if (this.playerRacer) {
      this.cameraRig.update(
        dt,
        this.playerRacer.pos,
        this.playerRacer.rot,
        this.playerRacer.speedKmh,
        this.playerRacer.slipAngleRad,
        isBoosting,
        isMenu
      );

      // VFX Particles on track
      if (this.currentState === 'RACING') {
        if (this.playerRacer.slipRatio > 0.3) {
          const rearL = this.playerRacer.pos.clone().add(new THREE.Vector3(-0.8, 0.1, -1.2).applyQuaternion(this.playerRacer.rot));
          const rearR = this.playerRacer.pos.clone().add(new THREE.Vector3(0.8, 0.1, -1.2).applyQuaternion(this.playerRacer.rot));
          this.cameraRig.spawnDriftSmoke(rearL, this.playerRacer.slipRatio);
          this.cameraRig.spawnDriftSmoke(rearR, this.playerRacer.slipRatio);
        }

        if (isBoosting) {
          const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.playerRacer.rot);
          this.playerRacer.visuals.exhaustPositions.forEach((ex) => {
            const worldEx = ex.clone().applyQuaternion(this.playerRacer.rot).add(this.playerRacer.pos);
            this.cameraRig.spawnNitroFlame(worldEx, fwd);
          });
        }
      }
    }

    // 3. Render Three.js frame
    this.renderManager.render();
  }
}
