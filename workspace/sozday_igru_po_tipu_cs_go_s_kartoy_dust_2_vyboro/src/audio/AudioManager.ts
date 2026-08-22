/**
 * Web Audio: Procedural Sound Synthesizer (Zero external MP3/WAV files)
 * Authoritative implementation providing audio effects for CS:GO Dust 2 Retake & Duels.
 */
export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private platformMuted = false;
  private volume = 0.7;

  private constructor() {
    const unlock = () => {
      this.ensureContext();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.ctx && this.ctx.state === 'running') {
          void this.ctx.suspend();
        }
      } else {
        if (this.ctx && this.ctx.state === 'suspended' && !this.muted && !this.platformMuted) {
          void this.ctx.resume();
        }
      }
    });
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted || this.platformMuted ? 0.0001 : this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.updateGain();
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    this.updateGain();
    return this.muted;
  }

  public setPlatformMuted(muted: boolean): void {
    this.platformMuted = muted;
    this.updateGain();
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.updateGain();
  }

  private updateGain(): void {
    if (this.masterGain && this.ctx) {
      const target = this.muted || this.platformMuted ? 0.0001 : this.volume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
    }
  }

  private createNoiseBuffer(duration = 0.5): AudioBuffer | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // ────────────────────────────────────────── WEAPONS

  public playGunshot(weapon: 'ak47' | 'm4a4' | 'awp' | 'deagle'): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const noise = ctx.createBufferSource();
    const noiseBuffer = this.createNoiseBuffer(0.4);
    if (!noiseBuffer) return;
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();

    if (weapon === 'awp') {
      // Sub-bass heavy crack
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.35);
      oscGain.gain.setValueAtTime(1.0, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1200, t);
      noiseFilter.frequency.exponentialRampToValueAtTime(300, t + 0.4);
      noiseFilter.Q.value = 1.2;

      noiseGain.gain.setValueAtTime(1.2, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    } else if (weapon === 'm4a4') {
      // Snappy suppressed crack
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.15);
      oscGain.gain.setValueAtTime(0.7, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(2200, t);
      noiseFilter.frequency.exponentialRampToValueAtTime(600, t + 0.2);
      noiseFilter.Q.value = 2.0;

      noiseGain.gain.setValueAtTime(0.8, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    } else if (weapon === 'deagle') {
      // High punch pistol
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
      oscGain.gain.setValueAtTime(0.9, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(1400, t);
      noiseGain.gain.setValueAtTime(0.9, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    } else {
      // AK-47: Classic bass body + sharp mid crack
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.22);
      oscGain.gain.setValueAtTime(0.8, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1800, t);
      noiseFilter.frequency.exponentialRampToValueAtTime(400, t + 0.25);
      noiseFilter.Q.value = 1.5;

      noiseGain.gain.setValueAtTime(1.0, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    }

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.4);
    noise.start(t);
    noise.stop(t + 0.4);
  }

  public playHeadshot(): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    // Metallic helmet dink (high sine bell)
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(3200, t);
    bell.frequency.exponentialRampToValueAtTime(1800, t + 0.18);
    bellGain.gain.setValueAtTime(1.0, t);
    bellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    // Helmet crunch noise
    const noise = ctx.createBufferSource();
    const nBuf = this.createNoiseBuffer(0.12);
    if (!nBuf) return;
    noise.buffer = nBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2500, t);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.8, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    bell.connect(bellGain);
    bellGain.connect(this.masterGain);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);

    bell.start(t);
    bell.stop(t + 0.2);
    noise.start(t);
    noise.stop(t + 0.15);
  }

  public playHit(): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playWallbangHit(): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    // Wood splinter crack
    const noise = ctx.createBufferSource();
    const nBuf = this.createNoiseBuffer(0.1);
    if (!nBuf) return;
    noise.buffer = nBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, t);
    filter.Q.value = 3.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.1);
  }

  public playFootstep(surface: 'sand' | 'stone' = 'sand'): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    const noise = ctx.createBufferSource();
    const nBuf = this.createNoiseBuffer(0.08);
    if (!nBuf) return;
    noise.buffer = nBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(surface === 'sand' ? 450 : 900, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.08);
  }

  public playScuffStep(): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    const noise = ctx.createBufferSource();
    const nBuf = this.createNoiseBuffer(0.06);
    if (!nBuf) return;
    noise.buffer = nBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.Q.value = 2.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.06);
  }

  // ────────────────────────────────────────── C4 & OBJECTIVES

  public playC4Beep(frequency = 1000): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, t);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  public playC4DefuseStart(): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    // Metallic click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.09);

    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playC4DefuseAbort(): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.05);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  public playC4Explosion(): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    // Massive bass blast
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 1.2);
    oscGain.gain.setValueAtTime(1.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    const noise = ctx.createBufferSource();
    const nBuf = this.createNoiseBuffer(1.5);
    if (!nBuf) return;
    noise.buffer = nBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + 1.5);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(1.2, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 1.3);
    noise.start(t);
    noise.stop(t + 1.5);
  }

  public playSmokeHiss(): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    const noise = ctx.createBufferSource();
    const nBuf = this.createNoiseBuffer(1.2);
    if (!nBuf) return;
    noise.buffer = nBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(600, t + 1.2);
    filter.Q.value = 1.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 1.2);
  }

  public playReload(): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    // Mag out click
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(600, t);
    osc1.frequency.exponentialRampToValueAtTime(200, t + 0.08);
    g1.gain.setValueAtTime(0.5, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc1.connect(g1);
    g1.connect(this.masterGain);
    osc1.start(t);
    osc1.stop(t + 0.09);

    // Mag in bolt snap (after 0.4s)
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(800, t + 0.4);
    osc2.frequency.exponentialRampToValueAtTime(250, t + 0.49);
    g2.gain.setValueAtTime(0.6, t + 0.4);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.49);
    osc2.connect(g2);
    g2.connect(this.masterGain);
    osc2.start(t + 0.4);
    osc2.stop(t + 0.5);
  }

  public playWinJingle(): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    const notes = [440, 554.37, 659.25, 880]; // A major chord
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.08);
      gain.gain.setValueAtTime(0.4, t + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.8);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.8);
    });
  }

  public playLoseJingle(): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    const notes = [440, 415.3, 370, 329.6]; // Melancholy descending
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t + i * 0.12);
      gain.gain.setValueAtTime(0.3, t + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.7);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.7);
    });
  }

  public playUiClick(): void {
    if (this.muted || this.platformMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.exponentialRampToValueAtTime(450, t + 0.04);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }
}

export const audio = AudioManager.getInstance();
