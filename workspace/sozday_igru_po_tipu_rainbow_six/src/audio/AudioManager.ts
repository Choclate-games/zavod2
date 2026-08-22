import { EventBus } from "../core/EventBus";
import { ProceduralSoundSynthesizer } from "./ProceduralSoundSynthesizer";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private synth: ProceduralSoundSynthesizer | null = null;
  private eventBus: EventBus;

  public isAudioReady = false;
  private userMuted = false;
  private platformMuted = false;
  private masterVolume = 0.8;
  private heartbeatInterval: number | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.bindEvents();
  }

  init(): void {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);

      this.lowpassFilter = this.ctx.createBiquadFilter();
      this.lowpassFilter.type = "lowpass";
      this.lowpassFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);
      this.lowpassFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

      this.lowpassFilter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.synth = new ProceduralSoundSynthesizer(this.ctx, this.lowpassFilter);

      this.setupUnlockListeners();
    } catch (e) {
      console.warn("Web Audio API not supported or blocked", e);
    }
  }

  private setupUnlockListeners(): void {
    const unlock = () => {
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") {
        this.ctx.resume().then(() => {
          this.isAudioReady = true;
        });
      } else {
        this.isAudioReady = true;
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
  }

  private bindEvents(): void {
    this.eventBus.on("weapon:fired", (payload) => {
      if (!this.synth) return;
      let weaponType: "pistol" | "smg" | "shotgun" | "revolver" = "pistol";
      if (payload.weapon.id === "smg_mp5") weaponType = "smg";
      else if (payload.weapon.id === "shotgun_m870") weaponType = "shotgun";
      else if (payload.weapon.id === "revolver_rhino") weaponType = "revolver";

      this.synth.playGunshot(weaponType);
    });

    this.eventBus.on("breach:planted", () => {
      this.synth?.playC4Plant();
    });

    this.eventBus.on("breach:detonated", () => {
      this.synth?.playC4Explosion();
      this.synth?.playTinnitusBeep(1.5);
    });

    this.eventBus.on("enemy:hit", (payload) => {
      if (payload.isHeadshot) {
        this.synth?.playHeadshotDing();
      }
    });

    this.eventBus.on("shield:blocked", () => {
      this.synth?.playShieldRicochet();
    });

    this.eventBus.on("weapon:reloaded", () => {
      this.synth?.playReloadClick();
    });

    this.eventBus.on("slowmo:started", () => {
      this.setConcussionFilter(450);
      this.startHeartbeat();
    });

    this.eventBus.on("slowmo:ended", () => {
      this.setConcussionFilter(20000);
      this.stopHeartbeat();
    });

    this.eventBus.on("bomb:wire_cut", (payload) => {
      this.synth?.playWireSnip();
      if (!payload.correct) {
        this.synth?.playDefusalWarning();
      }
    });

    this.eventBus.on("bomb:defused", () => {
      this.synth?.playDefusalSuccess();
    });
  }

  setConcussionFilter(targetFreq: number): void {
    if (!this.ctx || !this.lowpassFilter) return;
    const now = this.ctx.currentTime;
    this.lowpassFilter.frequency.cancelScheduledValues(now);
    this.lowpassFilter.frequency.exponentialRampToValueAtTime(Math.max(100, targetFreq), now + 0.15);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.synth?.playHeartbeat();
    this.heartbeatInterval = window.setInterval(() => {
      this.synth?.playHeartbeat();
    }, 1100);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateGain();
  }

  setUserMuted(muted: boolean): void {
    this.userMuted = muted;
    this.updateGain();
  }

  setPlatformMuted(muted: boolean): void {
    this.platformMuted = muted;
    this.updateGain();
  }

  private updateGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const effectiveVolume = this.userMuted || this.platformMuted ? 0 : this.masterVolume;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(effectiveVolume, now + 0.05);
  }

  playUiClick(): void {
    this.synth?.playUiClick();
  }

  playBombBeep(pitchMult = 1.0): void {
    this.synth?.playBombBeep(pitchMult);
  }
}
