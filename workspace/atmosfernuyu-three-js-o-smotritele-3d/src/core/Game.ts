import * as THREE from 'three';
import { bus } from './EventBus';
import { GameLoop } from './GameLoop';
import type { InputManager } from './InputManager';
import type { UIManager } from '../ui/UIManager';
import type { AudioManager } from '../audio/AudioManager';
import { playgama } from '../platform/PlaygamaService';
import { StorageService } from '../platform/StorageService';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { RagdollController } from '../physics/RagdollController';
import { SceneManager } from '../rendering/SceneManager';
import { InstancedPool } from '../rendering/MeshPool';
import { Shaders } from '../rendering/Shaders';
import { Player } from '../entities/Player';
import { EnemyPool } from '../entities/Enemy';
import { CombatSystem } from '../systems/CombatSystem';
import { WaveManager } from '../systems/WaveManager';
import { UpgradeManager } from '../systems/UpgradeManager';
import { CrowdFavorSystem } from '../systems/CrowdFavorSystem';
import { SampleField } from '../systems/SampleField';
import { telemetry } from '../telemetry/Telemetry';
import { ENEMY, WAVES, FAVOR, RESOURCES, GameStateName } from '../config/GameConfig';

/**
 * Core coordinator & state machine (Core Engine Layer). Owns the GameLoop and
 * wires every subsystem together: physics, entities, systems, rendering, UI,
 * audio and the platform SDK. Implements the full session loop:
 * menu → dive → explore/collect → wave break (upgrade) → surface/defeat → results.
 */
export class Game {
  private state: GameStateName = 'boot';
  private touchMode = false;

  private scene!: SceneManager;
  private physics!: PhysicsWorld;
  private player!: Player;
  private enemies!: EnemyPool;
  private combat!: CombatSystem;
  private waves!: WaveManager;
  private upgrades!: UpgradeManager;
  private favor!: CrowdFavorSystem;
  private samples!: SampleField;
  private ragdoll!: RagdollController;
  private sparks!: InstancedPool;
  private loop!: GameLoop;

