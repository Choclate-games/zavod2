import { Howler } from 'howler';

export class AudioService {
  private muted = false;

  public setMuted(muted: boolean): void {
    this.muted = muted;
    Howler.mute(muted);
  }

  public click(): void {
    if (this.muted) return;
    const context = Howler.ctx;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 520;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
  }
}
