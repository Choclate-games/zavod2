export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private muted = false;
  private platformMuted = false;

  setPlatformMuted(muted: boolean): void {
    this.platformMuted = muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted || this.muted ? 0.0001 : .14, this.context.currentTime, .12);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted || this.platformMuted ? 0.0001 : .14, this.context.currentTime, .05);
    }
  }

  unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.0001;
      this.master.connect(this.context.destination);
    }
    void this.context.resume();
  }

  updateEngine(speed: number, throttle: number, muted: boolean): void {
    this.muted = muted;
    if (!this.context || !this.master || this.context.state !== 'running') return;
    if (!this.engineOsc || !this.engineGain) {
      this.engineOsc = this.context.createOscillator();
      this.engineGain = this.context.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const now = this.context.currentTime;
    this.engineOsc.frequency.setTargetAtTime(72 + speed * 8 + throttle * 38, now, .05);
    this.engineGain.gain.setTargetAtTime(this.muted || this.platformMuted ? 0.0001 : .018 + throttle * .028, now, .08);
    this.master.gain.setTargetAtTime(this.muted || this.platformMuted ? 0.0001 : .14, now, .12);
  }

  playCargoImpact(): void {
    this.playTone(105, .1, .045);
  }

  playFinish(): void {
    this.playTone(460, .16, .065);
    window.setTimeout(() => this.playTone(620, .22, .055), 100);
  }

  stopEngine(): void {
    if (!this.context || !this.engineGain) return;
    this.engineGain.gain.setTargetAtTime(0.0001, this.context.currentTime, .08);
  }

  private playTone(frequency: number, duration: number, volume: number): void {
    if (!this.context || !this.master || this.muted || this.platformMuted || this.context.state !== 'running') return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.frequency.value = frequency;
    oscillator.type = 'triangle';
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + .02);
  }
}
