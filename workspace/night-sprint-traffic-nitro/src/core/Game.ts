import * as THREE from 'three';
import { physicsWorld } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import { VehicleController } from '../simulation/VehicleController';
import { HighwayStreamer } from '../rendering/HighwayStreamer';
import { TrafficManager } from '../simulation/TrafficManager';
import { adrenalineSystem } from '../gameplay/AdrenalineSystem';
import { checkpointTimeTrialSystem } from '../gameplay/CheckpointTimeTrialSystem';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { TireTracksManager } from '../rendering/TireTracksManager';
import { proceduralModels } from '../rendering/ProceduralModels';
import { TouchControls } from '../ui/TouchControls';
import { uiManager } from '../ui/UIManager';
import { audioManager } from '../audio/AudioManager';
import { engineSynthesizer } from '../audio/EngineSynthesizer';
import { musicSynthesizer } from '../audio/MusicSynthesizer';
import { gameStateManager } from './GameState';
import { storageService } from '../platform/StorageService';
import { playgamaService } from '../platform/PlaygamaService';
import { eventBus } from './EventBus';
import { telemetryService } from '../telemetry/Telemetry';
import { GameLoop } from './GameLoop';
import { CAR_CATALOG, TRACK_CATALOG } from './Config';
import { CarDefinition, CarUpgrades } from '../types';

export class Game {
  private sceneManager: SceneManager;
  private vehicle: VehicleController;
  private highway: HighwayStreamer;
  private traffic: TrafficManager;
  private particles: ParticleSystem;
  private skidmarks: TireTracksManager;
  private touchControls: TouchControls;
  private loop: GameLoop;

  private garageAngle = 0;

  constructor(canvasEl: HTMLCanvasElement, uiContainer: HTMLElement) {
    this.sceneManager = new SceneManager(canvasEl);
    this.vehicle = new VehicleController(physicsWorld);
    this.sceneManager.scene.add(this.vehicle.chassisGroup);

    this.highway = new HighwayStreamer(this.sceneManager.scene, physicsWorld);
    this.traffic = new TrafficManager(this.sceneManager.scene);
    this.particles = new ParticleSystem(this.sceneManager.scene);
    this.skidmarks = new TireTracksManager(this.sceneManager.scene);

    this.touchControls = new TouchControls();
    this.touchControls.mount(uiContainer);
    uiManager.mount(uiContainer);

    this.loop = new GameLoop(
      (dt) => this.onFixedUpdate(dt),
      (alpha, dt) => this.onRender(alpha, dt)
    );

    this.setupEventListeners();
  }

  async initialize(): Promise<void> {
    await playgamaService.initialize();
    await physicsWorld.initialize();
    this.highway.initPhysics();

    const save = storageService.getData();
    const carDef = CAR_CATALOG.find((c) => c.id === save.selectedCarId) || CAR_CATALOG[0];
    const upgrades: CarUpgrades = save.carUpgrades[carDef.id] || {
      engineStage: 1,
      nitroStage: 1,
      handlingStage: 1,
      weightStage: 1,
      bodyColor: carDef.defaultBodyColor,
      neonColor: carDef.defaultNeonColor,
    };

    this.buildPlayerCarMesh(carDef, upgrades);
    this.vehicle.build(new THREE.Vector3(1.8, 0.5, 0), carDef, upgrades);

    gameStateManager.setState('MENU');
    uiManager.setState('MENU');
    playgamaService.sendGameReady();

    this.loop.start();
  }

  private buildPlayerCarMesh(car: CarDefinition, upgrades: CarUpgrades): void {
    while (this.vehicle.bodyMeshGroup.children.length > 0) {
      this.vehicle.bodyMeshGroup.remove(this.vehicle.bodyMeshGroup.children[0]);
    }

    const carMesh = proceduralModels.createPlayerCarBody(
      car.bodyMeshType,
      upgrades.bodyColor || car.defaultBodyColor,
      upgrades.neonColor || car.defaultNeonColor
    );
    this.vehicle.bodyMeshGroup.add(carMesh);

    for (let i = 0; i < 4; i++) {
      const wg = this.vehicle.wheelGroups[i];
      while (wg.children.length > 0) wg.remove(wg.children[0]);
      const wheelMesh = proceduralModels.createWheel();
      wg.add(wheelMesh);
    }
  }

