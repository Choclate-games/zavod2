import { Howler } from 'howler';
import { eventBus } from '../core/EventBus.ts';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicNodes: AudioNode[] = [];
  private started = false;
  private userMuted = false;
  private platformMuted = false;
  private musicVolume = 0.5;
  private sfxVolume = 0.4;
  private currentTrack: string | null = null;

  constructor() {
    this.bindEvents();
  }

  private bindEvents(): void {
    eventBus.on('audio:laser', () => this.playSfx('laser'));
    eventBus.on('terrain:drilled', () => this.playSfx('drill'));
    eventBus.on('enemy:died', () => this.playSfx('explosion'));
    eventBus.on('player:died', () => this.playSfx('gameover'));
    eventBus.on('boss:defeated', () => this.playSfx('victory'));
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.updateGain();
    }
    return this.ctx;
  }

  resumeOnGesture(): void {
    if (this.started) return;
    const resume = () => {
      if (this.started) return;
      this.started = true;
      this.ensureContext().resume();
      Howler.ctx?.resume();
      this.updateGain();
      if (this.currentTrack) this.playMusic(this.currentTrack as 'menu' | 'drill');
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
  }

  setMuted(muted: boolean): void {
    this.userMuted = muted;
    this.updateGain();
  }

  setMasterVolume(volume: number): void {
    this.musicVolume = volume;
    this.updateGain();
  }

  setPlatformMuted(muted: boolean): void {
    this.platformMuted = muted;
    this.updateGain();
  }

  playMusic(track: 'menu' | 'drill'): void {
    this.currentTrack = track;
    if (!this.started) return;
    this.stopMusic();
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = track === 'menu' ? 55 : 80;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    this.musicNodes.push(osc, gain);
  }

  stopMusic(): void {
    for (const node of this.musicNodes) {
      try {
        if (node instanceof OscillatorNode) node.stop();
        node.disconnect();
      } catch {}
    }
    this.musicNodes = [];
  }

  playSfx(name: string): void {
    if (!this.started || this.userMuted || this.platformMuted) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain!);

    switch (name) {
      case 'laser':
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(220, t + 0.1);
        gain.gain.setValueAtTime(this.sfxVolume * 0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      case 'drill':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.linearRampToValueAtTime(80, t + 0.08);
        gain.gain.setValueAtTime(this.sfxVolume * 0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.start(t);
        osc.stop(t + 0.08);
        break;
      case 'explosion':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(20, t + 0.25);
        gain.gain.setValueAtTime(this.sfxVolume * 0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.start(t);
        osc.stop(t + 0.25);
        break;
      case 'gameover':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.linearRampToValueAtTime(55, t + 0.8);
        gain.gain.setValueAtTime(this.sfxVolume * 0.4, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.8);
        osc.start(t);
        osc.stop(t + 0.8);
        break;
      case 'victory':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.setValueAtTime(554, t + 0.15);
        osc.frequency.setValueAtTime(659, t + 0.3);
        gain.gain.setValueAtTime(this.sfxVolume * 0.3, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.6);
        osc.start(t);
        osc.stop(t + 0.6);
        break;
      default:
        osc.disconnect();
        gain.disconnect();
    }
  }

  private updateGain(): void {
    if (!this.masterGain || !this.ctx) return;
    const target = (this.userMuted || this.platformMuted) ? 0 : this.musicVolume;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
  }
}
