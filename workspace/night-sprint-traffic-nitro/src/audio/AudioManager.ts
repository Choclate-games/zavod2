import { engineSynthesizer } from './EngineSynthesizer';
import { musicSynthesizer } from './MusicSynthesizer';
import { eventBus } from '../core/EventBus';

export class AudioManager {
  private actx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private masterGain: GainNode | null = null;

  private isMuted = false;

  constructor() {
    this.setupUserGestureUnlock();
    this.setupListeners();
  }

  private setupUserGestureUnlock(): void {
    const unlock = () => {
      this.ensureContext();
      if (this.actx && this.actx.state === 'suspended') {
        this.actx.resume();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  private ensureContext(): void {
    if (this.actx) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    this.actx = new AudioContextClass();

    this.masterGain = this.actx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.actx.destination);

    this.sfxGain = this.actx.createGain();
    this.sfxGain.gain.value = 0.8;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.actx.createGain();
    this.musicGain.gain.value = 0.7;
    this.musicGain.connect(this.masterGain);

    engineSynthesizer.initialize(this.actx, this.sfxGain);
    musicSynthesizer.initialize(this.actx, this.musicGain);
  }

  private setupListeners(): void {
    eventBus.on('audio:mute_toggle', (isMuted) => {
      this.setMuted(isMuted);
    });

    eventBus.on('near_miss:trigger', (data) => {
      this.playNearMissWhoosh(data.isOpposing);
    });

    eventBus.on('nitro:activated', () => {
      this.playNitroIgnite();
    });

    eventBus.on('game:crash', () => {
      this.playCrashImpact();
    });
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.actx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 1.0, this.actx.currentTime);
    }
  }

  setMusicVolume(vol: number): void {
    if (this.musicGain && this.actx) {
      this.musicGain.gain.setValueAtTime(vol, this.actx.currentTime);
    }
  }

  setSfxVolume(vol: number): void {
    if (this.sfxGain && this.actx) {
      this.sfxGain.gain.setValueAtTime(vol, this.actx.currentTime);
    }
  }

  playClick(): void {
    this.ensureContext();
    if (!this.actx || !this.sfxGain) return;
    const now = this.actx.currentTime;

    const osc = this.actx.createOscillator();
    const gain = this.actx.createGain();

    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  playNearMissWhoosh(isOpposing: boolean): void {
    this.ensureContext();
    if (!this.actx || !this.sfxGain) return;
    const now = this.actx.currentTime;

    const bufferSize = this.actx.sampleRate * 0.4;
    const buffer = this.actx.createBuffer(1, bufferSize, this.actx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

    const noise = this.actx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.actx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isOpposing ? 1600 : 900, now);
    filter.frequency.exponentialRampToValueAtTime(isOpposing ? 300 : 450, now + 0.35);
    filter.Q.value = 4.0;

    const gain = this.actx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + 0.40);
  }

  playNitroIgnite(): void {
    this.ensureContext();
    if (!this.actx || !this.sfxGain) return;
    const now = this.actx.currentTime;

    const osc = this.actx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.30);

    const gain = this.actx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.38);
  }

  playCrashImpact(): void {
    this.ensureContext();
    if (!this.actx || !this.sfxGain) return;
    const now = this.actx.currentTime;

    const osc = this.actx.createOscillator();
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.4);

    const gain = this.actx.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  playCheckpointChime(): void {
    this.ensureContext();
    if (!this.actx || !this.sfxGain) return;
    const now = this.actx.currentTime;

    const freqs = [523.25, 659.25, 783.99, 1046.50];
    for (let i = 0; i < freqs.length; i++) {
      const osc = this.actx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqs[i], now + i * 0.06);

      const gain = this.actx.createGain();
      gain.gain.setValueAtTime(0.35, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.30);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.32);
    }
  }
}

export const audioManager = new AudioManager();