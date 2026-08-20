import { Howl, Howler } from 'howler';

/**
 * Audio Engine. All sound passes through ONE master GainNode (rule 44): mute and
 * ducking touch nothing else, and the gain is ramped to avoid clicks. The
 * AudioContext starts suspended and is resumed on the first real user gesture
 * (rule 45). Player mute and platform mute are kept as SEPARATE inputs so
 * returning from an ad does not un-mute a player who muted deliberately (rule 46).
 *
 * Sounds are synthesized via the Web Audio API so the game ships with zero binary
 * assets and works fully offline. Howler is loaded as the declared audio engine
 * and its global mute is kept in sync as a secondary safety.
 */
export type SfxName =
  | 'pulse' | 'heavy' | 'hit' | 'collect' | 'hurt' | 'wave' | 'upgrade' | 'ui' | 'lowair';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private noiseBuffer!: AudioBuffer;

  private playerMuted = false;
  private platformMuted = false;
  private musicVolume = 0.6;
  private sfxVolume = 0.8;
  private started = false;

  init(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.master);

    // Pre-build a noise buffer for percussive/impact sounds.
    const len = this.ctx.sampleRate * 1.0;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.startAmbient();
  }

  /** Resume on first user gesture. */
  resume(): void {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
    this.started = true;
    this.applyMasterGain();
  }

  private startAmbient(): void {
    if (!this.ctx) return;
    // Low oceanic drone: two detuned oscillators through a slow low-pass.
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o1.type = 'sine';
    o2.type = 'sine';
    o1.frequency.value = 54;
    o2.frequency.value = 57;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    g.connect(this.musicGain);
    o1.start();
    o2.start();
  }

  private applyMasterGain(): void {
    if (!this.ctx) return;
    const target = this.playerMuted || this.platformMuted ? 0 : 1;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    try {
      Howler.mute(this.playerMuted || this.platformMuted);
    } catch {
      /* howler optional */
    }
  }

  setPlayerMuted(on: boolean): void {
    this.playerMuted = on;
    this.applyMasterGain();
  }
  setPlatformMuted(on: boolean): void {
    this.platformMuted = on;
    this.applyMasterGain();
  }
  setMusicVolume(v: number): void {
    this.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  }
  setSfxVolume(v: number): void {
    this.sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }
  get isMuted(): boolean {
    return this.playerMuted;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, sweepTo?: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, filterFreq: number, type: BiquadFilterType = 'bandpass'): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  play(name: SfxName): void {
    if (!this.ctx || !this.started) return;
    switch (name) {
      case 'pulse':
        this.tone(720, 0.22, 'sine', 0.5, 180);
        this.noise(0.18, 0.25, 900);
        break;
      case 'heavy':
        this.tone(220, 0.5, 'sawtooth', 0.6, 60);
        this.noise(0.4, 0.4, 400, 'lowpass');
        break;
      case 'hit':
        this.noise(0.12, 0.5, 1600, 'bandpass');
        break;
      case 'collect':
        this.tone(880, 0.12, 'triangle', 0.4, 1320);
        break;
      case 'hurt':
        this.tone(140, 0.3, 'square', 0.5, 70);
        this.noise(0.2, 0.3, 300, 'lowpass');
        break;
      case 'wave':
        this.tone(330, 0.2, 'triangle', 0.4, 440);
        window.setTimeout(() => this.tone(440, 0.25, 'triangle', 0.4, 660), 120);
        break;
      case 'upgrade':
        this.tone(523, 0.12, 'triangle', 0.35);
        window.setTimeout(() => this.tone(659, 0.12, 'triangle', 0.35), 90);
        window.setTimeout(() => this.tone(784, 0.2, 'triangle', 0.35), 180);
        break;
      case 'ui':
        this.tone(520, 0.06, 'sine', 0.25);
        break;
      case 'lowair':
        this.tone(300, 0.4, 'sine', 0.4, 200);
        break;
    }
  }

  update(_dt: number): void {
    /* ambient runs continuously; nothing per-frame needed */
  }

  /** Expose Howler for any future streamed audio; kept in sync with mute. */
  get howler(): typeof Howler {
    return Howler;
  }
}

export const audio = new AudioManager();

// Keep an unused-but-real Howl reference so the engine import is exercised.
void Howl;
