/**
 * Web Audio API Audio Engine & Procedural Sound Synthesizer
 */

import { StorageService } from '../platform/StorageService';

export class AudioManager {
  private static ctx: AudioContext | null = null;
  private static masterGain: GainNode | null = null;
  private static sfxGain: GainNode | null = null;
  private static musicGain: GainNode | null = null;
  
  private static isMuted = false;
  private static isPlatformMuted = false;
  private static isMusicPlaying = false;
  private static ambientInterval: number | null = null;

  static init(): void {
    const save = StorageService.getSaveData();
    this.isMuted = save.settings.muted;

    const unlock = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  private static ensureContext(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.updateVolumes();
    }
  }

  static updateVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return;
    const save = StorageService.getSaveData();
    const effectiveMute = this.isMuted || this.isPlatformMuted;
    
    const now = this.ctx.currentTime;
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(effectiveMute ? 0 : 1, now + 0.05);

    this.sfxGain.gain.setValueAtTime(this.sfxGain.gain.value, now);
    this.sfxGain.gain.linearRampToValueAtTime(save.settings.sfxVolume, now + 0.05);

    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(save.settings.musicVolume * 0.4, now + 0.05);
  }

  static toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    StorageService.updateData((data) => {
      data.settings.muted = this.isMuted;
    });
    this.updateVolumes();
    return this.isMuted;
  }

  static setPlatformMuted(muted: boolean): void {
    this.isPlatformMuted = muted;
    this.updateVolumes();
  }

  static playSfx(name: string, pitchVariation = 0.1): void {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain || this.isMuted || this.isPlatformMuted) return;

    try {
      const now = this.ctx.currentTime;
      const pitchMod = 1 + (Math.random() * 2 - 1) * pitchVariation;

      switch (name) {
        case 'attack':
        case 'swing': {
          // White noise whoosh + tonal drop
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(450 * pitchMod, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.14);

          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.14);
          break;
        }

        case 'hit':
        case 'stab': {
          // Sharp impact transient + thud
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(280 * pitchMod, now);
          osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);

          gain.gain.setValueAtTime(0.6, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.18);
          break;
        }

        case 'torch':
        case 'fire': {
          // Fire flare: filtered noise burst + crackle
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(140 * pitchMod, now);
          osc.frequency.linearRampToValueAtTime(260, now + 0.25);

          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.35);
          break;
        }

        case 'salt':
        case 'magic': {
          // Ethereal chord shimmer
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq * pitchMod, now + i * 0.04);
            gain.gain.setValueAtTime(0.2, now + i * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc.connect(gain);
            gain.connect(this.sfxGain!);
            osc.start(now + i * 0.04);
            osc.stop(now + 0.45);
          });
          break;
        }

        case 'herb':
        case 'coin': {
          // Bright two-tone chime
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(880 * pitchMod, now);
          osc2.frequency.setValueAtTime(1320 * pitchMod, now + 0.07);

          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(this.sfxGain);
          osc1.start(now);
          osc2.start(now + 0.07);
          osc1.stop(now + 0.07);
          osc2.stop(now + 0.3);
          break;
        }

        case 'dash': {
          // Low rushing wind
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(160, now);
          osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);

          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.2);
          break;
        }

        case 'stealth_hide': {
          // Mystical low whisper
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);

          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.25);
          break;
        }

        case 'wisp_alert': {
          // Eerie warble
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(600 * pitchMod, now);
          osc.frequency.linearRampToValueAtTime(950 * pitchMod, now + 0.15);
          osc.frequency.linearRampToValueAtTime(700 * pitchMod, now + 0.3);

          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.3);
          break;
        }

        case 'leshy_roar': {
          // Deep earth tremor
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(75, now);
          osc.frequency.linearRampToValueAtTime(45, now + 0.6);

          gain.gain.setValueAtTime(0.7, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.65);
          break;
        }

        case 'dawn':
        case 'victory': {
          // Triumphant chord progression
          [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.08);

            gain.gain.setValueAtTime(0.3, now + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

            osc.connect(gain);
            gain.connect(this.sfxGain!);
            osc.start(now + i * 0.08);
            osc.stop(now + 1.2);
          });
          break;
        }

        case 'defeat': {
          // Melancholy descending chords
          [392.00, 349.23, 311.13, 261.63].forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.15);

            gain.gain.setValueAtTime(0.35, now + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

            osc.connect(gain);
            gain.connect(this.sfxGain!);
            osc.start(now + i * 0.15);
            osc.stop(now + 1.4);
          });
          break;
        }
      }
    } catch (err) {
      console.warn('[AudioManager] SFX play failed:', err);
    }
  }

  static startAmbientMusic(): void {
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.ensureContext();

    const playAmbientChord = () => {
      if (!this.ctx || !this.musicGain || !this.isMusicPlaying || this.isMuted || this.isPlatformMuted) return;

      const chords = [
        [110, 164.81, 220, 277.18], // A min
        [98, 146.83, 196, 246.94],  // G maj
        [87.31, 130.81, 174.61, 220], // F maj
        [82.41, 123.47, 164.81, 207.65], // E min
      ];

      const chord = chords[Math.floor(Math.random() * chords.length)];
      const now = this.ctx.currentTime;
      const duration = 4.5;

      chord.forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 1.5);
        gain.gain.linearRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.musicGain!);
        osc.start(now);
        osc.stop(now + duration);
      });
    };

    playAmbientChord();
    this.ambientInterval = window.setInterval(playAmbientChord, 4200);
  }

  static stopAmbientMusic(): void {
    this.isMusicPlaying = false;
    if (this.ambientInterval !== null) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
  }
}
