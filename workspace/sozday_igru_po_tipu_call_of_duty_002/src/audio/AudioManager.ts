import { GAME_BALANCE } from '../config/balance';
import { eventBus } from '../core/EventBus';

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.8;
  private isInitialized: boolean = false;

  private constructor() {
    this.setupListeners();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private setupListeners(): void {
    const initAudio = () => {
      this.ensureContext();
      window.removeEventListener('pointerdown', initAudio);
      window.removeEventListener('keydown', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };
    window.addEventListener('pointerdown', initAudio, { passive: true });
    window.addEventListener('keydown', initAudio, { passive: true });
    window.addEventListener('touchstart', initAudio, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.ctx?.suspend();
      } else if (!this.isMuted) {
        this.ctx?.resume();
      }
    });

    eventBus.on('AUDIO_MUTE_TOGGLED', (muted: boolean) => {
      this.setMuted(muted);
    });
  }

  public ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.isInitialized = true;
    }
    if (this.ctx.state === 'suspended' && !this.isMuted) {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public isAudioMuted(): boolean {
    return this.isMuted;
  }

  // --- Sound Effects Synthesis ---

  public playShoot(weaponId: string): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Noise burst for mechanical gun crack
    const bufferSize = ctx.sampleRate * 0.05;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();

    if (weaponId === 'spas12' || weaponId === 'aa12') {
      // Shotgun blast: low thud + heavy noise
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, t);

      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

      noiseGain.gain.setValueAtTime(0.5, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    } else if (weaponId === 'awp') {
      // High-caliber sniper crack
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2500, t);

      gain.gain.setValueAtTime(0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);

      noiseGain.gain.setValueAtTime(0.7, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    } else if (weaponId === 'rpg7') {
      // RPG Rocket whoosh & explosion punch
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.linearRampToValueAtTime(45, t + 0.35);

      gain.gain.setValueAtTime(0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);

      noiseGain.gain.setValueAtTime(0.8, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    } else {
      // Rifle / Pistol / SMG
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, t);

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

      noiseGain.gain.setValueAtTime(0.4, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    whiteNoise.connect(noiseGain);
    noiseGain.connect(this.masterGain!);

    osc.start(t);
    whiteNoise.start(t);
    osc.stop(t + 0.3);
    whiteNoise.stop(t + 0.3);
  }

  public playHitmarker(headshot: boolean): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (headshot) {
      // 1320 Hz metallic chink (balance.yaml)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(GAME_BALANCE.hit_audio_pitch_headshot, t);
      osc.frequency.exponentialRampToValueAtTime(GAME_BALANCE.hit_audio_pitch_headshot * 1.2, t + 0.04);
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    } else {
      // 880 Hz body hit beep (balance.yaml)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(GAME_BALANCE.hit_audio_pitch_body, t);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    }

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playSlide(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // 1200 Hz bandpass white noise for kevlar knee pads sliding on concrete (balance.yaml)
    const bufferSize = ctx.sampleRate * 0.85;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(3.0, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.85);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    source.start(t);
    source.stop(t + 0.85);
  }

  public playVault(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Low 140 Hz thud + 2400 Hz metal scrape
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  public playUavSonar(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // 320 Hz sonar pulse ping with 1.2s reverb decay (balance.yaml)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 1.2);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 1.25);
  }

  public playWeaponMorph(rank: number): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // 850 Hz metal rack sound + ascending rank confirmation tone (440 to 1760 Hz)
    const baseFreq = 440 + (rank - 1) * (1320 / 11);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.setValueAtTime(baseFreq * 1.5, t + 0.04);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playUiClick(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.04);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.06);
  }
}

export const audioManager = AudioManager.getInstance();