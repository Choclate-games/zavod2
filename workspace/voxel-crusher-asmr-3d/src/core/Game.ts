import { EventBus } from './EventBus';
import { GameState, VoxelModelData } from './Types';
import { PlaygamaService } from '../platform/PlaygamaService';
import { StorageService } from '../platform/StorageService';
import { AudioManager } from '../audio/AudioManager';
import { SceneManager } from '../rendering/SceneManager';
import { RollerMechanism } from '../rendering/RollerMechanism';
import { ParticleStream } from '../rendering/ParticleStream';
import { SparkVFX } from '../rendering/SparkVFX';
import { EconomySystem } from '../systems/EconomySystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { ComboSystem } from '../systems/ComboSystem';
import { ShredderSystem } from '../systems/ShredderSystem';
import { TouchControls } from '../ui/TouchControls';
import { UIManager } from '../ui/UIManager';
import { GameLoop } from './GameLoop';
import { COLLECTIONS_DATA, getAllModels } from '../data/ModelsData';

export class Game {
  private eventBus: EventBus;
  private playgama: PlaygamaService;
  private storage: StorageService;
  private audio: AudioManager;

  private sceneManager!: SceneManager;
  private roller!: RollerMechanism;
  private particleStream!: ParticleStream;
  private sparkVFX!: SparkVFX;

  private economy!: EconomySystem;
  private upgrades!: UpgradeSystem;
  private combo!: ComboSystem;
  private shredder!: ShredderSystem;
  private touchControls!: TouchControls;
  private ui!: UIManager;
  private gameLoop!: GameLoop;

  private allModels: VoxelModelData[] = [];
  private currentModelIndex = 0;
  private consecutiveCompleted = 0;
  private currentState: GameState = 'LOADING';

  constructor() {
    this.eventBus = new EventBus();
    this.playgama = PlaygamaService.getInstance();
    this.storage = StorageService.getInstance();
    this.audio = AudioManager.getInstance();
    this.allModels = getAllModels();
  }

  public async init(): Promise<void> {
    console.log('[Game] Initializing systems...');

    // 1. Audio Engine
    this.audio.init();

    // 2. Storage & Saved Progress
    const saved = await this.storage.load();
    this.audio.setPlayerMuted(!saved.soundEnabled);

    // 3. Three.js Scene & Visuals
    const container = document.getElementById('game-container') || document.body;
    this.sceneManager = new SceneManager(container);
    this.roller = new RollerMechanism(this.sceneManager.scene);
    this.particleStream = new ParticleStream(this.sceneManager.scene);
    this.sparkVFX = new SparkVFX(this.sceneManager.scene);

    // 4. Gameplay Systems
    this.economy = new EconomySystem(this.eventBus);
    this.upgrades = new UpgradeSystem(this.eventBus, this.economy);
    this.combo = new ComboSystem(this.eventBus);

    this.shredder = new ShredderSystem(
      this.eventBus,
      this.sceneManager,
      this.roller,
      this.particleStream,
      this.sparkVFX,
      this.audio,
      this.upgrades,
      this.combo,
      this.economy
    );

    // 5. Controls & UI
    this.touchControls = new TouchControls(this.eventBus);
    this.ui = new UIManager(
      this.eventBus,
      this.economy,
      this.upgrades,
      this.combo,
      this.audio
    );

    this.setupListeners();
    this.applyUpgradesToVisuals();

    // 6. Setup Game Loop
    this.gameLoop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render()
    );

    // 7. Load starting model
    this.currentModelIndex = saved.currentModelIndex || 0;
    if (this.currentModelIndex >= this.allModels.length) {
      this.currentModelIndex = 0;
    }
    this.shredder.loadModel(this.allModels[this.currentModelIndex]);

    // 8. Lifecycle bindings with Playgama
    this.playgama.onPauseStateChanged((paused) => {
      this.gameLoop.setPaused(paused);
      this.audio.setPlatformMuted(paused);
    });

    this.playgama.onAudioStateChanged((muted) => {
      this.audio.setPlatformMuted(muted);
    });

    // 9. Start loop and dismiss loading screen
    this.gameLoop.start();
    this.currentState = 'PLAYING';
    this.ui.hideLoading();
    this.playgama.sendGameReady();

    console.log('[Game] Ready and running at 60 FPS!');
  }

  private setupListeners(): void {
    // Tap to boost
    this.eventBus.on('tap:registered', () => {
      this.combo.registerTap();
    });

    // Upgrades applied
    this.eventBus.on('upgrade:purchased', () => {
      this.applyUpgradesToVisuals();
    });

    // Model complete flow
    this.eventBus.on('model:completed', () => {
      this.consecutiveCompleted++;
      this.touchControls.setEnabled(false);

      // Submit leaderboard score
      const totalCrushed = this.storage.getProgress().totalVoxelsCrushed;
      this.playgama.setLeaderboardScore('total_voxels_crushed_leaderboard', totalCrushed);

      const completedCount = this.storage.getProgress().completedModelIds.length;
      const unlockedCollections = COLLECTIONS_DATA
        .filter((collection) => completedCount >= collection.requiredCompletedCount)
        .map((collection) => collection.id);
      this.storage.updateProgress({ unlockedCollections });
    });

    // Next model action from victory modal
    this.ui.onNextModelRequest = () => {
      this.advanceToNextModel();
    };

    // Double reward action
    this.ui.onDoubleRewardRequest = () => {
      this.shredder.doubleCurrentModelReward();
    };

    // Select model from gallery
    this.ui.onSelectModelRequest = (model: VoxelModelData) => {
      const idx = this.allModels.findIndex((m) => m.id === model.id);
      if (idx !== -1) {
        const collection = COLLECTIONS_DATA.find((item) => item.id === model.collectionId);
        const completedCount = this.storage.getProgress().completedModelIds.length;
        if (collection && completedCount < collection.requiredCompletedCount) return;
        this.currentModelIndex = idx;
        this.storage.updateProgress({ currentModelIndex: idx });
        this.shredder.loadModel(model);
        this.touchControls.setEnabled(true);
      }
    };
  }

  private advanceToNextModel(): void {
    // Check if we should show natural break interstitial (every 2-3 completed models)
    if (this.consecutiveCompleted >= 2) {
      this.consecutiveCompleted = 0;
      this.playgama.showInterstitial();
    }

    this.currentModelIndex = (this.currentModelIndex + 1) % this.allModels.length;
    this.storage.updateProgress({ currentModelIndex: this.currentModelIndex });

    const nextModel = this.allModels[this.currentModelIndex];
    this.shredder.loadModel(nextModel);
    this.touchControls.setEnabled(true);
  }

  private applyUpgradesToVisuals(): void {
    const widthMult = this.upgrades.getMultiplier('WIDTH');
    this.roller.setWidthMultiplier(widthMult);

    const hasGold = this.storage.getProgress().hasGoldSkin;
    this.roller.setGoldSkin(hasGold);
  }

  private update(dt: number): void {
    if (this.currentState === 'LOADING') return;

    // 1. Combo & Speed
    this.combo.update(dt);
    const speedMult = this.combo.getSpeedMultiplier() * this.upgrades.getMultiplier('SPEED');

    // 2. Rollers rotation
    this.roller.update(dt, speedMult);

    // 3. Shredder destruction & falling particles
    this.shredder.update(dt);
    this.particleStream.update(dt);
    this.sparkVFX.update(dt);

    // 4. Camera shake & scene
    this.sceneManager.update(dt);
  }

  private render(): void {
    this.sceneManager.render();
  }
}
