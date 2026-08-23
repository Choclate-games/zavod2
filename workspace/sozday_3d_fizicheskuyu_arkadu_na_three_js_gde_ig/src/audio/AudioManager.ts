/**
 * Procedural Web Audio Synthesizer.
 * Synthesizes dynamic metro sounds without external audio files.
 * Lazy AudioContext initialization on first user gesture.
 */

import { StorageService } from '../platform/StorageService';

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private trainHumOsc: OscillatorNode | null = null;
  private trainHumGain: GainNode | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  public static get(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const setupContext = () => {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
          this.masterGain = this.ctx.createGain();
          this.masterGain.connect(this.ctx.destination);
          this.setMuted(!StorageService.get().getData().soundEnabled);
          this.startTrainHum();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      window.removeEventListener('pointerdown', setupContext);
      window.removeEventListener('keydown', setupContext);
    };

    window.addEventListener('pointerdown', setupContext, { once: false });
    window.addEventListener('keydown', setupContext, { once: false });

    // Handle tab visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend().catch(() => {});
        }
      } else {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      }
    });
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    const nextMute = !this.isMuted;
    this.setMuted(nextMute);
    StorageService.get().setSoundEnabled(!nextMute);
    return !nextMute;
  }

  public updateTrainSpeed(speedKmH: number): void {
    if (!this.ctx || !this.trainHumOsc || !this.trainHumGain || this.isMuted) return;
    const normSpeed = Math.min(1.2, Math.max(0.1, speedKmH / 70));
    const targetFreq = 45 + normSpeed * 75;
    this.trainHumOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    this.trainHumGain.gain.setTargetAtTime(0.08 + normSpeed * 0.12, this.ctx.currentTime, 0.1);
  }

  private startTrainHum(): void {
    if (!this.ctx || !this.masterGain) return;
    try {
      this.trainHumOsc = this.ctx.createOscillator();
      this.trainHumOsc.type = 'sawtooth';
      this.trainHumOsc.frequency.value = 55;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 180;

      this.trainHumGain = this.ctx.createGain();
      this.trainHumGain.gain.value = 0.08;

      this.trainHumOsc.connect(filter);
      filter.connect(this.trainHumGain);
      this.trainHumGain.connect(this.masterGain);

      this.trainHumOsc.start();
    } catch (e) {
      console.warn('Audio train hum start failed:', e);
    }
  }

  public playSound(name: string): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime;

    switch (name) {
      case 'click': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.06);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.07);
        break;
      }
      case 'step': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.09);
        break;
      }
      case 'crouch': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(90, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.26);
        break;
      }
      case 'grip': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.16);
        break;
      }
      case 'slosh': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(180, t + 0.2);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.21);
        break;
      }
      case 'screech': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2400, t);
        osc.frequency.linearRampToValueAtTime(2800, t + 0.35);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.36);
        break;
      }
      case 'victory': {
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          if (!this.ctx || !this.masterGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const noteTime = t + idx * 0.12;
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, noteTime);
          gain.gain.setValueAtTime(0.35, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.35);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(noteTime);
          osc.stop(noteTime + 0.36);
        });
        break;
      }
      case 'crash': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(25, t + 0.5);
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.51);
        break;
      }
    }
  }
}