  private samplesCollected = 0;
  private maxDepth = 0;
  private rerollCount = 0;
  private reviveUsed = false;
  private doubleUsed = false;
  private victory = false;
  private firstActionSent = false;
  private lastResult: import('../ui/UIManager').ResultsData | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly ui: UIManager,
    private readonly input: InputManager,
    private readonly audio: AudioManager,
  ) {}

  setTouchMode(v: boolean): void {
    this.touchMode = v;
    this.ui.setTouchActive(v);
  }

  async init(): Promise<void> {
    this.physics = await PhysicsWorld.create();
    this.scene = new SceneManager(this.canvas, this.touchMode);
    this.player = new Player(this.scene.scene, this.physics);
    this.enemies = new EnemyPool(this.scene.scene, this.physics, ENEMY.maxCount);
    this.ragdoll = new RagdollController(this.scene.scene, this.physics);
    this.sparks = new InstancedPool(new THREE.SphereGeometry(0.18, 6, 6), Shaders.createSparkMaterial(0xffe066), 400);
    this.scene.add(this.sparks.mesh);
    this.samples = new SampleField(this.scene.scene);
    this.combat = new CombatSystem(this.sparks, this.enemies, this.ragdoll, this.audio, this.player);
    this.favor = new CrowdFavorSystem(() => this.onFavorOverflow());
    this.upgrades = new UpgradeManager(this.player);
    this.waves = new WaveManager(
      (pos, hp) => this.enemies.spawn(pos, hp),
      () => this.enemies.activeCount,
      () => this.player.position,
    );

    this.applySettings();
    this.wireBus();
    this.wireUI();
    this.wirePlatform();

    this.loop = new GameLoop((dt) => this.step(dt), () => this.render());
    this.loop.start();

    (window as unknown as { __game?: Game }).__game = this;

    this.state = 'menu';
    this.ui.showScreen('menu');
    this.ui.setMenuStats(StorageService.data_.bestDepth, StorageService.data_.coins);
    this.scene.updateCamera(this.player.position, 0, true);
  }

  private applySettings(): void {
    const s = StorageService.data_.settings;
    this.audio.setPlayerMuted(s.muted);
    this.audio.setMusicVolume(s.musicVolume);
    this.audio.setSfxVolume(s.sfxVolume);
    playgama.setNoAds(StorageService.data_.premium.noAds);
  }

  private wireBus(): void {
    bus.on('ui:toast', ({ text }) => this.ui.toast(text));
    bus.on('enemy:killed', () => {
      this.samplesCollected += WAVES.samplesPerKill;
      this.favor.addKill();
      this.updateHud();
    });
    bus.on('wave:clear', ({ wave }) => this.onWaveClear(wave));
  }

  private wireUI(): void {
    this.ui.onPlay = () => this.startRun();
    this.ui.onRetry = () => this.startRun();
    this.ui.onMenu = () => this.toMenu();
    this.ui.onResume = () => this.resume();
    this.ui.onQuit = () => this.toMenu();
    this.ui.onHow = () => this.ui.showScreen('how');
    this.ui.onRevive = () => this.doRevive();
    this.ui.onDouble = () => this.doDouble();
    this.ui.onUpgradeChoose = (id) => this.chooseUpgrade(id);
    this.ui.onReroll = () => this.doReroll();
    this.ui.onToggleMute = () => this.toggleMute();
  }

  private wirePlatform(): void {
    playgama.onPause((paused) => this.pauseForPlatform(paused));
    playgama.onAudio((enabled) => this.audio.setPlatformMuted(!enabled));
  }

  // ---------------- Run lifecycle ----------------

  private startRun(): void {
    playgama.flushInterstitial();
    this.enemies.clearAll();
    this.samples.clear();
    this.player.spawn();
    this.waves.start();
    this.favor.reset();
    this.samplesCollected = 0;
    this.maxDepth = 0;
    this.rerollCount = 0;
    this.reviveUsed = false;
    this.doubleUsed = false;
    this.victory = false;
    this.firstActionSent = false;
    this.state = 'playing';
    this.ui.showScreen(null);
    this.ui.setPlayingControls(true);
    this.input.setEnabled(true);
    this.scene.updateCamera(this.player.position, 0, true);
    this.updateHud();
    telemetry.track('session_start');
  }

  private endRun(victory: boolean): void {
    this.victory = victory;
    this.state = 'results';
    this.input.setEnabled(false);
    this.input.releaseAll();
    this.ui.setPlayingControls(false);
    this.audio.play(victory ? 'upgrade' : 'hurt');

    const save = StorageService.data_;
    save.coins += this.samplesCollected;
    if (this.maxDepth > save.bestDepth) save.bestDepth = this.maxDepth;
    void StorageService.saveImmediate();
    void playgama.submitScore(this.maxDepth);

    const data = {
      victory,
      depth: this.maxDepth,
      samples: this.samplesCollected,
      wave: this.waves.wave,
      bestDepth: save.bestDepth,
      canRevive: !victory && playgama.isRewardedSupported && !this.reviveUsed,
      canDouble: playgama.isRewardedSupported,
    };
    this.lastResult = data;
    this.ui.showResults(data);
    playgama.armInterstitial('run_over');
    telemetry.track('run_over', { victory, depth: Math.round(this.maxDepth), samples: this.samplesCollected });
  }

  private toMenu(): void {
    playgama.flushInterstitial();
    this.enemies.clearAll();
    this.samples.clear();
    this.state = 'menu';
    this.input.setEnabled(false);
    this.input.releaseAll();
    this.ui.setPlayingControls(false);
    this.ui.showScreen('menu');
    this.ui.setMenuStats(StorageService.data_.bestDepth, StorageService.data_.coins);
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.setEnabled(false);
    this.input.releaseAll();
    this.ui.setPlayingControls(false);
    this.loop.setPaused(true);
    this.ui.showScreen('pause');
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.showScreen(null);
    this.ui.setPlayingControls(true);
    this.input.setEnabled(true);
    this.input.poll().pauseEdge = false;
    this.loop.setPaused(false);
  }

  private pauseForPlatform(paused: boolean): void {
    if (paused && this.state === 'playing') this.pause();
    else if (!paused && this.state === 'paused') this.resume();
  }

  // ---------------- Upgrades ----------------

  private onWaveClear(_wave: number): void {
    this.samplesCollected += WAVES.samplesPerWaveClear;
    this.samples.burst(this.player.position, 6);
    this.audio.play('wave');
    this.ui.toast('toast.waveclear');

    this.state = 'upgrade';
    this.input.setEnabled(false);
    this.input.releaseAll();
    this.ui.setPlayingControls(false);
    const canReroll = playgama.isRewardedSupported && this.rerollCount < 2;
    const cards = this.upgrades.roll(true);
    this.ui.showUpgrade(cards, canReroll);
  }

  private chooseUpgrade(id: string): void {
    this.upgrades.apply(id);
    this.audio.play('upgrade');
    this.ui.toast('toast.upgrade');
    this.ui.hideUpgrade();
    this.state = 'playing';
    this.ui.setPlayingControls(true);
    this.input.setEnabled(true);
  }

  private doReroll(): void {
    if (this.rerollCount >= 2 || !playgama.isRewardedSupported) return;
    void playgama.showRewarded('free_card_reroll').then((ok) => {
      if (!ok) return;
      this.rerollCount += 1;
      const canReroll = this.rerollCount < 2;
      this.ui.showUpgrade(this.upgrades.roll(true), canReroll);
    });
  }

  // ---------------- Rewarded ads ----------------

  private doRevive(): void {
    if (this.reviveUsed || !playgama.isRewardedSupported) return;
    void playgama.showRewarded('revive_run').then((ok) => {
      if (!ok) return;
      this.reviveUsed = true;
      this.player.hull = this.player.stats.maxHull * 0.5;
      this.player.invuln = 3;
      this.combat.shockwave(16, 300);
      this.state = 'playing';
      this.ui.showScreen(null);
      this.ui.setPlayingControls(true);
      this.input.setEnabled(true);
      telemetry.track('revive');
    });
  }

  private doDouble(): void {
    if (this.doubleUsed || !playgama.isRewardedSupported) return;
    void playgama.showRewarded('double_gold_run').then((ok) => {
      if (!ok) return;
      this.doubleUsed = true;
      StorageService.data_.coins += this.samplesCollected;
      void StorageService.saveImmediate();
      telemetry.track('double_gold');
      if (this.lastResult) this.ui.showResults({ ...this.lastResult, canDouble: false });
    });
  }

  private toggleMute(): void {
    const s = StorageService.data_.settings;
    s.muted = !s.muted;
    this.audio.setPlayerMuted(s.muted);
    void StorageService.saveImmediate();
  }

  // ---------------- Collection / favor ----------------

  private handleCollect(_pos: THREE.Vector3): void {
    this.samplesCollected += 1;
    this.favor.addSample();
    this.player.onSampleCollected();
    this.audio.play('collect');
    telemetry.trackOnce('first_reward');
    this.updateHud();
  }

  private onFavorOverflow(): void {
    this.samples.burst(this.player.position, 8);
    this.samplesCollected += FAVOR.bonusSamples;
    this.ui.toast('toast.favor');
    this.audio.play('collect');
    this.updateHud();
  }

  // ---------------- Loop ----------------

  private step(dt: number): void {
    if (this.state !== 'playing') return;
    const input = this.input.poll();
    if (input.pauseEdge) {
      input.pauseEdge = false;
      this.pause();
      return;
    }
    if (
      !this.firstActionSent &&
      (input.moveX !== 0 || input.moveZ !== 0 || input.ascend || input.descend || input.pulse || input.heavy)
    ) {
      this.firstActionSent = true;
      telemetry.trackOnce('first_action');
    }

    if (!this.combat.isFrozen) {
      this.player.handleInput(input, dt);
      this.enemies.update(dt, this.player.position);
      this.waves.update(dt);
      this.samples.update(dt, this.player.position, (pos) => this.handleCollect(pos));
      this.combat.update(dt);
      this.physics.step(dt);
    }

    this.player.update(dt, this.scene);
    this.maxDepth = Math.max(this.maxDepth, this.player.depth);
    this.scene.updateCamera(this.player.position, dt);
    this.ragdoll.update(dt);
    this.sparks.update(dt);
    this.updateHud();

    if (this.state === 'playing' && this.player.hull <= 0) this.endRun(false);
    else if (this.state === 'playing' && this.maxDepth > 15 && this.player.position.y > RESOURCES.air.surfaceThreshold) {
      this.endRun(true);
    }
  }

  private updateHud(): void {
    this.ui.updateBars(
      this.player.air,
      this.player.stats.maxAir,
      this.player.energy,
      this.player.stats.maxEnergy,
      this.player.hull,
      this.player.stats.maxHull,
    );
    this.ui.updateReadouts(this.player.depth, this.samplesCollected, this.waves.wave);
    this.ui.setFavor(this.favor.value, FAVOR.max);
  }

  private render(): void {
    this.scene.render();
  }
}
