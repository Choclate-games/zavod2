export class AudioManager {
  private static instance: AudioManager;
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private motorOsc1: OscillatorNode | null = null;
  private motorOsc2: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;

  private isPlayerMuted = false;
  private isPlatformMuted = false;
  private isAudioUnlocked = false;

  private lastCrunchTime = 0;
  private readonly MIN_CRUNCH_INTERVAL_MS = 28; // Prevents audio stutter when 100s of voxels crush simultaneously

  private constructor() {}

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public init(): void {
    if (this.audioCtx) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);

      this.setupUnlockGestures();
    } catch (e) {
      console.warn('[AudioManager] Web Audio API not supported:', e);
    }
  }

  private setupUnlockGestures(): void {
    const unlock = () => {
      if (this.isAudioUnlocked) return;
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().then(() => {
          this.isAudioUnlocked = true;
          this.startContinuousMotor();
        });
      } else {
        this.isAudioUnlocked = true;
        this.startContinuousMotor();
      }

      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  public setPlayerMuted(muted: boolean): void {
    this.isPlayerMuted = muted;
    this.updateMasterVolume();
  }

  public setPlatformMuted(muted: boolean): void {
    this.isPlatformMuted = muted;
    this.updateMasterVolume();
  }

  public isMuted(): boolean {
    return this.isPlayerMuted;
  }

  private updateMasterVolume(): void {
    if (!this.masterGain || !this.audioCtx) return;
    const target = this.isPlayerMuted || this.isPlatformMuted ? 0.0 : 0.7;
    const now = this.audioCtx.currentTime;
    // Smooth ramp to avoid clicks
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(target, now + 0.05);
  }

  /**
   * Procedural continuous industrial gear / roller hum
   */
  private startContinuousMotor(): void {
    if (!this.audioCtx || !this.masterGain || this.motorOsc1) return;

    try {
      this.motorOsc1 = this.audioCtx.createOscillator();
      this.motorOsc2 = this.audioCtx.createOscillator();
      this.motorGain = this.audioCtx.createGain();

      this.motorOsc1.type = 'triangle';
      this.motorOsc1.frequency.setValueAtTime(55, this.audioCtx.currentTime); // Low A

      this.motorOsc2.type = 'sawtooth';
      this.motorOsc2.frequency.setValueAtTime(110, this.audioCtx.currentTime);

      this.motorGain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, this.audioCtx.currentTime);

      this.motorOsc1.connect(filter);
      this.motorOsc2.connect(filter);
      filter.connect(this.motorGain);
      this.motorGain.connect(this.masterGain);

      this.motorOsc1.start();
      this.motorOsc2.start();
    } catch (e) {
      console.warn('[AudioManager] Error starting motor sound:', e);
    }
  }

  /**
   * Modulate motor pitch based on speed / turbo
   */
  public setMotorSpeed(speedMultiplier: number): void {
    if (!this.audioCtx || !this.motorOsc1 || !this.motorOsc2 || !this.motorGain) return;
    const now = this.audioCtx.currentTime;
    const baseFreq = 55 * Math.min(2.5, Math.max(0.8, speedMultiplier * 0.9));
    this.motorOsc1.frequency.setTargetAtTime(baseFreq, now, 0.1);
    this.motorOsc2.frequency.setTargetAtTime(baseFreq * 2, now, 0.1);

    const targetGain = speedMultiplier > 1.5 ? 0.08 : 0.04;
    this.motorGain.gain.setTargetAtTime(targetGain, now, 0.1);
  }

  /**
   * Procedural ASMR Voxel Snap / Crunch with random pitch variation
   */
  public playVoxelCrunch(count = 1): void {
    if (this.isPlayerMuted || this.isPlatformMuted || !this.audioCtx || !this.masterGain) return;

    const nowMs = performance.now();
    if (nowMs - this.lastCrunchTime < this.MIN_CRUNCH_INTERVAL_MS) return;
    this.lastCrunchTime = nowMs;

    const now = this.audioCtx.currentTime;

    // White/Pink noise burst for tactile crunch
    const bufferSize = this.audioCtx.sampleRate * 0.04; // 40ms buffer
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    // Pitch shift via randomized filter
    const pitchShift = 1 + (Math.random() * 0.3 - 0.15); // +/- 15%
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400 * pitchShift, now);
    filter.Q.setValueAtTime(3.0, now);

    const env = this.audioCtx.createGain();
    const vol = Math.min(0.28, 0.12 + Math.min(count, 10) * 0.015);
    env.gain.setValueAtTime(vol, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    // Add slight low-frequency click for impact
    const clickOsc = this.audioCtx.createOscillator();
    const clickGain = this.audioCtx.createGain();
    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(220 * pitchShift, now);
    clickOsc.frequency.exponentialRampToValueAtTime(60, now + 0.03);
    clickGain.gain.setValueAtTime(0.1, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    noise.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    clickOsc.connect(clickGain);
    clickGain.connect(this.masterGain);

    noise.start(now);
    clickOsc.start(now);
    noise.stop(now + 0.05);
    clickOsc.stop(now + 0.035);
  }

  /**
   * Cascading pentatonic coin chime
   */
  public playCoinChime(pitchIndex = 0): void {
    if (this.isPlayerMuted || this.isPlatformMuted || !this.audioCtx || !this.masterGain) return;
    const now = this.audioCtx.currentTime;

    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C5 to C6 pentatonic
    const freq = scale[Math.abs(pitchIndex) % scale.length];

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * UI Click / Soft Bubble Pop
   */
  public playUiClick(): void {
    if (this.isPlayerMuted || this.isPlatformMuted || !this.audioCtx || !this.masterGain) return;
    const now = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Triumphant Victory Major Fanfare
   */
  public playVictoryFanfare(): void {
    if (this.isPlayerMuted || this.isPlatformMuted || !this.audioCtx || !this.masterGain) return;
    const now = this.audioCtx.currentTime;

    // Arpeggio notes: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      if (!this.audioCtx || !this.masterGain) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      const startTime = now + i * 0.1;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.45);
    });
  }
}
