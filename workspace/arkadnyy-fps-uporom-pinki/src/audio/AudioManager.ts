import { EventBus } from '../core/EventBus';
import { StorageService } from '../platform/StorageService';

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private isMuted = false;
  private isPlatformMuted = false;
  private bgmOscs: OscillatorNode[] = [];
  private bgmIntervalId: number | null = null;
  private isBgmPlaying = false;

  private constructor() {
    const bus = EventBus.getInstance();
    const storage = StorageService.getInstance();
    const save = storage.getSave();

    this.isMuted = save.settings.soundMuted;

    bus.on('platform:audioMute', ({ muted }) => {
      this.isPlatformMuted = muted;
      this.applyMuteState();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend();
        }
      } else {
        if (this.ctx && this.ctx.state === 'suspended' && !this.isPlatformMuted) {
          this.ctx.resume();
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

  public initContext(): void {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();

      this.masterGain = this.ctx.createGain();
      this.lowpassFilter = this.ctx.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.8, this.ctx.currentTime);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

      this.sfxGain.connect(this.lowpassFilter);
      this.musicGain.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.applyMuteState();
      this.startBgmLoop();
    } catch (e) {
      console.warn('[AudioManager] Failed to init WebAudio context', e);
    }
  }

  public unlockAudio(): void {
    if (!this.ctx) {
      this.initContext();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    StorageService.getInstance().updateSave((s) => {
      s.settings.soundMuted = this.isMuted;
      s.settings.musicMuted = this.isMuted;
    });
    this.applyMuteState();
    return this.isMuted;
  }

  public isSoundMuted(): boolean {
    return this.isMuted;
  }

  private applyMuteState(): void {
    if (!this.masterGain || !this.ctx) return;
    const shouldMute = this.isMuted || this.isPlatformMuted;
    this.masterGain.gain.setValueAtTime(shouldMute ? 0 : 1, this.ctx.currentTime);
  }

  public setSlowmoFilter(active: boolean): void {
    if (!this.lowpassFilter || !this.ctx) return;
    const targetFreq = active ? 600 : 20000;
    this.lowpassFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
  }

  // --- Procedural Sound Synthesis Layers ---

  /** Sub-bass punch (55Hz) + crunchy crack for heavy kinetic kick */
  public playKickHit(isWallSplat: boolean): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.isPlatformMuted) return;
    const t = this.ctx.currentTime;

    // Sub-bass drop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isWallSplat ? 90 : 70, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + (isWallSplat ? 0.25 : 0.15));

    gain.gain.setValueAtTime(isWallSplat ? 1.0 : 0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isWallSplat ? 0.3 : 0.18));

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.35);

    // Crunch noise burst (1.8 kHz bone/armor crush)
    this.playNoiseBurst(isWallSplat ? 0.18 : 0.08, 1800, 1.2);
  }

  /** Air whiff sound on kick miss */
  public playKickWhiff(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.isPlatformMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.18);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  /** Tactical Door Breach: Metal tear (3.2 kHz) + heavy 120Hz timber explosion */
  public playDoorBreach(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.isPlatformMuted) return;
    const t = this.ctx.currentTime;

    // Heavy thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.35);

    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.42);

    // Metal tear crackle
    this.playNoiseBurst(0.25, 3200, 1.5);
  }

  /** Anvil Clang (1.6 kHz) + Pitch Slide (200 -> 800 Hz) on projectile/hazard kick reflect */
  public playAnvilReflect(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.isPlatformMuted) return;
    const t = this.ctx.currentTime;

    // Clang tone
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1600, t);
    osc1.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    gain1.gain.setValueAtTime(0.8, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(t);
    osc1.stop(t + 0.32);

    // Rocket surge
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(200, t);
    osc2.frequency.exponentialRampToValueAtTime(800, t + 0.22);
    gain2.gain.setValueAtTime(0.4, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(t);
    osc2.stop(t + 0.28);
  }

  /** Gun Cocking (2.4 kHz) + 880Hz chime on airborne weapon catch */
  public playWeaponCatch(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.isPlatformMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1320, t + 0.06);
    osc.frequency.setValueAtTime(1760, t + 0.12);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.35);

    this.playNoiseBurst(0.06, 2400, 0.8);
  }

  /** Weapon gunfire sound */
  public playGunshot(type: string, isTrickshot = false): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.isPlatformMuted) return;
    const t = this.ctx.currentTime;

    if (type === 'SHOTGUN') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.2);
      gain.gain.setValueAtTime(isTrickshot ? 1.0 : 0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.26);
      this.playNoiseBurst(0.18, 1200, isTrickshot ? 1.5 : 1.0);
    } else if (type === 'SMG') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(350, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.1);
      this.playNoiseBurst(0.05, 2800, 0.5);
    } else {
      // PISTOL / Handgun
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);
      gain.gain.setValueAtTime(isTrickshot ? 0.8 : 0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.15);
      this.playNoiseBurst(0.08, 2000, 0.7);
    }
  }

  /** Explosion sound for barrels and grenade launchers */
  public playExplosion(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.isPlatformMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.5);
    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.65);

    this.playNoiseBurst(0.45, 800, 1.8);
  }

  /** Player slide dash whoosh */
  public playSlide(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.isPlatformMuted) return;
    this.playNoiseBurst(0.2, 900, 0.4);
  }

  /** UI and upgrade selection fanfares */
  public playUpgradeFanfare(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.isPlatformMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    notes.forEach((freq, idx) => {
      const t = this.ctx!.currentTime + idx * 0.08;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  private playNoiseBurst(duration: number, cutoffHz: number, gainValue: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(cutoffHz, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.0, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start();
  }

  // --- Dynamic Procedural Synth BGM loop ---
  private startBgmLoop(): void {
    if (this.isBgmPlaying || !this.ctx || !this.musicGain) return;
    this.isBgmPlaying = true;

    const bassNotes = [55, 55, 65.41, 55, 73.42, 55, 82.41, 73.42]; // Low A, C, D, E drive
    let step = 0;

    this.bgmIntervalId = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.isMuted || this.isPlatformMuted) return;

      const t = this.ctx.currentTime;
      const freq = bassNotes[step % bassNotes.length];
      step++;

      // Synth Bass Pulse
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, t);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(t);
      osc.stop(t + 0.18);

      // Hi-hat noise tap on 8ths
      if (step % 2 === 1) {
        this.playNoiseBurst(0.03, 7000, 0.05);
      }
    }, 180); // ~133 BPM arcade action tempo
  }
}
