import { events } from '../core/EventBus';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private soundEnabled = true;
  private sfxVolume = 0.85;

  // Continuous sound nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  private tireNoiseNode: AudioBufferSourceNode | null = null;
  private tireNoiseGain: GainNode | null = null;
  private tireFilter: BiquadFilterNode | null = null;

  private nitroNoiseNode: AudioBufferSourceNode | null = null;
  private nitroNoiseGain: GainNode | null = null;

  constructor() {
    events.on('SETTINGS_CHANGED', (settings) => {
      this.soundEnabled = settings.soundEnabled;
      this.sfxVolume = settings.sfxVolume;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(this.soundEnabled ? 1.0 : 0.0, this.ctx.currentTime);
      }
      if (this.sfxGain && this.ctx) {
        this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      }
    });

    const unlockAudio = () => {
      this.init();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
  }

  private init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.soundEnabled ? 1.0 : 0.0, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);

      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.initContinuousLoops();
    } catch (err) {
      console.warn('[AudioManager] Web Audio init error:', err);
    }
  }

  private createNoiseBuffer(durationSec = 2.0): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext missing');
    const bufferSize = this.ctx.sampleRate * durationSec;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private initContinuousLoops(): void {
    if (!this.ctx || !this.sfxGain) return;

    // 1. Engine sound oscillators
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(65, this.ctx.currentTime);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(130, this.ctx.currentTime);

    const distortion = this.ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = (Math.PI + 4) * x / (Math.PI + 4 * Math.abs(x));
    }
    distortion.curve = curve;

    this.engineOsc1.connect(distortion);
    this.engineOsc2.connect(distortion);
    distortion.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc1.start();
    this.engineOsc2.start();

    // 2. Tire Screech Loop
    const tireNoise = this.createNoiseBuffer(2.0);
    this.tireNoiseNode = this.ctx.createBufferSource();
    this.tireNoiseNode.buffer = tireNoise;
    this.tireNoiseNode.loop = true;

    this.tireFilter = this.ctx.createBiquadFilter();
    this.tireFilter.type = 'bandpass';
    this.tireFilter.frequency.setValueAtTime(950, this.ctx.currentTime);
    this.tireFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

    this.tireNoiseGain = this.ctx.createGain();
    this.tireNoiseGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.tireNoiseNode.connect(this.tireFilter);
    this.tireFilter.connect(this.tireNoiseGain);
    this.tireNoiseGain.connect(this.sfxGain);
    this.tireNoiseNode.start();

    // 3. Nitro Roar Loop
    const nitroNoise = this.createNoiseBuffer(2.0);
    this.nitroNoiseNode = this.ctx.createBufferSource();
    this.nitroNoiseNode.buffer = nitroNoise;
    this.nitroNoiseNode.loop = true;

    const nitroFilter = this.ctx.createBiquadFilter();
    nitroFilter.type = 'lowpass';
    nitroFilter.frequency.setValueAtTime(1800, this.ctx.currentTime);

    this.nitroNoiseGain = this.ctx.createGain();
    this.nitroNoiseGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.nitroNoiseNode.connect(nitroFilter);
    nitroFilter.connect(this.nitroNoiseGain);
    this.nitroNoiseGain.connect(this.sfxGain);
    this.nitroNoiseNode.start();
  }

  updateEngine(rpmRatio: number, throttle: number, speedKmh: number, isBoosting: boolean): void {
    if (!this.ctx || !this.engineGain || !this.engineOsc1 || !this.engineOsc2) return;

    const t = this.ctx.currentTime;
    const baseFreq = 50 + rpmRatio * 220 + (isBoosting ? 60 : 0);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, t, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, t, 0.05);

    const gainVal = Math.min(0.35, 0.08 + throttle * 0.22 + (speedKmh / 300) * 0.1);
    this.engineGain.gain.setTargetAtTime(gainVal, t, 0.05);
  }

  updateDrift(slipRatio: number, speedKmh: number): void {
    if (!this.ctx || !this.tireNoiseGain || !this.tireFilter) return;

    const t = this.ctx.currentTime;
    const isDrifting = slipRatio > 0.25 && speedKmh > 20;
    const gainVal = isDrifting ? Math.min(0.4, (slipRatio - 0.25) * 0.6) : 0.0;
    this.tireNoiseGain.gain.setTargetAtTime(gainVal, t, 0.08);

    const freq = 800 + Math.min(1200, speedKmh * 6);
    this.tireFilter.frequency.setTargetAtTime(freq, t, 0.08);
  }

  updateNitro(isBoosting: boolean): void {
    if (!this.ctx || !this.nitroNoiseGain) return;
    const t = this.ctx.currentTime;
    this.nitroNoiseGain.gain.setTargetAtTime(isBoosting ? 0.35 : 0.0, t, 0.1);
  }

  playCollision(impactForce: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.18);

    const vol = Math.min(0.6, 0.15 + (impactForce / 35.0) * 0.4);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  playNearMiss(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(950, t + 0.15);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  playChime(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1320, t + 0.08);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  playVictory(): void {
    if (!this.ctx || !this.sfxGain) return;
    const notes = [440, 554.37, 659.25, 880];
    const t0 = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const t = t0 + idx * 0.12;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }
}

export const audio = new AudioManager();
