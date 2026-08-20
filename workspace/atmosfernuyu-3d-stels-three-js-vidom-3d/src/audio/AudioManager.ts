import { eventBus } from '../core/EventBus';
import { storageService } from '../platform/StorageService';

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private isPlayerMuted = false;
  private isPlatformMuted = false;

  private bgmOsc1: OscillatorNode | null = null;
  private bgmOsc2: OscillatorNode | null = null;

  private constructor() {
    this.isPlayerMuted = storageService.getData().settings.soundMuted;

    // Hook platform mute changes
    eventBus.on('platform:audio_state', ({ isAudioEnabled }: { isAudioEnabled: boolean }) => {
      this.isPlatformMuted = !isAudioEnabled;
      this.applyMuteState();
    });

    // Unlock on first pointer/key gesture
    const unlock = () => {
      this.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private initContext(): void {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.8;
    this.sfxGain.connect(this.masterGain);

    this.applyMuteState();
  }

  unlock(): void {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.startAmbientBGM();
      }).catch(() => {});
    } else {
      this.startAmbientBGM();
    }
  }

  setPlayerMute(muted: boolean): void {
    this.isPlayerMuted = muted;
    storageService.updateData((d) => {
      d.settings.soundMuted = muted;
    });
    this.applyMuteState();
  }

  toggleMute(): boolean {
    this.setPlayerMute(!this.isPlayerMuted);
    return this.isPlayerMuted;
  }

  get isMuted(): boolean {
    return this.isPlayerMuted || this.isPlatformMuted;
  }

  private applyMuteState(): void {
    if (!this.masterGain || !this.ctx) return;
    const targetGain = this.isMuted ? 0 : 1;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.05);
  }

  // --- Sound Effects Synthesizer ---

  playSonarPulse(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.6);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.7);
  }

  playAttackSwipe(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playImpact(isHeavy = false): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isHeavy ? 120 : 180, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + (isHeavy ? 0.25 : 0.15));

    gain.gain.setValueAtTime(isHeavy ? 0.6 : 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + (isHeavy ? 0.28 : 0.16));

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playDash(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playLootPickup(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const notes = [523.25, 659.25, 783.99, 1046.5];
    const note = notes[Math.floor(Math.random() * notes.length)];

    osc.type = 'sine';
    osc.frequency.setValueAtTime(note, now);
    osc.frequency.exponentialRampToValueAtTime(note * 1.5, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  playWaveClear(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const chords = [440, 554.37, 659.25, 880];
    chords.forEach((freq, idx) => {
      const now = this.ctx!.currentTime + idx * 0.08;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(now);
      osc.stop(now + 0.6);
    });
  }

  playAlert(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.1);
    osc.frequency.linearRampToValueAtTime(300, now + 0.2);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.28);
  }

  playButtonClick(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  startAmbientBGM(): void {
    if (!this.ctx || !this.musicGain || this.bgmOsc1) return;

    try {
      const now = this.ctx.currentTime;

      this.bgmOsc1 = this.ctx.createOscillator();
      this.bgmOsc2 = this.ctx.createOscillator();
      const bgmGain = this.ctx.createGain();

      this.bgmOsc1.type = 'sine';
      this.bgmOsc1.frequency.setValueAtTime(110, now); // A2

      this.bgmOsc2.type = 'triangle';
      this.bgmOsc2.frequency.setValueAtTime(164.81, now); // E3

      bgmGain.gain.setValueAtTime(0.12, now);

      this.bgmOsc1.connect(bgmGain);
      this.bgmOsc2.connect(bgmGain);
      bgmGain.connect(this.musicGain);

      this.bgmOsc1.start();
      this.bgmOsc2.start();

      // Atmospheric melody intervals
      const pentatonic = [220, 246.94, 277.18, 329.63, 369.99, 440];
      window.setInterval(() => {
        if (!this.ctx || !this.musicGain || this.isMuted) return;
        const t = this.ctx.currentTime;
        const note = pentatonic[Math.floor(Math.random() * pentatonic.length)];

        const chime = this.ctx.createOscillator();
        const chimeGain = this.ctx.createGain();

        chime.type = 'sine';
        chime.frequency.setValueAtTime(note, t);

        chimeGain.gain.setValueAtTime(0.08, t);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

        chime.connect(chimeGain);
        chimeGain.connect(this.musicGain);

        chime.start(t);
        chime.stop(t + 2.0);
      }, 2500);
    } catch {}
  }
}

export const audioManager = AudioManager.getInstance();
