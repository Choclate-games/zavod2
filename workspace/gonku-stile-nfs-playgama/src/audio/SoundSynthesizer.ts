import { EventBus } from '../core/EventBus';

export class SoundSynthesizer {
  private static instance: SoundSynthesizer;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  public isMuted = false;
  public masterVolume = 0.8;
  private isPlatformMuted = false;

  // Engine audio nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Tire drift audio nodes
  private driftNoiseNode: AudioNode | null = null;
  private driftGain: GainNode | null = null;
  private driftFilter: BiquadFilterNode | null = null;

  // Music synth beat state
  private isMusicPlaying = false;
  private musicTimer: number | null = null;
  private beatStep = 0;

  static get(): SoundSynthesizer {
    if (!SoundSynthesizer.instance) {
      SoundSynthesizer.instance = new SoundSynthesizer();
    }
    return SoundSynthesizer.instance;
  }

  constructor() {
    const initAudio = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    };

    window.addEventListener('pointerdown', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend();
      } else if (!document.hidden && this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    });

    EventBus.get().on('platform:audio_state', (enabled: boolean) => {
      this.isPlatformMuted = !enabled;
      this.updateMasterGain();
    });

    EventBus.get().on('platform:pause', (isPaused: boolean) => {
      if (isPaused) {
        this.ctx?.suspend();
      } else {
        this.ctx?.resume();
      }
    });
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      this.ctx = new AudioContextClass();

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.masterGain.gain.setValueAtTime(this.isMuted || this.isPlatformMuted ? 0 : this.masterVolume, this.ctx.currentTime);
      this.musicGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.updateMasterGain();
  }

  private updateMasterGain(): void {
    if (!this.masterGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const target = (this.isMuted || this.isPlatformMuted) ? 0.0001 : this.masterVolume;
    this.masterGain.gain.setTargetAtTime(target, now, 0.05);
  }

  // --- Engine Sound ---

  public startEngine(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.engineOsc1) return;

    const now = ctx.currentTime;
    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc2 = ctx.createOscillator();
    this.engineGain = ctx.createGain();
    this.engineFilter = ctx.createBiquadFilter();

    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle';
    this.engineOsc1.frequency.setValueAtTime(48, now);
    this.engineOsc2.frequency.setValueAtTime(96, now);

    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(200, now);
    this.engineFilter.Q.setValueAtTime(2.5, now);

    this.engineGain.gain.setValueAtTime(0.35, now);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain!);

    this.engineOsc1.start(now);
    this.engineOsc2.start(now);
  }

  public updateEngineRPM(speedRatio: number, throttle: number): void {
    if (!this.engineOsc1 || !this.engineFilter || !this.ctx) return;
    const now = this.ctx.currentTime;

    const targetFreq = 48 + speedRatio * 180 + throttle * 45;
    this.engineOsc1.frequency.setTargetAtTime(targetFreq, now, 0.05);
    if (this.engineOsc2) {
      this.engineOsc2.frequency.setTargetAtTime(targetFreq * 1.5, now, 0.05);
    }

    const filterFreq = 180 + speedRatio * 850 + throttle * 550;
    this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.05);
  }

  public stopEngine(): void {
    if (this.engineOsc1) {
      try {
        this.engineOsc1.stop();
        this.engineOsc2?.stop();
      } catch {}
      this.engineOsc1.disconnect();
      this.engineOsc2?.disconnect();
      this.engineFilter?.disconnect();
      this.engineGain?.disconnect();

      this.engineOsc1 = null;
      this.engineOsc2 = null;
      this.engineFilter = null;
      this.engineGain = null;
    }
  }

  // --- Drift Skid Squeal ---

  public startDriftSqueal(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.driftGain) return;

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    this.driftFilter = ctx.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.setValueAtTime(2200, ctx.currentTime);
    this.driftFilter.Q.setValueAtTime(4.0, ctx.currentTime);

    this.driftGain = ctx.createGain();
    this.driftGain.gain.setValueAtTime(0.001, ctx.currentTime);

    noise.connect(this.driftFilter);
    this.driftFilter.connect(this.driftGain);
    this.driftGain.connect(this.sfxGain!);

    noise.start();
    this.driftNoiseNode = noise;
  }

  public setDriftIntensity(intensity: number, slipAngleDeg: number): void {
    if (!this.driftGain || !this.driftFilter || !this.ctx) return;
    const now = this.ctx.currentTime;
    const targetGain = Math.min(0.45, Math.max(0, intensity * 0.45));
    this.driftGain.gain.setTargetAtTime(targetGain, now, 0.04);

    const freq = 1800 + (Math.min(75, Math.max(20, slipAngleDeg)) - 20) * 25;
    this.driftFilter.frequency.setTargetAtTime(freq, now, 0.04);
  }

  public stopDriftSqueal(): void {
    if (this.driftGain) {
      this.driftGain.gain.setTargetAtTime(0.001, this.ctx?.currentTime || 0, 0.04);
    }
  }

  // --- Action SFX ---

  public playNitroBurst(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;
    const now = ctx.currentTime;

    // Sub-bass drop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.25);

    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + 0.35);

    // Jet flame whoosh
    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.4);
    filter.Q.setValueAtTime(2.0, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain!);
    noise.start(now);
  }

  public playImpactCrash(power = 1.0): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;
    const now = ctx.currentTime;

    // Metal clatter
    [420, 680, 1150, 1850].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 60, now);

      gain.gain.setValueAtTime((0.4 * power) / (i + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now);
      osc.stop(now + 0.22);
    });

    // Low boom punch
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(95, now);
    subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.2);

    subGain.gain.setValueAtTime(0.8 * power, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain!);
    subOsc.start(now);
    subOsc.stop(now + 0.2);
  }

  public playPursuitBreakerExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;
    const now = ctx.currentTime;
    const duration = 1.1;

    // Massive blast noise
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(60, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    noise.start(now);

    // Shock sub-drop
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);

    oscGain.gain.setValueAtTime(1.0, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playGearCollect(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;
    const now = ctx.currentTime;
    const notes = [659.25, 880.0, 1174.66]; // E5, A5, D6
    const note = notes[Math.floor(Math.random() * notes.length)];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(note, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playLevelUpFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;
    const now = ctx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.35, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.45);
    });
  }

  public playButtonClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  // --- Dynamic Procedural Phonk / Synthwave Beat ---

  public startBackgroundMusic(): void {
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.beatStep = 0;

    const stepInterval = 135; // ~111 BPM 16th notes
    this.musicTimer = window.setInterval(() => {
      this.playMusicBeatStep();
      this.beatStep = (this.beatStep + 1) % 16;
    }, stepInterval);
  }

  private playMusicBeatStep(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted || !this.isMusicPlaying) return;
    const now = ctx.currentTime;

    // 1. Kick on 0, 4, 8, 12
    if (this.beatStep % 4 === 0) {
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(130, now);
      kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.1);

      kickGain.gain.setValueAtTime(0.6, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      kickOsc.connect(kickGain);
      kickGain.connect(this.musicGain!);
      kickOsc.start(now);
      kickOsc.stop(now + 0.12);
    }

    // 2. Snare / Clap on 4, 12
    if (this.beatStep === 4 || this.beatStep === 12) {
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1200, now);

      const snareGain = ctx.createGain();
      snareGain.gain.setValueAtTime(0.35, now);
      snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      noise.connect(filter);
      filter.connect(snareGain);
      snareGain.connect(this.musicGain!);
      noise.start(now);
    }

    // 3. Phonk Bassline
    const bassNotes = [55, 55, 65.4, 55, 73.4, 55, 65.4, 82.4]; // A1, C2, D2, E2
    const bassNote = bassNotes[Math.floor(this.beatStep / 2) % bassNotes.length];

    if (this.beatStep % 2 === 0) {
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      const bassFilter = ctx.createBiquadFilter();

      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassNote, now);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(380, now);
      bassFilter.Q.setValueAtTime(4.0, now);

      bassGain.gain.setValueAtTime(0.35, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.musicGain!);
      bassOsc.start(now);
      bassOsc.stop(now + 0.22);
    }
  }

  public stopBackgroundMusic(): void {
    this.isMusicPlaying = false;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
