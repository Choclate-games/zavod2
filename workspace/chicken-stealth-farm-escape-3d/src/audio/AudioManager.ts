// src/audio/AudioManager.ts
import { eventBus } from '@/core/EventBus';
import { playgamaService } from '@/platform/PlaygamaService';

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private isMuted: boolean = false;
  private sfxVolume: number = 0.8;
  private musicVolume: number = 0.5;
  private platformHasAudio: boolean = true;

  private currentBgm: 'none' | 'stealth' | 'pursuit' = 'none';
  private bgmInterval: number | null = null;
  private bgmStep: number = 0;

  private constructor() {
    const save = playgamaService.getSave();
    this.sfxVolume = save.soundVolume;
    this.musicVolume = save.musicVolume;
    this.isMuted = save.isMuted;

    // Listen to platform audio focus change
    playgamaService.onAudioStateChange((hasAudio) => {
      this.platformHasAudio = hasAudio;
      this.updateMasterVolume();
    });

    // Listen to game events
    eventBus.on('audio:playSfx', ({ name, volume, pitch }) => {
      this.playSfx(name, volume, pitch);
    });

    eventBus.on('audio:setBgm', ({ track }) => {
      if (track === 'stealth' || track === 'pursuit' || track === 'none') {
        this.playBgm(track);
      } else {
        this.playBgm('stealth');
      }
    });

    // Auto unlock on first user interaction
    const unlockAudio = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private ensureContext(): void {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.updateMasterVolume();
    } catch (e) {
      console.warn('[AudioManager] Web Audio API not supported:', e);
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.updateMasterVolume();
    playgamaService.updateSave((s) => { s.isMuted = muted; });
  }

  public setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
    playgamaService.updateSave((s) => { s.soundVolume = this.sfxVolume; });
  }

  public setMusicVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
    playgamaService.updateSave((s) => { s.musicVolume = this.musicVolume; });
  }

  public getSettings() {
    return {
      isMuted: this.isMuted,
      sfxVolume: this.sfxVolume,
      musicVolume: this.musicVolume
    };
  }

  private updateMasterVolume(): void {
    if (!this.masterGain || !this.ctx) return;
    const target = (this.isMuted || !this.platformHasAudio) ? 0 : 1;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  // --- Sound Effects Synthesis ---

  public playSfx(name: string, volumeScale: number = 1.0, pitchMultiplier: number = 1.0): void {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted || !this.platformHasAudio) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.sfxVolume * volumeScale, t);
    gain.connect(this.sfxGain);

    switch (name) {
      case 'step': {
        // Soft cute high click/tap
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        const baseFreq = (240 + Math.random() * 60) * pitchMultiplier;
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, t + 0.06);

        gain.gain.setValueAtTime(0.2 * volumeScale, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.06);
        break;
      }

      case 'box_drop': {
        // Deep punchy cardboard thump + lowpass body
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140 * pitchMultiplier, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);

        gain.gain.setValueAtTime(0.8 * volumeScale, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.18);
        break;
      }

      case 'box_pop': {
        // Crisp pop whoosh
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200 * pitchMultiplier, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.1);

        gain.gain.setValueAtTime(0.5 * volumeScale, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.12);
        break;
      }

      case 'grain': {
        // Crystalline golden chime arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const noteGain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq * pitchMultiplier, t + i * 0.035);

          noteGain.gain.setValueAtTime(0.25 * volumeScale, t + i * 0.035);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.035 + 0.35);

          osc.connect(noteGain);
          noteGain.connect(gain);
          osc.start(t + i * 0.035);
          osc.stop(t + i * 0.035 + 0.35);
        });
        break;
      }

      case 'alert': {
        // Iconic Metal Gear exclamation sting!
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'square';

        osc1.frequency.setValueAtTime(880 * pitchMultiplier, t);
        osc1.frequency.setValueAtTime(1760 * pitchMultiplier, t + 0.06);

        osc2.frequency.setValueAtTime(440 * pitchMultiplier, t);
        osc2.frequency.setValueAtTime(880 * pitchMultiplier, t + 0.06);

        gain.gain.setValueAtTime(0.7 * volumeScale, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        osc1.connect(gain);
        osc2.connect(gain);
        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.45);
        osc2.stop(t + 0.45);
        break;
      }

      case 'bark': {
        // Comic dog bark
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260 * pitchMultiplier, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.14);

        gain.gain.setValueAtTime(0.6 * volumeScale, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.16);
        break;
      }

      case 'suspicious': {
        // Puzzled chirp
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320 * pitchMultiplier, t);
        osc.frequency.linearRampToValueAtTime(480 * pitchMultiplier, t + 0.18);

        gain.gain.setValueAtTime(0.4 * volumeScale, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.22);
        break;
      }

      case 'gate_open': {
        // Farm gate mechanical unlock & bell
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(350 * pitchMultiplier, t);
        osc.frequency.linearRampToValueAtTime(700, t + 0.3);

        const bell = this.ctx.createOscillator();
        bell.type = 'sine';
        bell.frequency.setValueAtTime(1318.51, t + 0.2); // E6

        gain.gain.setValueAtTime(0.5 * volumeScale, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

        osc.connect(gain);
        bell.connect(gain);
        osc.start(t);
        bell.start(t + 0.2);
        osc.stop(t + 0.6);
        bell.stop(t + 0.6);
        break;
      }

      case 'victory': {
        // Joyful victory fanfare (Major Triad flourish)
        const victoryNotes = [
          { f: 523.25, d: 0.12 }, // C5
          { f: 659.25, d: 0.12 }, // E5
          { f: 783.99, d: 0.12 }, // G5
          { f: 1046.5, d: 0.45 }  // C6
        ];
        let delay = 0;
        victoryNotes.forEach(({ f, d }) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const noteGain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f * pitchMultiplier, t + delay);

          noteGain.gain.setValueAtTime(0.5 * volumeScale, t + delay);
          noteGain.gain.exponentialRampToValueAtTime(0.001, t + delay + d);

          osc.connect(noteGain);
          noteGain.connect(gain);
          osc.start(t + delay);
          osc.stop(t + delay + d);
          delay += 0.1;
        });
        break;
      }

      case 'gameover': {
        // Comedic sad cluck / drop
        const notes = [440, 415.3, 392, 349.2];
        let delay = 0;
        notes.forEach((f) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const noteGain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, t + delay);

          noteGain.gain.setValueAtTime(0.4 * volumeScale, t + delay);
          noteGain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.22);

          osc.connect(noteGain);
          noteGain.connect(gain);
          osc.start(t + delay);
          osc.stop(t + delay + 0.25);
          delay += 0.18;
        });
        break;
      }

      case 'click':
      default: {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800 * pitchMultiplier, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);

        gain.gain.setValueAtTime(0.3 * volumeScale, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.05);
        break;
      }
    }
  }

  // --- Dynamic Procedural BGM Synthesizer ---

  public playBgm(track: 'none' | 'stealth' | 'pursuit'): void {
    if (this.currentBgm === track) return;
    this.currentBgm = track;

    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }

    if (track === 'none') return;

    this.ensureContext();
    this.bgmStep = 0;

    // Rhythmic sequencer interval (tempo: 125 BPM = 120ms per 16th note)
    const stepInterval = track === 'pursuit' ? 100 : 150;

    this.bgmInterval = window.setInterval(() => {
      this.tickBgmStep();
    }, stepInterval);
  }

  private tickBgmStep(): void {
    if (!this.ctx || !this.musicGain || this.isMuted || !this.platformHasAudio) return;
    if (this.ctx.state === 'suspended') return;

    const t = this.ctx.currentTime;
    const step = this.bgmStep % 16;
    this.bgmStep++;

    if (this.currentBgm === 'stealth') {
      // Playful sneaky stealth groove: Walking bass + pizzicato plucks
      const bassNotes = [110, 0, 110, 0, 130.8, 0, 146.8, 130.8, 98, 0, 98, 0, 110, 0, 123.4, 0];
      const pluckNotes = [0, 440, 0, 523.25, 0, 440, 0, 659.25, 0, 392, 0, 440, 0, 523.25, 440, 0];

      const bassFreq = bassNotes[step];
      if (bassFreq > 0) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bassFreq, t);

        g.gain.setValueAtTime(0.3 * this.musicVolume, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 0.14);
      }

      const pluckFreq = pluckNotes[step];
      if (pluckFreq > 0) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pluckFreq, t);

        g.gain.setValueAtTime(0.18 * this.musicVolume, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 0.09);
      }
    } else if (this.currentBgm === 'pursuit') {
      // High-energy fast alarm chase: pulsing bass + alarm synth
      const fastBass = [164.8, 164.8, 220, 164.8, 164.8, 220, 196, 174.6];
      const freq = fastBass[step % 8];

      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      // Low pass filter for warm drive
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, t);

      g.gain.setValueAtTime(0.35 * this.musicVolume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 0.09);
    }
  }

  public stopAll(): void {
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.currentBgm = 'none';
  }
}

export const audioManager = AudioManager.getInstance();
