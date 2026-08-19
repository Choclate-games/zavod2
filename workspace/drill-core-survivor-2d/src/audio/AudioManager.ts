import { gameState } from '../core/GameState';
import { eventBus } from '../core/EventBus';

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;

  private isDrillActive: boolean = false;
  private drillOsc: OscillatorNode | null = null;
  private drillGain: GainNode | null = null;

  private isBgmPlaying: boolean = false;
  private bgmInterval: number | null = null;
  private bgmStep: number = 0;
  private isPlatformAudioEnabled: boolean = true;

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public init(): void {
    const unlock = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    eventBus.on('platform:audio_state_changed', (enabled: boolean) => {
      this.isPlatformAudioEnabled = enabled;
      this.updateVolumes();
    });

    eventBus.on('platform:pause_state_changed', (paused: boolean) => {
      if (paused) {
        this.stopDrillSound();
      }
    });
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      this.lowPassFilter = this.ctx.createBiquadFilter();
      this.lowPassFilter.type = 'lowpass';
      this.lowPassFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);
      this.lowPassFilter.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.lowPassFilter);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.lowPassFilter);

      this.updateVolumes();
    }
    return this.ctx;
  }

  public updateVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;

    const time = this.ctx.currentTime;
    const masterVol = this.isPlatformAudioEnabled ? 1.0 : 0.0;
    this.masterGain.gain.setTargetAtTime(masterVol, time, 0.05);

    this.musicGain.gain.setTargetAtTime(gameState.saveData.musicVolume, time, 0.05);
    this.sfxGain.gain.setTargetAtTime(gameState.saveData.sfxVolume, time, 0.05);
  }

  public setFilterMuffled(muffled: boolean): void {
    if (!this.ctx || !this.lowPassFilter) return;
    const targetFreq = muffled ? 600 : 20000;
    this.lowPassFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
  }

  // --- SOUND EFFECTS ---

  public playRockCrumble(hardness: number = 1): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended' || !this.sfxGain) return;

    // White noise crunch with resonant bandpass
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(250 + hardness * 150, ctx.currentTime);
    filter.Q.setValueAtTime(3.0, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4 * gameState.saveData.sfxVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start();
  }

  public playCrystalPickup(combo: number = 0): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended' || !this.sfxGain) return;

    const baseFreq = 523.25; // C5
    const semitones = [0, 2, 4, 7, 9, 12, 14, 16];
    const pitch = baseFreq * Math.pow(2, (semitones[combo % semitones.length] || 0) / 12);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, ctx.currentTime + 0.12);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35 * gameState.saveData.sfxVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  }

  public playExplosion(isBig: boolean = false): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended' || !this.sfxGain) return;

    // Sub-bass pitch drop
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isBig ? 140 : 180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.7 * gameState.saveData.sfxVolume, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);

    // Noise blast
    const dur = isBig ? 0.5 : 0.25;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isBig ? 600 : 800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + dur);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8 * gameState.saveData.sfxVolume, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noise.start();
  }

  public playTurretShot(): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended' || !this.sfxGain) return;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2 * gameState.saveData.sfxVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  public playMonsterHit(): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended' || !this.sfxGain) return;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(260, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25 * gameState.saveData.sfxVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  public playDraftAppear(): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended' || !this.sfxGain) return;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4 * gameState.saveData.sfxVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  }

  public playBossWarning(): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended' || !this.sfxGain) return;

    for (let i = 0; i < 3; i++) {
      const startTime = ctx.currentTime + i * 0.3;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, startTime);
      osc.frequency.linearRampToValueAtTime(330, startTime + 0.2);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3 * gameState.saveData.sfxVolume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + 0.26);
    }
  }

  // --- CONTINUOUS DRILL ENGINE LOOP ---

  public updateDrillSound(isDrilling: boolean, isTurbo: boolean): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended' || !this.sfxGain) return;

    if (isDrilling && !this.isDrillActive) {
      this.isDrillActive = true;
      this.drillOsc = ctx.createOscillator();
      this.drillOsc.type = 'sawtooth';
      this.drillOsc.frequency.setValueAtTime(65, ctx.currentTime);

      this.drillGain = ctx.createGain();
      this.drillGain.gain.setValueAtTime(0.12 * gameState.saveData.sfxVolume, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, ctx.currentTime);

      this.drillOsc.connect(filter);
      filter.connect(this.drillGain);
      this.drillGain.connect(this.sfxGain);

      this.drillOsc.start();
    } else if (!isDrilling && this.isDrillActive) {
      this.stopDrillSound();
    }

    if (this.isDrillActive && this.drillOsc && this.drillGain) {
      const targetFreq = isTurbo ? 110 : 70;
      const targetVol = (isTurbo ? 0.25 : 0.12) * gameState.saveData.sfxVolume;
      this.drillOsc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.1);
      this.drillGain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.1);
    }
  }

  public stopDrillSound(): void {
    if (this.isDrillActive && this.drillOsc && this.drillGain && this.ctx) {
      this.drillGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      setTimeout(() => {
        try {
          this.drillOsc?.stop();
          this.drillOsc?.disconnect();
        } catch {}
        this.drillOsc = null;
        this.drillGain = null;
        this.isDrillActive = false;
      }, 60);
    }
  }

  // --- PROCEDURAL SYNTHWAVE / INDUSTRIAL SOUNDTRACK ---

  public startBgm(): void {
    if (this.isBgmPlaying) return;
    this.isBgmPlaying = true;
    this.bgmStep = 0;

    const bpm = 124;
    const stepInterval = (60 / bpm / 4) * 1000; // 16th notes

    const bassNotes = [55, 55, 65.4, 55, 51.9, 51.9, 55, 73.4]; // A1, C2, G#1, D2
    const leadNotes = [220, 261.6, 329.6, 392, 440, 329.6, 293.7, 261.6];

    this.bgmInterval = window.setInterval(() => {
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended' || !this.musicGain || gameState.saveData.musicVolume <= 0) return;

      const step = this.bgmStep % 32;

      // Kick drum on 0, 4, 8, 12, 16, 20, 24, 28
      if (step % 4 === 0) {
        const kickOsc = ctx.createOscillator();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(130, ctx.currentTime);
        kickOsc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.1);

        const kickGain = ctx.createGain();
        kickGain.gain.setValueAtTime(0.4 * gameState.saveData.musicVolume, ctx.currentTime);
        kickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        kickOsc.connect(kickGain);
        kickGain.connect(this.musicGain);
        kickOsc.start();
        kickOsc.stop(ctx.currentTime + 0.16);
      }

      // Snare on 4, 12, 20, 28
      if (step % 8 === 4) {
        const snareNoise = ctx.createBufferSource();
        const bSize = Math.floor(ctx.sampleRate * 0.08);
        const buf = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bSize; i++) d[i] = Math.random() * 2 - 1;
        snareNoise.buffer = buf;

        const sFilter = ctx.createBiquadFilter();
        sFilter.type = 'highpass';
        sFilter.frequency.setValueAtTime(1200, ctx.currentTime);

        const sGain = ctx.createGain();
        sGain.gain.setValueAtTime(0.2 * gameState.saveData.musicVolume, ctx.currentTime);
        sGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

        snareNoise.connect(sFilter);
        sFilter.connect(sGain);
        sGain.connect(this.musicGain);
        snareNoise.start();
      }

      // Synth Bass
      if (step % 2 === 0) {
        const bassFreq = bassNotes[Math.floor((step / 4) % bassNotes.length)];
        const bOsc = ctx.createOscillator();
        bOsc.type = 'sawtooth';
        bOsc.frequency.setValueAtTime(bassFreq, ctx.currentTime);

        const bFilter = ctx.createBiquadFilter();
        bFilter.type = 'lowpass';
        bFilter.frequency.setValueAtTime(450, ctx.currentTime);

        const bGain = ctx.createGain();
        bGain.gain.setValueAtTime(0.25 * gameState.saveData.musicVolume, ctx.currentTime);
        bGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

        bOsc.connect(bFilter);
        bFilter.connect(bGain);
        bGain.connect(this.musicGain);
        bOsc.start();
        bOsc.stop(ctx.currentTime + 0.13);
      }

      // Arpeggio Lead
      if (step % 2 === 1) {
        const leadFreq = leadNotes[(step * 3) % leadNotes.length];
        const lOsc = ctx.createOscillator();
        lOsc.type = 'square';
        lOsc.frequency.setValueAtTime(leadFreq, ctx.currentTime);

        const lFilter = ctx.createBiquadFilter();
        lFilter.type = 'lowpass';
        lFilter.frequency.setValueAtTime(1200, ctx.currentTime);

        const lGain = ctx.createGain();
        lGain.gain.setValueAtTime(0.12 * gameState.saveData.musicVolume, ctx.currentTime);
        lGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

        lOsc.connect(lFilter);
        lFilter.connect(lGain);
        lGain.connect(this.musicGain);
        lOsc.start();
        lOsc.stop(ctx.currentTime + 0.11);
      }

      this.bgmStep++;
    }, stepInterval);
  }

  public stopBgm(): void {
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.isBgmPlaying = false;
  }
}

export const audioManager = AudioManager.getInstance();
