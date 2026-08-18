import { storage } from '../platform/StorageService';
import { eventBus } from '../core/EventBus';

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;

  private isSoundEnabled = true;
  private isMusicEnabled = true;
  private isPlatformMuted = false;
  private isUnlocked = false;

  // Background Music Generator state
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private isCombatMode = false;

  private constructor() {
    this.initContext();
    this.setupListeners();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private initContext(): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.bgmGain = this.ctx.createGain();

        this.sfxGain.connect(this.masterGain);
        this.bgmGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.isSoundEnabled = storage.getData().soundEnabled;
        this.isMusicEnabled = storage.getData().musicEnabled;

        this.updateVolumes();
      }
    } catch (e) {
      console.warn('[AudioManager] Web Audio init error:', e);
    }
  }

  public unlock(): void {
    if (this.isUnlocked || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.isUnlocked = true;
        this.startProceduralBGM();
      }).catch(() => {});
    } else {
      this.isUnlocked = true;
      this.startProceduralBGM();
    }
  }

  private setupListeners(): void {
    // Unlock on first pointer or key gesture
    const unlockHandler = () => {
      this.unlock();
      window.removeEventListener('pointerdown', unlockHandler);
      window.removeEventListener('keydown', unlockHandler);
    };
    window.addEventListener('pointerdown', unlockHandler, { once: true });
    window.addEventListener('keydown', unlockHandler, { once: true });

    eventBus.on('audio:play_sfx', (payload) => {
      this.playSfx(payload.name, payload.volume);
    });
  }

  public setPlatformMuted(muted: boolean): void {
    this.isPlatformMuted = muted;
    this.updateVolumes();
  }

  public toggleSound(enabled?: boolean): boolean {
    this.isSoundEnabled = enabled !== undefined ? enabled : !this.isSoundEnabled;
    const data = storage.getData();
    data.soundEnabled = this.isSoundEnabled;
    storage.save();
    this.updateVolumes();
    eventBus.emit('audio:mute_toggled', { sound: this.isSoundEnabled, music: this.isMusicEnabled });
    return this.isSoundEnabled;
  }

  public toggleMusic(enabled?: boolean): boolean {
    this.isMusicEnabled = enabled !== undefined ? enabled : !this.isMusicEnabled;
    const data = storage.getData();
    data.musicEnabled = this.isMusicEnabled;
    storage.save();
    this.updateVolumes();
    eventBus.emit('audio:mute_toggled', { sound: this.isSoundEnabled, music: this.isMusicEnabled });
    return this.isMusicEnabled;
  }

  public setCombatIntensity(inCombat: boolean): void {
    this.isCombatMode = inCombat;
  }

  private updateVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.bgmGain) return;
    const now = this.ctx.currentTime;

    // Master volume ramp (prevents click artifacts)
    const masterVol = this.isPlatformMuted ? 0 : 1.0;
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(masterVol, now + 0.05);

    this.sfxGain.gain.setValueAtTime(this.isSoundEnabled ? 0.85 : 0, now);
    this.bgmGain.gain.setValueAtTime(this.isMusicEnabled ? 0.45 : 0, now);
  }

  public playSfx(name: string, volumeScale = 1.0): void {
    if (!this.isSoundEnabled || this.isPlatformMuted || !this.ctx || !this.sfxGain) return;
    if (this.ctx.state === 'suspended') {
      this.unlock();
    }

    const t = this.ctx.currentTime;

    switch (name) {
      case 'pheromone_draw': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);

        gain.gain.setValueAtTime(0.15 * volumeScale, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.12);
        break;
      }

      case 'bridge_connect': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.08);

        gain.gain.setValueAtTime(0.3 * volumeScale, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.08);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.08);
        break;
      }

      case 'bomber_explosion': {
        // Sub-bass punch + noise
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(130, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.4);

        gain.gain.setValueAtTime(0.7 * volumeScale, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.4);
        break;
      }

      case 'nest_captured': {
        // Triumphant chord (C5 - E5 - G5 - C6 arpeggio)
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          if (!this.ctx || !this.sfxGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const startTime = t + idx * 0.09;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.3 * volumeScale, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(startTime);
          osc.stop(startTime + 0.35);
        });
        break;
      }

      case 'pickup_collect_chime': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(1760, t + 0.15);

        gain.gain.setValueAtTime(0.25 * volumeScale, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.15);
        break;
      }

      case 'button_click': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);

        gain.gain.setValueAtTime(0.2 * volumeScale, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.05);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.05);
        break;
      }

      case 'action_swing_whoosh': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(160, t + 0.08);

        gain.gain.setValueAtTime(0.12 * volumeScale, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.08);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.08);
        break;
      }
    }
  }

  private startProceduralBGM(): void {
    if (this.bgmTimer) return;

    // Organic macro-biopunk ambient progression
    // Pentatonic nature scale: D3, F3, G3, A3, C4, D4
    const scale = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66];
    const bassline = [73.42, 87.31, 98.0, 110.0];

    const playStep = () => {
      if (!this.ctx || !this.bgmGain || !this.isMusicEnabled || this.isPlatformMuted) {
        this.bgmTimer = window.setTimeout(playStep, 350);
        return;
      }

      const t = this.ctx.currentTime;
      this.bgmStep++;

      // Bass drone every 4 steps
      if (this.bgmStep % 4 === 0) {
        const bassFreq = bassline[(this.bgmStep / 4) % bassline.length];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(bassFreq, t);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1.2);

        osc.connect(gain);
        gain.connect(this.bgmGain);
        osc.start(t);
        osc.stop(t + 1.2);
      }

      // Melody arpeggio
      if (Math.random() < 0.75) {
        const note = scale[Math.floor(Math.random() * scale.length)];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note, t);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

        osc.connect(gain);
        gain.connect(this.bgmGain);
        osc.start(t);
        osc.stop(t + 0.6);
      }

      // Combat percussion pulse
      if (this.isCombatMode && this.bgmStep % 2 === 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(90, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.1);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        osc.connect(gain);
        gain.connect(this.bgmGain);
        osc.start(t);
        osc.stop(t + 0.1);
      }

      const tempo = this.isCombatMode ? 240 : 340;
      this.bgmTimer = window.setTimeout(playStep, tempo);
    };

    playStep();
  }
}

export const audioManager = AudioManager.getInstance();
