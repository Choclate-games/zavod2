import { gameStore } from './Store';

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  // Continuous Engine Sound Nodes
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Continuous Drift Screech Nodes
  private driftNoiseNode: AudioBufferSourceNode | null = null;
  private driftGain: GainNode | null = null;
  private driftFilter: BiquadFilterNode | null = null;

  // Background Music Sequencer
  private musicInterval: number | null = null;
  private musicStep = 0;

  private isMuted = false;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public init(): void {
    if (this.isInitialized) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      this.masterGain.gain.value = 0.8;
      this.sfxGain.gain.value = 0.9;
      this.musicGain.gain.value = 0.35;

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.setupEngineSynth();
      this.setupDriftSynth();
      this.startMusic();

      this.isInitialized = true;

      // Resume on first user interaction
      const resume = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        window.removeEventListener('click', resume);
        window.removeEventListener('keydown', resume);
        window.removeEventListener('touchstart', resume);
      };
      window.addEventListener('click', resume);
      window.addEventListener('keydown', resume);
      window.addEventListener('touchstart', resume);
    } catch (e) {
      console.warn('[AudioManager] WebAudio init error:', e);
    }
  }

  private setupEngineSynth(): void {
    if (!this.ctx || !this.sfxGain) return;

    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineSubOsc = this.ctx.createOscillator();
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 45;

      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.value = 22.5;

      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 220;

      this.engineGain.gain.value = 0;

      this.engineOsc.connect(this.engineFilter);
      this.engineSubOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);

      this.engineOsc.start();
      this.engineSubOsc.start();
    } catch (e) {
      console.warn('Engine synth init error', e);
    }
  }

  private setupDriftSynth(): void {
    if (!this.ctx || !this.sfxGain) return;

    try {
      // Generate 2 seconds of white noise buffer
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.driftNoiseNode = this.ctx.createBufferSource();
      this.driftNoiseNode.buffer = noiseBuffer;
      this.driftNoiseNode.loop = true;

      this.driftFilter = this.ctx.createBiquadFilter();
      this.driftFilter.type = 'bandpass';
      this.driftFilter.frequency.value = 1400;
      this.driftFilter.Q.value = 4.0;

      this.driftGain = this.ctx.createGain();
      this.driftGain.gain.value = 0;

      this.driftNoiseNode.connect(this.driftFilter);
      this.driftFilter.connect(this.driftGain);
      this.driftGain.connect(this.sfxGain);

      this.driftNoiseNode.start();
    } catch (e) {
      console.warn('Drift synth init error', e);
    }
  }

  public updateEngine(speedNormalized: number, isDrifting: boolean, isNitro: boolean): void {
    if (!this.ctx || !this.engineGain || !this.engineOsc || !this.engineSubOsc || !this.engineFilter) return;
    if (!gameStore.save.soundEnabled || this.isMuted) {
      this.engineGain.gain.value = 0;
      if (this.driftGain) this.driftGain.gain.value = 0;
      return;
    }

    const baseFreq = isNitro ? 85 : 45;
    const targetFreq = baseFreq + speedNormalized * (isNitro ? 110 : 80);
    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
    this.engineSubOsc.frequency.setTargetAtTime(targetFreq * 0.5, this.ctx.currentTime, 0.05);

    const filterFreq = 180 + speedNormalized * 600 + (isNitro ? 400 : 0);
    this.engineFilter.frequency.setTargetAtTime(filterFreq, this.ctx.currentTime, 0.08);

    const targetGain = 0.15 + speedNormalized * 0.18 + (isNitro ? 0.1 : 0);
    this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);

    // Drift Screech
    if (this.driftGain && this.driftFilter) {
      if (isDrifting && speedNormalized > 0.2) {
        const driftVol = Math.min(0.28, speedNormalized * 0.3);
        this.driftGain.gain.setTargetAtTime(driftVol, this.ctx.currentTime, 0.05);
        this.driftFilter.frequency.setTargetAtTime(1100 + speedNormalized * 600, this.ctx.currentTime, 0.05);
      } else {
        this.driftGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
    }
  }

  // SFX Throttling timers to prevent WebAudio audio-thread stalls
  private lastRamTime = 0;
  private lastSplatterTime = 0;
  private lastMinigunTime = 0;
  private lastFlameTime = 0;
  private lastZapTime = 0;
  private lastExplosionTime = 0;
  private lastScrapTime = 0;

  public playRamImpact(intensity = 1.0): void {
    if (!this.canPlaySfx()) return;
    const now = performance.now();
    if (now - this.lastRamTime < 90) return;
    this.lastRamTime = now;

    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(Math.min(0.8, 0.4 * intensity), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  public playSplatter(): void {
    if (!this.canPlaySfx()) return;
    const now = performance.now();
    if (now - this.lastSplatterTime < 70) return;
    this.lastSplatterTime = now;

    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(280 + Math.random() * 80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  public playMinigunShot(): void {
    if (!this.canPlaySfx()) return;
    const now = performance.now();
    if (now - this.lastMinigunTime < 60) return;
    this.lastMinigunTime = now;

    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(450, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  }

  public playFlamethrower(): void {
    if (!this.canPlaySfx()) return;
    const now = performance.now();
    if (now - this.lastFlameTime < 100) return;
    this.lastFlameTime = now;

    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  public playShockZap(): void {
    if (!this.canPlaySfx()) return;
    const now = performance.now();
    if (now - this.lastZapTime < 110) return;
    this.lastZapTime = now;

    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  public playExplosion(): void {
    if (!this.canPlaySfx()) return;
    const now = performance.now();
    if (now - this.lastExplosionTime < 120) return;
    this.lastExplosionTime = now;

    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.7, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  }

  public playNitroWhoosh(): void {
    if (!this.canPlaySfx()) return;
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  public playScrapPickup(): void {
    if (!this.canPlaySfx()) return;
    const now = performance.now();
    if (now - this.lastScrapTime < 45) return;
    this.lastScrapTime = now;

    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(700 + Math.random() * 200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  public playLevelUp(): void {
    if (!this.canPlaySfx()) return;
    const ctx = this.ctx!;
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;

      const startTime = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  }

  private lastCrateTime = 0;
  private lastBoostTime = 0;
  private lastObstacleHitTime = 0;
  private lastAcidTime = 0;

  public playObstacleHit(intensity = 1.0): void {
    if (!this.canPlaySfx()) return;
    const now = performance.now();
    if (now - this.lastObstacleHitTime < 80) return;
    this.lastObstacleHitTime = now;

    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(Math.min(0.7, 0.35 * intensity), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  }

  public playCrateSmash(): void {
    if (!this.canPlaySfx()) return;
    const now = performance.now();
    if (now - this.lastCrateTime < 80) return;
    this.lastCrateTime = now;

    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  }

  public playBoostPad(): void {
    if (!this.canPlaySfx()) return;
    const now = performance.now();
    if (now - this.lastBoostTime < 300) return;
    this.lastBoostTime = now;

    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.28);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.32);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  }

  public playAcidSizzle(): void {
    if (!this.canPlaySfx()) return;
    const now = performance.now();
    if (now - this.lastAcidTime < 150) return;
    this.lastAcidTime = now;

    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(550 + Math.random() * 200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  public playButtonClick(): void {
    if (!this.canPlaySfx()) return;
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  // Dynamic Industrial Synth Bassline Beat
  private startMusic(): void {
    if (this.musicInterval) return;

    const bassNotes = [55, 55, 65.4, 55, 73.4, 55, 49, 55]; // A1 progression
    const tempo = 135; // BPM
    const intervalMs = (60 / tempo / 2) * 1000;

    this.musicInterval = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || !gameStore.save.musicEnabled || this.isMuted) return;

      const step = this.musicStep % 16;
      this.musicStep++;

      // Synth Bass
      if (step % 2 === 0) {
        const noteIdx = Math.floor(step / 2) % bassNotes.length;
        const freq = bassNotes[noteIdx];
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.value = freq;

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.18);

        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
      }

      // Kick Beat on 0, 4, 8, 12
      if (step % 4 === 0) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();

        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(120, this.ctx.currentTime);
        kickOsc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.1);

        kickGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        kickGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

        kickOsc.connect(kickGain);
        kickGain.connect(this.musicGain);

        kickOsc.start();
        kickOsc.stop(this.ctx.currentTime + 0.12);
      }

      // Hi-hat on off-beats
      if (step % 2 === 1) {
        const hhOsc = this.ctx.createOscillator();
        const hhGain = this.ctx.createGain();
        hhOsc.type = 'triangle';
        hhOsc.frequency.value = 8000;

        hhGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        hhGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

        hhOsc.connect(hhGain);
        hhGain.connect(this.musicGain);

        hhOsc.start();
        hhOsc.stop(this.ctx.currentTime + 0.03);
      }
    }, intervalMs);
  }

  private canPlaySfx(): boolean {
    return !!(this.ctx && this.sfxGain && gameStore.save.soundEnabled && !this.isMuted);
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    }
  }

  public setSoundEnabled(enabled: boolean): void {
    gameStore.save.soundEnabled = enabled;
    gameStore.saveData();
  }

  public setMusicEnabled(enabled: boolean): void {
    gameStore.save.musicEnabled = enabled;
    gameStore.saveData();
    if (!enabled && this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    } else if (enabled && this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(0.35, this.ctx.currentTime, 0.05);
    }
  }
}

export const audioManager = AudioManager.getInstance();
