import type { EventBus } from '../core/EventBus';
import type { SettingsState } from '../game/types';

type ToneKind = 'shot' | 'merge' | 'coin' | 'damage' | 'button';

export class AudioManager {
  private readonly context: AudioContext;
  private readonly master: GainNode;
  private playerMuted = false;
  private platformEnabled = true;
  private unlocked = false;

  constructor(bus: EventBus, settings: SettingsState) {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.connect(this.context.destination);
    this.playerMuted = settings.muted;
    this.applyGain();

    const unlock = (): void => {
      if (this.unlocked) return;
      this.unlocked = true;
      void this.context.resume();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    bus.on('turret:merged', ({ tier }) => this.playTone('merge', 280 + tier * 28, 0.12));
    bus.on('turret:bought', () => this.playTone('button', 220, 0.08));
    bus.on('enemy:hit', ({ critical }) => this.playTone('shot', critical ? 620 : 430, critical ? 0.09 : 0.05));
    bus.on('enemy:killed', () => this.playTone('coin', 780, 0.1));
    bus.on('base:damaged', () => this.playTone('damage', 110, 0.22));
    bus.on('audio:mute', ({ muted }) => {
      this.playerMuted = muted;
      this.applyGain();
    });
    bus.on('platform:audio', ({ enabled }) => {
      this.platformEnabled = enabled;
      this.applyGain();
    });
  }

  private playTone(kind: ToneKind, frequency: number, duration: number): void {
    if (!this.unlocked || this.context.state !== 'running') return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = kind === 'damage' ? 'sawtooth' : kind === 'coin' ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(frequency, this.context.currentTime);
    gain.gain.setValueAtTime(0.0001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, this.context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.context.currentTime + duration + 0.02);
  }

  private applyGain(): void {
    const target = this.playerMuted || !this.platformEnabled ? 0.0001 : 0.85;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.linearRampToValueAtTime(target, this.context.currentTime + 0.08);
  }
}
