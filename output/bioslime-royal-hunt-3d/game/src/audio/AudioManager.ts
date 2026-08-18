import { EventBus } from '../core/EventBus';
import { StorageService } from '../platform/StorageService';

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private isMuted: boolean = false;
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;
  private isMusicPlaying: boolean = false;
  private bgmInterval: number | null = null;
  private bgmStep: number = 0;

  private constructor() {
    const data = StorageService.getInstance().getData();
    this.soundEnabled = data.soundEnabled ?? true;
    this.musicEnabled = data.musicEnabled ?? true;

    // Listen to mute events
    EventBus.on('audio:mute', (mute: boolean) => {
      this.setMute(mute);
    });

    // Auto unlock on first user gesture
    const unlock = () => {
      this.initContext();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private initContext(): void {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.updateVolumes();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    this.updateVolumes();
  }

  public toggleSound(enabled: boolean): void {
    this.soundEnabled = enabled;
    StorageService.getInstance().save({ soundEnabled: enabled });
    this.updateVolumes();
  }

  public toggleMusic(enabled: boolean): void {
    this.musicEnabled = enabled;
    StorageService.getInstance().save({ musicEnabled: enabled });
    this.updateVolumes();
    if (enabled && !this.isMusicPlaying) {
      this.startBGM();
    } else if (!enabled) {
      this.stopBGM();
    }
  }

  private updateVolumes(): void {
    if (!this.masterGain || !this.sfxGain || !this.musicGain) return;
    const now = this.ctx?.currentTime || 0;

    const masterVol = this.isMuted ? 0 : 1;
    const sfxVol = this.soundEnabled ? 0.8 : 0;
    const musicVol = this.musicEnabled ? 0.35 : 0;

    this.masterGain.gain.setValueAtTime(masterVol, now);
    this.sfxGain.gain.setValueAtTime(sfxVol, now);
    this.musicGain.gain.setValueAtTime(musicVol, now);
  }

  // ---------------- PROCEDURAL SFX ----------------
  public playSquish(): void {
    if (!this.ctx || !this.soundEnabled || this.isMuted) return;
    this.initContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    osc.frequency.setValueAtTime(140 + Math.random() * 60, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.18);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  public playAbsorb(): void {
    if (!this.ctx || !this.soundEnabled || this.isMuted) return;
    this.initContext();
    const t = this.ctx.currentTime;

    // Gulp / squish pop sound
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';

    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(580, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.22);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  public playHit(): void {
    if (!this.ctx || !this.soundEnabled || this.isMuted) return;
    this.initContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';

    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  public playDash(): void {
    if (!this.ctx || !this.soundEnabled || this.isMuted) return;
    this.initContext();
    const t = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.25, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(1800, t + 0.1);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.25);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);

    noise.start(t);
  }

  public playSpikeShoot(): void {
    if (!this.ctx || !this.soundEnabled || this.isMuted) return;
    this.initContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.09);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playWoodCrack(): void {
    if (!this.ctx || !this.soundEnabled || this.isMuted) return;
    this.initContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';

    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playLevelUp(): void {
    if (!this.ctx || !this.soundEnabled || this.isMuted) return;
    this.initContext();

    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5 fanfare
    notes.forEach((freq, idx) => {
      const t = this.ctx!.currentTime + idx * 0.09;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  public playBossHorn(): void {
    if (!this.ctx || !this.soundEnabled || this.isMuted) return;
    this.initContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc2.type = 'sawtooth';

    osc.frequency.setValueAtTime(146.83, t); // D3
    osc.frequency.linearRampToValueAtTime(220, t + 0.4); // A3
    osc2.frequency.setValueAtTime(147.5, t);
    osc2.frequency.linearRampToValueAtTime(221, t + 0.4);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.6, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1.2);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc2.start(t);
    osc.stop(t + 1.2);
    osc2.stop(t + 1.2);
  }

  public playVictory(): void {
    if (!this.ctx || !this.soundEnabled || this.isMuted) return;
    this.initContext();
    const melody = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    melody.forEach((freq, idx) => {
      const t = this.ctx!.currentTime + idx * 0.12;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  // ---------------- DYNAMIC PROCEDURAL BGM ----------------
  public startBGM(): void {
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.initContext();

    const chords = [
      [110, 164.81, 220], // A minor
      [98, 146.83, 196],  // G major
      [87.31, 130.81, 174.61], // F major
      [82.41, 123.47, 164.81]  // E minor
    ];

    const tempoMs = 380; // Medieval battle beat

    this.bgmInterval = window.setInterval(() => {
      if (!this.ctx || !this.musicEnabled || this.isMuted || !this.isMusicPlaying) return;
      const t = this.ctx.currentTime;
      const chordIndex = Math.floor(this.bgmStep / 8) % chords.length;
      const currentChord = chords[chordIndex];

      // Bass note
      if (this.bgmStep % 2 === 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(currentChord[0] * 0.5, t);
        bassGain.gain.setValueAtTime(0.3, t);
        bassGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

        bassOsc.connect(bassGain);
        bassGain.connect(this.musicGain!);
        bassOsc.start(t);
        bassOsc.stop(t + 0.35);
      }

      // Synth Arp Note
      const noteFreq = currentChord[this.bgmStep % currentChord.length];
      const arpOsc = this.ctx.createOscillator();
      const arpGain = this.ctx.createGain();
      arpOsc.type = 'sawtooth';
      arpOsc.frequency.setValueAtTime(noteFreq, t);

      arpGain.gain.setValueAtTime(0.12, t);
      arpGain.gain.exponentialRampToValueAtTime(0.005, t + 0.22);

      arpOsc.connect(arpGain);
      arpGain.connect(this.musicGain!);
      arpOsc.start(t);
      arpOsc.stop(t + 0.22);

      this.bgmStep++;
    }, tempoMs);
  }

  public stopBGM(): void {
    this.isMusicPlaying = false;
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}