  private setupEventListeners(): void {
    eventBus.on('score:stunt', () => {
      this.sceneManager.addTrauma(0.25);
    });

    eventBus.on('checkpoint:hit', () => {
      audioManager.playCheckpointChime();
    });

    eventBus.on('state:changed', ({ to }) => {
      uiManager.setState(to);
      if (to === 'PLAYING') {
        this.touchControls.show();
        musicSynthesizer.start();
      } else {
        this.touchControls.hide();
        if (to === 'MENU' || to === 'GARAGE') {
          engineSynthesizer.stop();
        }
      }
    });

    eventBus.on('game:start_run', ({ trackId, carId }) => {
      const trk = TRACK_CATALOG.find((t) => t.id === trackId) || TRACK_CATALOG[0];
      const carDef = CAR_CATALOG.find((c) => c.id === carId) || CAR_CATALOG[0];
      const save = storageService.getData();
      const upgrades = save.carUpgrades[carDef.id] || {
        engineStage: 1,
        nitroStage: 1,
        handlingStage: 1,
        weightStage: 1,
        bodyColor: carDef.defaultBodyColor,
        neonColor: carDef.defaultNeonColor,
      };

      this.buildPlayerCarMesh(carDef, upgrades);
      this.vehicle.teleport(new THREE.Vector3(1.8, 0.5, 0), 0);
      this.highway.reset(0);
      this.traffic.reset(0);
      this.particles.reset();
      this.skidmarks.reset();
      adrenalineSystem.reset();
      checkpointTimeTrialSystem.start(trk);
    });

    eventBus.on('game:restart_run', () => {
      const trk = gameStateManager.getActiveTrack();
      const carId = gameStateManager.getActiveCarId();
      eventBus.emit('game:start_run', { trackId: trk.id, carId });
    });

    eventBus.on('game:revive', () => {
      this.vehicle.teleport(
        new THREE.Vector3(1.8, 0.5, this.vehicle.position.z),
        0
      );
      this.vehicle.addNitro(100);
    });

    eventBus.on('game:finish_run', (data) => {
      const finalScore = adrenalineSystem.totalScore;
      data.score = finalScore;
      data.nearMissCount = adrenalineSystem.nearMissCount;
      data.driftPoints = adrenalineSystem.driftPoints;

      storageService.modify((s) => {
        s.cash += data.earnedCash;
        s.rep += data.earnedRep;
        const rec = s.trackRecords[data.trackId] || {
          bestTimeSec: 999,
          medal: 'none',
          stars: 0,
          highScore: 0,
        };
        if (data.totalTimeSec < rec.bestTimeSec) {
          rec.bestTimeSec = data.totalTimeSec;
          rec.medal = data.medal;
        }
        rec.highScore = Math.max(rec.highScore, finalScore);
        s.trackRecords[data.trackId] = rec;
      });

      playgamaService.setLeaderboardScore('night_sprint_highscore', finalScore);
    });
  }

  private onFixedUpdate(dt: number): void {
    gameStateManager.update(dt);

    if (gameStateManager.getState() === 'PLAYING') {
      const input = this.touchControls.update(dt);
      const carDef = gameStateManager.getActiveCarDefinition();
      const save = storageService.getData();
      const upgrades = save.carUpgrades[carDef.id] || {
        engineStage: 1,
        nitroStage: 1,
        handlingStage: 1,
        weightStage: 1,
        bodyColor: carDef.defaultBodyColor,
        neonColor: carDef.defaultNeonColor,
      };

      this.vehicle.fixedUpdate(dt, input, carDef, upgrades);
      physicsWorld.step();
      this.vehicle.postStep(dt);

      this.traffic.update(dt, this.vehicle.position, this.vehicle.speedKmh, gameStateManager.isInvulnerable());

      const truckAhead = this.traffic.findHeavyTruckAhead(this.vehicle.position);
      adrenalineSystem.update(dt, this.vehicle.speedKmh, this.vehicle.isDrifting, Boolean(truckAhead));

      checkpointTimeTrialSystem.update(dt, this.vehicle.position.z);
    }
  }

  private onRender(alpha: number, dt: number): void {
    const state = gameStateManager.getState();

    if (state === 'PLAYING' || state === 'PAUSED' || state === 'CRASH_REVIVE') {
      this.vehicle.render(alpha);
      this.sceneManager.updateChaseCamera(
        dt,
        this.vehicle.interpPosition,
        this.vehicle.interpForward,
        this.vehicle.speedKmh,
        this.vehicle.isNitroActive,
        this.vehicle.isNitroOverdrive,
        this.vehicle.isDrifting,
        this.vehicle.slipAngleDeg
      );

      this.highway.update(this.vehicle.interpPosition.z);

      if (this.vehicle.isNitroActive) {
        const exhaustPos = this.vehicle.interpPosition.clone()
          .sub(this.vehicle.interpForward.clone().multiplyScalar(2.0));
        this.particles.emitNitroFlames(exhaustPos, this.vehicle.interpForward, this.vehicle.isNitroOverdrive);
      }

      if (this.vehicle.isDrifting) {
        this.particles.emitTireSmoke(this.vehicle.interpPosition);
      }

      this.skidmarks.addSkidMark(
        this.vehicle.interpPosition,
        this.vehicle.right,
        this.vehicle.isDrifting
      );

      engineSynthesizer.update(
        this.vehicle.rpm,
        this.vehicle.speedKmh > 10 ? 0.8 : 0.2,
        this.vehicle.isNitroActive
      );

      this.particles.update(dt);

      const progressRatio = checkpointTimeTrialSystem.playerDistanceMeters / checkpointTimeTrialSystem.totalTrackLengthMeters;
      uiManager.updateHUD(
        this.vehicle.speedKmh,
        this.vehicle.gear,
        (this.vehicle.nitroAmount / this.vehicle.nitroMax) * 100,
        checkpointTimeTrialSystem.timeRemainingSec,
        progressRatio,
        adrenalineSystem.comboMultiplier,
        adrenalineSystem.comboTimerSec / adrenalineSystem.comboWindowSec
      );
    } else if (state === 'GARAGE') {
      this.garageAngle += 0.5 * dt;
      this.sceneManager.setGarageCamera(this.vehicle.position, this.garageAngle);
    }

    telemetryService.update();
    this.sceneManager.render();
  }
}
