import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { VoxelModelData } from '../core/Types';
import { VoxelModelObject } from '../rendering/VoxelModelObject';
import { RollerMechanism } from '../rendering/RollerMechanism';
import { ParticleStream } from '../rendering/ParticleStream';
import { SparkVFX } from '../rendering/SparkVFX';
import { SceneManager } from '../rendering/SceneManager';
import { AudioManager } from '../audio/AudioManager';
import { UpgradeSystem } from './UpgradeSystem';
import { ComboSystem } from './ComboSystem';
import { EconomySystem } from './EconomySystem';
import { StorageService } from '../platform/StorageService';

export class ShredderSystem {
  private eventBus: EventBus;
  private sceneManager: SceneManager;
  private roller: RollerMechanism;
  private particleStream: ParticleStream;
  private sparkVFX: SparkVFX;
  private audioManager: AudioManager;
  private upgradeSystem: UpgradeSystem;
  private comboSystem: ComboSystem;
  private economySystem: EconomySystem;
  private storage: StorageService;

  private currentModel: VoxelModelObject | null = null;
  private isModelCompleted = false;
  private totalEarnedFromCurrentModel = 0;

  constructor(
    eventBus: EventBus,
    sceneManager: SceneManager,
    roller: RollerMechanism,
    particleStream: ParticleStream,
    sparkVFX: SparkVFX,
    audioManager: AudioManager,
    upgradeSystem: UpgradeSystem,
    comboSystem: ComboSystem,
    economySystem: EconomySystem
  ) {
    this.eventBus = eventBus;
    this.sceneManager = sceneManager;
    this.roller = roller;
    this.particleStream = particleStream;
    this.sparkVFX = sparkVFX;
    this.audioManager = audioManager;
    this.upgradeSystem = upgradeSystem;
    this.comboSystem = comboSystem;
    this.economySystem = economySystem;
    this.storage = StorageService.getInstance();

    // Hook particle collection in basket to coin income
    this.particleStream.onParticleCollected = (_color: number, worldX: number, worldY: number) => {
      if (!this.currentModel) return;
      const sharpness = this.upgradeSystem.getMultiplier('SHARPNESS');
      const valMult = this.upgradeSystem.getMultiplier('VALUE');
      const hasGold = this.storage.getProgress().hasGoldSkin;

      const reward = this.economySystem.calculateVoxelReward(
        this.currentModel.modelData.baseVoxelValue,
        sharpness,
        valMult,
        hasGold
      );

      this.totalEarnedFromCurrentModel += reward;
      this.economySystem.addCoins(reward);
      this.audioManager.playCoinChime(Math.floor(Math.random() * 6));
    };
  }

  public loadModel(modelData: VoxelModelData): void {
    if (this.currentModel) {
      this.currentModel.dispose(this.sceneManager.scene);
      this.currentModel = null;
    }

    this.particleStream.reset();
    this.isModelCompleted = false;
    this.totalEarnedFromCurrentModel = 0;

    this.currentModel = new VoxelModelObject(this.sceneManager.scene, modelData);

    this.eventBus.emit('model:loaded', {
      model: modelData,
      totalVoxels: this.currentModel.totalVoxels
    });

    this.eventBus.emit('model:progress', {
      destroyed: 0,
      total: this.currentModel.totalVoxels,
      percent: 0
    });
  }

  public getCurrentModel(): VoxelModelObject | null {
    return this.currentModel;
  }

  public update(dt: number): void {
    if (!this.currentModel || this.isModelCompleted) return;

    // Calculate current speed & sharpness multipliers
    const speedMult = this.upgradeSystem.getMultiplier('SPEED');
    const comboMult = this.comboSystem.getSpeedMultiplier();
    const sharpnessMult = this.upgradeSystem.getMultiplier('SHARPNESS');
    const isTurbo = comboMult > 1.8;

    // Modulate audio motor hum
    this.audioManager.setMotorSpeed(comboMult);

    const hardness = this.currentModel.modelData.hardness;
    const baseFeedSpeed = (0.28 * speedMult) / Math.sqrt(hardness);

    const nipY = this.roller.getNipPointY() + 0.95; // Top of the roller teeth
    this.currentModel.updateDescent(baseFeedSpeed, dt, isTurbo, nipY);
    const bitePower = this.roller.getDamageMultiplier();
    const contactHalfHeight = 0.38;
    const baseDps = 28.0;
    const damageThisFrame = baseDps * dt * sharpnessMult * Math.max(1.0, bitePower);

    // Slice voxels passing through contact nip
    const detached = this.currentModel.sliceVoxels(
      nipY,
      this.roller.getContactMinX(),
      this.roller.getContactMaxX(),
      this.roller.getContactMinZ(),
      this.roller.getContactMaxZ(),
      contactHalfHeight,
      damageThisFrame
    );

    if (detached.length > 0) {
      // Spawn flying debris particles
      this.particleStream.spawnParticles(detached, isTurbo);

      // Emit contact sparks
      const first = detached[0];
      this.sparkVFX.emitSparks(first.worldX, first.worldY, first.worldZ, isTurbo ? 6 : 2);

      // ASMR crunch sound with pitch shift
      this.audioManager.playVoxelCrunch(detached.length);

      // Slight screen shake on high-impact shred
      if (isTurbo || detached.length > 12) {
        this.sceneManager.triggerScreenShake(0.04);
      }

      // Track total destroyed voxels for stats & leaderboard
      const destroyed = this.currentModel.totalVoxels - this.currentModel.remainingVoxels;
      const progressPercent = this.currentModel.getProgressPercent();

      const curSaved = this.storage.getProgress().totalVoxelsCrushed;
      this.storage.updateProgress({ totalVoxelsCrushed: curSaved + detached.length });

      this.eventBus.emit('model:progress', {
        destroyed,
        total: this.currentModel.totalVoxels,
        percent: progressPercent
      });
    }

    // Check completion condition
    if (this.currentModel.remainingVoxels === 0) {
      this.onModelFullyDestroyed();
    }
  }

  private onModelFullyDestroyed(): void {
    if (this.isModelCompleted || !this.currentModel) return;
    this.isModelCompleted = true;

    // Big victory fanfare sound
    this.audioManager.playVictoryFanfare();

    // Bonus completion coin burst
    const completionBonus = Math.max(50, Math.floor(this.totalEarnedFromCurrentModel * 0.4));
    this.totalEarnedFromCurrentModel += completionBonus;
    this.economySystem.addCoins(completionBonus);

    // Save completed model ID
    const curProgress = this.storage.getProgress();
    const completedSet = new Set(curProgress.completedModelIds);
    completedSet.add(this.currentModel.modelData.id);
    this.storage.updateProgress({ completedModelIds: Array.from(completedSet) });

    this.eventBus.emit('model:completed', {
      model: this.currentModel.modelData,
      totalVoxels: this.currentModel.totalVoxels,
      earnedCoins: this.totalEarnedFromCurrentModel
    });
  }

  public doubleCurrentModelReward(): void {
    const doubleBonus = this.totalEarnedFromCurrentModel;
    this.totalEarnedFromCurrentModel *= 2;
    this.economySystem.addCoins(doubleBonus);
  }
}
