import { storageService } from '../platform/StorageService';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private drumIntervalId: number | null = null;

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext(): void {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      const save = storageService.getData();
      this.isMuted = !save.soundEnabled;
      this.masterGain.gain.value = this.isMuted ? 0 : save.soundVolume;
      this.masterGain.connect(this.ctx.destination);
    }

    // Auto-unlock on first user interaction
    const unlock = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      const targetVol = muted ? 0 : storageService.getData().soundVolume;
      this.masterGain.gain.setValueAtTime(targetVol, this.ctx.currentTime);
    }
    storageService.setSoundSetting(!muted);
  }

  public toggleSound(): boolean {
    this.setMuted(!this.isMuted);
    return !this.isMuted;
  }

  public isSoundEnabled(): boolean {
    return !this.isMuted;
  }

  public playSfx(name: string, pitchVariation: number = 1.0, volume: number = 1.0): void {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const t = this.ctx.currentTime;

    switch (name) {
      case 'whoosh':
        this.playWhoosh(t, pitchVariation, volume);
        break;
      case 'clang':
      case 'parry':
        this.playClang(t, pitchVariation, volume);
        break;
      case 'flesh_impact':
        this.playFleshImpact(t, pitchVariation, volume);
        break;
      case 'wall_smash':
        this.playWallSmash(t, pitchVariation, volume);
        break;
      case 'tackle':
      case 'dash':
        this.playDash(t, pitchVariation, volume);
        break;
      case 'coin':
      case 'pickup':
        this.playCoin(t, volume);
        break;
      case 'crowd_cheer':
        this.playCrowdCheer(t, volume);
        break;
      case 'level_up':
        this.playFanfare(t, volume);
        break;
      default:
        this.playWhoosh(t, pitchVariation, volume * 0.5);
        break;
    }
  }

  private playWhoosh(t: number, pitch: number, vol: number): void {
    if (!this.ctx || !this.masterGain) return;

    // Filtered noise swoosh
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300 * pitch, t);
    filter.frequency.exponentialRampToValueAtTime(1400 * pitch, t + 0.12);
    filter.frequency.exponentialRampToValueAtTime(200 * pitch, t + 0.25);
    filter.Q.value = 3.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.35 * vol, t + 0.08);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.25);
  }

  private playClang(t: number, pitch: number, vol: number): void {
    if (!this.ctx || !this.masterGain) return;

    // Sharp metallic impact
    const freqs = [840, 1320, 2150, 3400];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(freq * pitch * 0.95, t + 0.3);

      gain.gain.setValueAtTime(0.3 * vol / (idx + 1), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35 + idx * 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  private playFleshImpact(t: number, pitch: number, vol: number): void {
    if (!this.ctx || !this.masterGain) return;

    // Deep thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(45 * pitch, t + 0.18);

    gain.gain.setValueAtTime(0.6 * vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  private playWallSmash(t: number, pitch: number, vol: number): void {
    if (!this.ctx || !this.masterGain) return;

    // Heavy bass rumble + crunch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(30 * pitch, t + 0.35);

    gain.gain.setValueAtTime(0.7 * vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.38);
  }

  private playDash(t: number, pitch: number, vol: number): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(500 * pitch, t + 0.15);

    gain.gain.setValueAtTime(0.3 * vol, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  private playCoin(t: number, vol: number): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, t); // B5
    osc.frequency.setValueAtTime(1318.51, t + 0.08); // E6

    gain.gain.setValueAtTime(0.25 * vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  private playCrowdCheer(t: number, vol: number): void {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 0.8;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, t);
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.4 * vol, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.8);
  }

  private playFanfare(t: number, vol: number): void {
    if (!this.ctx || !this.masterGain) return;

    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.1);

      gain.gain.setValueAtTime(0.25 * vol, t + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.45);
    });
  }

  public startBattleBgm(): void {
    if (this.drumIntervalId !== null) return;
    let beat = 0;
    this.drumIntervalId = window.setInterval(() => {
      if (this.isMuted || !this.ctx || !this.masterGain) return;
      if (this.ctx.state !== 'running') return;

      const t = this.ctx.currentTime;
      // Procedural Roman battle drum
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const isHeavy = beat % 4 === 0;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isHeavy ? 90 : 65, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + (isHeavy ? 0.25 : 0.15));

      gain.gain.setValueAtTime(isHeavy ? 0.28 : 0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (isHeavy ? 0.3 : 0.18));

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + (isHeavy ? 0.32 : 0.2));

      beat++;
    }, 450);
  }

  public stopBattleBgm(): void {
    if (this.drumIntervalId !== null) {
      clearInterval(this.drumIntervalId);
      this.drumIntervalId = null;
    }
  }
}

export const audioManager = new AudioManager();
