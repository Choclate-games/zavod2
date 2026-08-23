import * as THREE from 'three';
import { GameLoop } from './GameLoop';
import { EventBus } from './EventBus';
import { SceneManager } from '../rendering/SceneManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { EntityManager } from '../entities/EntityManager';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { BestOf5MatchDirectorFlowSystem } from '../systems/BestOf5MatchDirectorFlowSystem';
import { RaycastBvhBallisticsEngineSystem } from '../systems/RaycastBvhBallisticsEngineSystem';
import { UiRoot } from '../ui/UiRoot';
import { StorageService } from '../platform/StorageService';

export class Game {
  private static instance: Game;
  public loop: GameLoop;
  public sceneManager: SceneManager;
  public physicsWorld: PhysicsWorld;
  public entityManager: EntityManager;
  public matchDirector: BestOf5MatchDirectorFlowSystem;
  public uiRoot: UiRoot;

  public currentState: string = 'MENU';
  private menuCamAngle = 0;

  public static get(): Game {
    if (!Game.instance) {
      Game.instance = new Game();
    }
    return Game.instance;
  }

  constructor() {
    this.sceneManager = SceneManager.get();
    this.physicsWorld = PhysicsWorld.get();
    this.physicsWorld.initArena();

    this.entityManager = EntityManager.get();
    this.matchDirector = new BestOf5MatchDirectorFlowSystem();
    this.uiRoot = UiRoot.get();

    // Attach entities to Three.js scene
    this.sceneManager.scene.add(this.entityManager.bot.root);
    this.sceneManager.viewmodelGroup.add(this.entityManager.player.viewmodel);

    // Setup input shooting on click
    const canvas = this.sceneManager.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => {
      if (this.currentState === 'PLAYING') {
        this.entityManager.player.requestLock(canvas);
        if (e.button === 0 && this.entityManager.player.canShoot()) {
          const p = this.entityManager.player;
          const origin = p.position.clone().setY(1.65);
          const forward = new THREE.Vector3(
            -Math.sin(p.yaw) * Math.cos(p.pitch),
            Math.sin(p.pitch),
            -Math.cos(p.yaw) * Math.cos(p.pitch)
          );
          p.onShoot();
          RaycastBvhBallisticsEngineSystem.fireRaycast(origin, forward, p.velocity.length() > 0.35 ? 12.0 : 0.05, true);
        }
      }
    });

    // UI callbacks
    this.uiRoot.onStartMatchCallback = () => this.startMatch();
    this.uiRoot.onRematchCallback = () => this.startMatch();

    this.setupEvents();

    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render()
    );
  }

  private setupEvents(): void {
    EventBus.get().on('PLATFORM_PAUSE', (isPaused: boolean) => {
      if (isPaused) {
        this.currentState = 'PAUSED';
        this.loop.resetDelta();
        EventBus.get().emit('STATE_CHANGED', 'PAUSED');
      } else {
        if (this.currentState === 'PAUSED') {
          this.currentState = 'PLAYING';
          this.loop.resetDelta();
          EventBus.get().emit('STATE_CHANGED', 'PLAYING');
        }
      }
    });

    EventBus.get().on('STATE_CHANGED', (state: string) => {
      switch (state) {
        case 'MENU':
          this.currentState = 'MENU';
          break;
        case 'PLAYING':
          this.currentState = 'PLAYING';
          break;
        case 'PAUSED':
          this.currentState = 'PAUSED';
          break;
        case 'ROUND_END':
          this.currentState = 'ROUND_END';
          break;
        case 'MATCH_END':
          this.currentState = 'MATCH_END';
          break;
      }
    });

    EventBus.get().on('REWARD_GRANTED', (data: { rewardId: string; amount: number }) => {
      const cur = StorageService.get().getData();
      StorageService.get().updateData({ coins: cur.coins + data.amount });
    });

    EventBus.get().on('ROUND_ENDED', () => {
      this.uiRoot.router.navigate('RoundEndOverlay');
    });

    EventBus.get().on('MATCH_ENDED', () => {
      this.uiRoot.router.navigate('MatchVictoryDefeat');
    });
  }

  public startMatch(): void {
    this.matchDirector.startNewMatch();
    this.uiRoot.router.navigate('DuelHUD');
  }

  public update(dt: number): void {
    if (this.currentState === 'PAUSED') {
      return;
    }

    if (this.currentState === 'PLAYING') {
      this.entityManager.update(dt);
      this.matchDirector.update(dt);

      // Align camera with player position and orientation
      const player = this.entityManager.player;
      this.sceneManager.camera.position.copy(player.position);
      this.sceneManager.camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
    } else if (this.currentState === 'ROUND_END') {
      this.matchDirector.update(dt);
      this.entityManager.bot.update(dt);
      if (this.matchDirector.phase === 'LIVE') {
        this.uiRoot.router.navigate('DuelHUD');
      }
    } else if (this.currentState === 'MENU' || this.currentState === 'MATCH_END') {
      // Slow cinematic camera pan across rooftop sunset for live menu background scene
      this.menuCamAngle += dt * 0.15;
      const camDist = 7.5;
      this.sceneManager.camera.position.set(
        Math.sin(this.menuCamAngle) * camDist,
        2.2,
        Math.cos(this.menuCamAngle) * camDist
      );
      this.sceneManager.camera.lookAt(0, 1.2, 0);

      // Subtle breathing viewmodel bobbing
      const p = this.entityManager.player;
      p.viewmodel.position.set(0.18, -0.22 + Math.sin(Date.now() * 0.002) * 0.01, -0.45);
    }

    ParticleSystem.get().update(dt);
  }

  public render(): void {
    this.sceneManager.render();
  }
}