import { EventBus } from '../core/EventBus';
import { Storage } from '../platform/StorageService';

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bulletTimeFilter: BiquadFilterNode | null = null;

  private isUserMuted = false;
  private isPlatformMuted = false;
  private musicPlaying = false;
  private musicIntervalId: number | null = null;
  private musicStep = 0;
  private currentBpm = 124;
  private isOverdriveMusic = false;

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public init(): void {
    const profile = Storage.getProfile();
    this.isUserMuted = profile.settings.soundMuted;

    EventBus.on('platform:audio', (enabled: boolean) => {
      this.isPlatformMuted = !enabled;
      this.updateMasterVolume();
    });

    EventBus.on('platform:pause', (paused: boolean) => {
      if (paused) {
        this.suspendContext();
      } else {
        this.resumeContext();
      }
    });

    // Auto-resume audio on first user gesture
    const unlockAudio = () => {
      this.ensureContext();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bulletTimeFilter = this.ctx.createBiquadFilter();

      this.bulletTimeFilter.type = 'lowpass';
      this.bulletTimeFilter.frequency.setValueAtTime(18000, this.ctx.currentTime);
      this.bulletTimeFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      this.musicGain.connect(this.bulletTimeFilter);
      this.bulletTimeFilter.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.updateMasterVolume();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public suspendContext(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  public resumeContext(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean): void {
    this.isUserMuted = muted;
    const profile = Storage.getProfile();
    profile.settings.soundMuted = muted;
    Storage.save();
    this.updateMasterVolume();
  }

  public isMuted(): boolean {
    return this.isUserMuted;
  }

  private updateMasterVolume(): void {
    if (!this.masterGain || !this.ctx) return;
    const target = this.isUserMuted || this.isPlatformMuted ? 0.0 : 1.0;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(target, now, 0.05);
  }

  // --- Dynamic Bullet Time Filter ---

  public setBulletTimeDilation(dilation: number): void {
    if (!this.bulletTimeFilter || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Dilation is 0.1 in bullet time, 1.0 in normal time
    const freq = THREE_Math_map(dilation, 0.1, 1.0, 420, 18000);
    this.bulletTimeFilter.frequency.setTargetAtTime(freq, now, 0.08);
  }

  // --- Synthesized Cyberpunk Synthwave Music ---

  public startMusic(): void {
    if (this.musicPlaying) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.musicPlaying = true;
    this.scheduleMusicTick();
  }

  public stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicIntervalId !== null) {
      window.clearTimeout(this.musicIntervalId);
      this.musicIntervalId = null;
    }
  }

  public setOverdriveMusic(active: boolean): void {
    this.isOverdriveMusic = active;
    this.currentBpm = active ? 142 : 124;
  }

  private scheduleMusicTick(): void {
    if (!this.musicPlaying) return;

    const stepIntervalMs = (60 / this.currentBpm / 4) * 1000;
    this.playMusicStep(this.musicStep);
    this.musicStep = (this.musicStep + 1) % 32;

    this.musicIntervalId = window.setTimeout(() => {
      this.scheduleMusicTick();
    }, stepIntervalMs);
  }

  private playMusicStep(step: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain || this.isUserMuted || this.isPlatformMuted) return;

    const now = ctx.currentTime;
    const bassNotes = [55, 55, 65.41, 55, 49, 49, 58.27, 49, 51.91, 51.91, 61.74, 51.91, 43.65, 43.65, 49, 43.65];
    const bassFreq = bassNotes[step % bassNotes.length];

    // 16th-note synth bass
    if (step % 2 === 0) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = this.isOverdriveMusic ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(bassFreq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(this.isOverdriveMusic ? 2200 : 900, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.18);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + 0.2);
    }

    // Snare / Hi-hat on backbeats
    if (step % 8 === 4) {
      // Synth Snare
      this.playSynthSnare(now);
    } else if (step % 2 === 1) {
      // Hi-hat
      this.playSynthHat(now);
    }

    // Lead Arp chord
    if (step % 4 === 0) {
      const chords = [
        [220, 261.63, 329.63, 440],
        [196, 246.94, 293.66, 392],
        [207.65, 261.63, 311.13, 415.3],
        [174.61, 220, 261.63, 349.23]
      ];
      const chordIndex = Math.floor(step / 8) % chords.length;
      const note = chords[chordIndex][(step / 4) % 4];

      const leadOsc = ctx.createOscillator();
      const leadGain = ctx.createGain();
      leadOsc.type = 'sawtooth';
      leadOsc.frequency.setValueAtTime(note, now);

      leadGain.gain.setValueAtTime(0.08, now);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      leadOsc.connect(leadGain);
      leadGain.connect(this.musicGain);

      leadOsc.start(now);
      leadOsc.stop(now + 0.28);
    }
  }

  private playSynthSnare(time: number): void {
    if (!this.ctx || !this.musicGain) return;
    // Noise buffer
    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(time);
  }

  private playSynthHat(time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const bufferSize = this.ctx.sampleRate * 0.04;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(time);
  }

  // --- Sound Effects ---

  public playSliceWhoosh(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isUserMuted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.14);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playMetalSlice(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isUserMuted) return;

    const now = ctx.currentTime;

    // Sharp metallic FM slice sound
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const gain = ctx.createGain();

    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(1200, now);
    carrier.frequency.exponentialRampToValueAtTime(320, now + 0.18);

    mod.type = 'square';
    mod.frequency.setValueAtTime(480, now);
    modGain.gain.setValueAtTime(600, now);
    modGain.gain.exponentialRampToValueAtTime(20, now + 0.18);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    carrier.connect(gain);
    gain.connect(this.sfxGain);

    mod.start(now);
    carrier.start(now);
    mod.stop(now + 0.22);
    carrier.stop(now + 0.22);
  }

  public playParryClang(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isUserMuted) return;

    const now = ctx.currentTime;
    const freqs = [1860, 2400, 3100];

    for (const f of freqs) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.5);
    }
  }

  public playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isUserMuted) return;

    const now = ctx.currentTime;

    // Sub-bass impact
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(25, now + 0.4);

    subGain.gain.setValueAtTime(0.6, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    sub.connect(subGain);
    subGain.connect(this.sfxGain);

    sub.start(now);
    sub.stop(now + 0.48);
  }

  public playBulletShot(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isUserMuted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playBulletTimeStart(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isUserMuted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playOverdriveActivated(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isUserMuted) return;

    const now = ctx.currentTime;
    const chords = [440, 554.37, 659.25, 880];

    for (const freq of chords) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.75);
    }
  }

  public playComboRankUp(rank: string): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isUserMuted) return;

    const notes: Record<string, number[]> = {
      'C': [330, 392],
      'B': [392, 493.88],
      'A': [440, 554.37],
      'S': [523.25, 659.25],
      'SS': [659.25, 783.99, 987.77],
      'SSS': [880, 1108.73, 1318.51, 1760]
    };

    const noteList = notes[rank] || [440];
    const now = ctx.currentTime;

    noteList.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.25, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.3);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.32);
    });
  }

  public playButtonClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isUserMuted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.05);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playUpgradeSelected(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isUserMuted) return;

    const now = ctx.currentTime;
    const notes = [587.33, 739.99, 880, 1174.66];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);

      gain.gain.setValueAtTime(0.2, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.2);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.22);
    });
  }
}

function THREE_Math_map(x: number, in_min: number, in_max: number, out_min: number, out_max: number): number {
  return ((x - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
}

export const Audio = AudioManager.getInstance();
