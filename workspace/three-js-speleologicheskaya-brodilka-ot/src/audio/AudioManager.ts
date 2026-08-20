import { SoundSynthesizer } from "./SoundSynthesizer";
import { EventBus } from "../core/EventBus";

export class AudioManager {
  private static instance: AudioManager | null = null;
  public readonly synth: SoundSynthesizer;
  private isMuted: boolean = false;

  private constructor() {
    this.synth = new SoundSynthesizer();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public init(eventBus?: EventBus): void {
    if (eventBus) {
      this.bindEvents(eventBus);
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.synth.setMuted(muted);
    if (muted) {
      this.synth.stopCaveAmbience();
    } else {
      this.synth.startCaveAmbience();
    }
  }

  public setVolume(volume: number): void {
    this.synth.setVolume(volume);
  }

  public playClick(): void {
    this.synth.playButtonClick();
  }

  public playUpgrade(): void {
    this.synth.playUpgradeChime();
  }

  public playSonar(factor: number = 1.0): void {
    this.synth.playSonarPing(factor);
  }

  public playStep(isCrouch: boolean = false): void {
    this.synth.playStep(isCrouch);
  }

  public playJump(): void {
    this.synth.playJump();
  }

  public playLand(hard: boolean = false): void {
    this.synth.playLand(hard);
  }

  private bindEvents(eventBus: EventBus): void {
    eventBus.on("sonar:pulse", (payload) => {
      this.synth.playSonarPing(payload.isPlayer ? 1.0 : 0.7);
    });

    eventBus.on("crystal:shattered", () => {
      this.synth.playCrystalShatter();
    });

    eventBus.on("stalker:alert", () => {
      this.synth.playStalkerAlert();
    });

    eventBus.on("stalker:stunned", () => {
      this.synth.playShockwave();
    });

    eventBus.on("player:hurt", () => {
      this.synth.playPlayerHurt();
    });

    eventBus.on("decoy:thrown", () => {
      this.synth.playDecoyThrow();
    });

    eventBus.on("decoy:ping", () => {
      this.synth.playDecoyPing();
    });

    eventBus.on("upgrade:chosen", () => {
      this.synth.playUpgradeChime();
    });
  }
}
