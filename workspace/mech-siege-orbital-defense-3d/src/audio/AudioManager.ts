// src/audio/AudioManager.ts
// WebAudio synthesized audio system with single master GainNode & dynamic battle music

import { playgamaService } from '../platform/PlaygamaService';
import { storageService } from '../platform/StorageService';

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private isMuted = false;
  private sfxEnabled = true;
  private musicEnabled = true;
  private isUnlocked = false;

  private bgmInterval: number | null = null;
  private bgmStep = 0;

  private constructor() {
    this.initAudioContext();
    this.setupListeners();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private initAudioContext(): void {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);
    } catch (e) {
      console.warn('[AudioManager] AudioContext creation error:', e);
    }
  }

  private setupListeners(): void {
    // Unlock WebAudio on first user gesture
    const unlock = () => {
      if (this.isUnlocked) return;
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this.isUnlocked = true;
        });
      } else {
        this.isUnlocked = true;
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });

    // Sync with Playgama platform pause / mute
    playgamaService.onAudioStateChanged((state) => {
      this.setPlatformMuted(!state);
    });
    playgamaService.onPauseStateChanged((paused) => {
      if (paused) {
        this.pauseBgm();
      } else if (this.musicEnabled && !this.isMuted) {
        this.startBgm();
      }
    });
  }

  public initFromSettings(): void {
    const data = storageService.getData();
    this.sfxEnabled = data.settings.sfxEnabled;
    this.musicEnabled = data.settings.musicEnabled;
    this.applyVolumes();
  }

  public setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
    this.applyVolumes();
    storageService.setData({
      settings: {
        ...storageService.getData().settings,
        sfxEnabled: enabled,
      },
    });
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    this.applyVolumes();
    if (enabled) {
      this.startBgm();
    } else {
      this.pauseBgm();
    }
    storageService.setData({
      settings: {
        ...storageService.getData().settings,
        musicEnabled: enabled,
      },
    });
  }

  public isSfxOn(): boolean {
    return this.sfxEnabled;
  }

  public isMusicOn(): boolean {
    return this.musicEnabled;
  }

  private setPlatformMuted(muted: boolean): void {
    this.isMuted = muted;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const targetMaster = this.isMuted ? 0 : 0.8;
    const targetSfx = this.sfxEnabled ? 0.7 : 0;
    const targetMusic = this.musicEnabled ? 0.4 : 0;

    this.masterGain.gain.setTargetAtTime(targetMaster, now, 0.05);
    this.sfxGain.gain.setTargetAtTime(targetSfx, now, 0.05);
    this.musicGain.gain.setTargetAtTime(targetMusic, now, 0.05);
  }

  // --- PROCEDURAL SFX GENERATION ---

  public playLaser(): void {
    if (!this.sfxEnabled || !this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {}
  }

  public playAutocannon(): void {
    if (!this.sfxEnabled || !this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {}
  }

  public playExplosion(isLarge: boolean = false): void {
    if (!this.sfxEnabled || !this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const duration = isLarge ? 0.6 : 0.35;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isLarge ? 300 : 500, now);
      filter.frequency.exponentialRampToValueAtTime(40, now + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(isLarge ? 0.6 : 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      noise.start(now);
      noise.stop(now + duration);
    } catch {}
  }

  public playDash(): void {
    if (!this.sfxEnabled || !this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(500, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }

  public playShieldHit(): void {
    if (!this.sfxEnabled || !this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {}
  }

  public playPickup(): void {
    if (!this.sfxEnabled || !this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.04); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.08); // G5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {}
  }

  public playBuild(): void {
    if (!this.sfxEnabled || !this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {}
  }

  public playWaveAlert(): void {
    if (!this.sfxEnabled || !this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(440, now + 0.2);
      osc.frequency.linearRampToValueAtTime(220, now + 0.4);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch {}
  }

  // --- DYNAMIC PROCEDURAL BATTLE MUSIC ---

  public startBgm(): void {
    if (this.bgmInterval) return;
    if (!this.musicEnabled) return;

    const bassNotes = [55, 55, 65.41, 55, 49, 49, 55, 61.74]; // A1, C2, G1, B1
    const leadNotes = [220, 261.63, 329.63, 293.66, 220, 349.23, 329.63, 261.63];

    this.bgmInterval = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || !this.musicEnabled || this.isMuted) return;
      try {
        const now = this.ctx.currentTime;
        const step = this.bgmStep % 8;
        this.bgmStep++;

        // Bass Pulse
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(bassNotes[step], now);

        bassGain.gain.setValueAtTime(0.18, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        bassOsc.connect(bassGain);
        bassGain.connect(this.musicGain);

        bassOsc.start(now);
        bassOsc.stop(now + 0.2);

        // Hi-Hat Tick on odd steps
        if (step % 2 === 1) {
          const hatOsc = this.ctx.createOscillator();
          const hatGain = this.ctx.createGain();
          hatOsc.type = 'square';
          hatOsc.frequency.setValueAtTime(6000, now);

          hatGain.gain.setValueAtTime(0.04, now);
          hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

          hatOsc.connect(hatGain);
          hatGain.connect(this.musicGain);

          hatOsc.start(now);
          hatOsc.stop(now + 0.04);
        }

        // Synth Arp on 4th steps
        if (step % 4 === 0) {
          const leadOsc = this.ctx.createOscillator();
          const leadGain = this.ctx.createGain();
          leadOsc.type = 'triangle';
          leadOsc.frequency.setValueAtTime(leadNotes[step], now);

          leadGain.gain.setValueAtTime(0.12, now);
          leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

          leadOsc.connect(leadGain);
          leadGain.connect(this.musicGain);

          leadOsc.start(now);
          leadOsc.stop(now + 0.3);
        }
      } catch {}
    }, 220); // ~136 BPM
  }

  public pauseBgm(): void {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const audioManager = AudioManager.getInstance();
