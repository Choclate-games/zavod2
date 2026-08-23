import { events } from '../core/EventBus'

export class SoundManager {
  private static instance: SoundManager
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private ambientGain: GainNode | null = null
  private isMuted = false
  private isPlatformMuted = false
  private isInitialized = false

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager()
    }
    return SoundManager.instance
  }

  public init(): void {
    if (this.isInitialized) return

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return

    this.ctx = new AudioContextClass()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime)
    this.masterGain.connect(this.ctx.destination)

    this.startAmbientDrone()
    this.isInitialized = true

    // Resume on first user gesture
    const unlock = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume()
      }
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)

    events.on('PLATFORM_AUDIO', (enabled: boolean) => {
      this.isPlatformMuted = !enabled
      this.updateMasterVolume()
    })

    events.on('SOUND_TOGGLED', (enabled: boolean) => {
      this.setMuted(!enabled)
    })
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted
    this.updateMasterVolume()
  }

  private updateMasterVolume(): void {
    if (!this.ctx || !this.masterGain) return
    const targetVolume = this.isMuted || this.isPlatformMuted ? 0 : 0.7
    this.masterGain.gain.linearRampToValueAtTime(targetVolume, this.ctx.currentTime + 0.05)
  }

  private startAmbientDrone(): void {
    if (!this.ctx || !this.masterGain) return
    try {
      const osc1 = this.ctx.createOscillator()
      const osc2 = this.ctx.createOscillator()
      const filter = this.ctx.createBiquadFilter()
      this.ambientGain = this.ctx.createGain()

      osc1.type = 'sawtooth'
      osc1.frequency.setValueAtTime(58, this.ctx.currentTime) // AC-130 turboprop fundamental
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(116, this.ctx.currentTime)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(160, this.ctx.currentTime)

      this.ambientGain.gain.setValueAtTime(0.08, this.ctx.currentTime)

      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(this.ambientGain)
      this.ambientGain.connect(this.masterGain)

      osc1.start()
      osc2.start()
    } catch {
      // Audio node error ignore
    }
  }

  public play25mmShot(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return
    try {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(280, this.ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.04)

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.04)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start()
      osc.stop(this.ctx.currentTime + 0.05)
    } catch {}
  }

  public play40mmShot(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return
    try {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(160, this.ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.12)

      gain.gain.setValueAtTime(0.35, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start()
      osc.stop(this.ctx.currentTime + 0.13)
    } catch {}
  }

  public play105mmShot(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return
    try {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(95, this.ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(32, this.ctx.currentTime + 0.45)

      gain.gain.setValueAtTime(0.65, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.45)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start()
      osc.stop(this.ctx.currentTime + 0.5)

      this.playNoiseBlast(0.35, 0.4)
    } catch {}
  }

  public playExplosionImpact(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return
    try {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(75, this.ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 0.6)

      gain.gain.setValueAtTime(0.5, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.6)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start()
      osc.stop(this.ctx.currentTime + 0.65)

      this.playNoiseBlast(0.4, 0.5)
    } catch {}
  }

  private playNoiseBlast(duration: number, volume: number): void {
    if (!this.ctx || !this.masterGain) return
    try {
      const bufferSize = this.ctx.sampleRate * duration
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
      const output = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1
      }

      const whiteNoise = this.ctx.createBufferSource()
      whiteNoise.buffer = buffer

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(450, this.ctx.currentTime)
      filter.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + duration)

      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(volume, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration)

      whiteNoise.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)

      whiteNoise.start()
    } catch {}
  }

  public playDangerWarningBeep(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return
    try {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, this.ctx.currentTime)
      osc.frequency.setValueAtTime(440, this.ctx.currentTime + 0.08)

      gain.gain.setValueAtTime(0.18, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.16)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start()
      osc.stop(this.ctx.currentTime + 0.18)
    } catch {}
  }

  public playOverheatBuzzer(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return
    try {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, this.ctx.currentTime)

      gain.gain.setValueAtTime(0.25, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start()
      osc.stop(this.ctx.currentTime + 0.28)
    } catch {}
  }

  public playCaliberSwitch(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return
    try {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(600, this.ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.06)

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.06)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start()
      osc.stop(this.ctx.currentTime + 0.07)
    } catch {}
  }

  public playRadioChirp(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return
    try {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1400, this.ctx.currentTime)
      osc.frequency.setValueAtTime(1750, this.ctx.currentTime + 0.03)

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start()
      osc.stop(this.ctx.currentTime + 0.09)
    } catch {}
  }
}

export const sound = SoundManager.getInstance()
