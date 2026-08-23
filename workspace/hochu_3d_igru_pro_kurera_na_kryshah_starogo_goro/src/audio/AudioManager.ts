import { events } from '../core/EventBus'
import { storageService } from '../platform/StorageService'

/**
 * Procedural Web Audio Synthesizer (Zero external audio assets needed).
 */
export class AudioManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private muted = false
  private platformMuted = false
  private masterVolume = 0.8

  // Continuous wind loop
  private windOsc: AudioBufferSourceNode | null = null
  private windGain: GainNode | null = null
  private windFilter: BiquadFilterNode | null = null
  private isWindPlaying = false

  constructor() {
    const save = storageService.getSave()
    this.muted = save.settings.muted
    this.masterVolume = save.settings.volume

    // Unlock AudioContext on first gesture
    const unlock = () => {
      this.ensureContext()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })

    // Auto mute / pause on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.ctx && this.ctx.state === 'running') {
          void this.ctx.suspend()
        }
      } else {
        if (this.ctx && this.ctx.state === 'suspended') {
          void this.ctx.resume()
        }
      }
    })

    // Listen to platform mute changes
    events.on('AUDIO_MUTE_CHANGED', (isMuted: boolean) => {
      this.setPlatformMuted(isMuted)
    })
  }

  public ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return null
      this.ctx = new AudioCtx()

      this.masterGain = this.ctx.createGain()
      const initialTarget = this.muted || this.platformMuted ? 0.0001 : this.masterVolume
      this.masterGain.gain.setValueAtTime(initialTarget, this.ctx.currentTime)
      this.masterGain.connect(this.ctx.destination)
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  public setMuted(muted: boolean): void {
    this.muted = muted
    storageService.updateSave((s) => {
      s.settings.muted = muted
    })
    if (this.masterGain && this.ctx) {
      const target = this.muted || this.platformMuted ? 0.0001 : this.masterVolume
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05)
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted)
    return this.muted
  }

  public isSoundMuted(): boolean {
    return this.muted || this.platformMuted
  }

  public setPlatformMuted(muted: boolean): void {
    this.platformMuted = muted
    if (this.masterGain && this.ctx) {
      const target = this.muted || this.platformMuted ? 0.0001 : this.masterVolume
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05)
    }
  }

  public playUiClick(): void {
    if (this.muted || this.platformMuted) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04)

    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04)

    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.04)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  }

  public playJump(): void {
    if (this.muted || this.platformMuted) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(220, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15)

    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)

    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  }

  public playPerfectRoll(): void {
    if (this.muted || this.platformMuted) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    // Resonant thump + brass shimmer
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.22)

    gain.gain.setValueAtTime(0.6, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)

    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.22)

    // Secondary high chime for perfect boost
    const chime = ctx.createOscillator()
    const chimeGain = ctx.createGain()
    chime.type = 'sine'
    chime.frequency.setValueAtTime(880, ctx.currentTime)
    chime.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.25)
    chimeGain.gain.setValueAtTime(0.3, ctx.currentTime)
    chimeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    chime.connect(chimeGain)
    chimeGain.connect(this.masterGain)
    chime.start(ctx.currentTime)
    chime.stop(ctx.currentTime + 0.25)
  }

  public playLedgeGrab(): void {
    if (this.muted || this.platformMuted) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    // Metallic clang
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(720, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(240, ctx.currentTime + 0.18)

    gain.gain.setValueAtTime(0.5, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)

    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.18)
  }

  public playSlide(): void {
    if (this.muted || this.platformMuted) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    // Slate friction swoosh
    const bufferSize = ctx.sampleRate * 0.2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.5))
    }

    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(3200, ctx.currentTime)
    filter.Q.setValueAtTime(2.0, ctx.currentTime)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(ctx.currentTime)
  }

  public playGlassCrack(): void {
    if (this.muted || this.platformMuted) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(2400, ctx.currentTime)
    osc.frequency.setValueAtTime(3100, ctx.currentTime + 0.05)
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.25)

    gain.gain.setValueAtTime(0.5, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)

    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.25)
  }

  public playCatastrophicBurst(): void {
    if (this.muted || this.platformMuted) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const bufferSize = ctx.sampleRate * 0.6
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3))
    }

    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.7, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)

    noise.connect(gain)
    gain.connect(this.masterGain)
    noise.start(ctx.currentTime)
  }

  public playWindGust(): void {
    if (this.muted || this.platformMuted) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const bufferSize = ctx.sampleRate * 0.4
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(400, ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2)
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.4)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(ctx.currentTime)
  }

  public playCoins(): void {
    if (this.muted || this.platformMuted) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const notes = [987.77, 1318.51, 1567.98]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06)
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.06)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.18)

      osc.connect(gain)
      gain.connect(this.masterGain!)
      osc.start(ctx.currentTime + i * 0.06)
      osc.stop(ctx.currentTime + i * 0.06 + 0.18)
    })
  }

  public playVictoryFanfare(): void {
    if (this.muted || this.platformMuted) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const fanfare = [523.25, 659.25, 783.99, 1046.50]
    fanfare.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      const start = ctx.currentTime + index * 0.12
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.4, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4)

      osc.connect(gain)
      gain.connect(this.masterGain!)
      osc.start(start)
      osc.stop(start + 0.4)
    })
  }
}

export const audioManager = new AudioManager()
