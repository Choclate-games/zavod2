import { eventBus } from '../core/EventBus'

export class AudioManager {
  private static instance: AudioManager
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private isMuted = false
  private isPlatformMuted = false
  private isInitialized = false

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager()
    }
    return AudioManager.instance
  }

  constructor() {
    this.setupGestureUnlock()
    this.setupEventListeners()
  }

  private setupGestureUnlock(): void {
    const unlock = () => {
      this.initContext()
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume()
      }
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }

    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
  }

  private initContext(): void {
    if (this.isInitialized) return
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
        this.masterGain = this.ctx.createGain()
        this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime)
        this.masterGain.connect(this.ctx.destination)
        this.isInitialized = true
      }
    } catch (e) {
      console.warn('Web Audio API not supported:', e)
    }
  }

  private setupEventListeners(): void {
    eventBus.on('SOUND_TRIGGERED', (soundId: string) => {
      if (soundId === 'mute_all') {
        this.setPlatformMuted(true)
      } else if (soundId === 'unmute_all') {
        this.setPlatformMuted(false)
      } else {
        this.play(soundId)
      }
    })
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted
    this.updateMasterVolume()
  }

  public setPlatformMuted(muted: boolean): void {
    this.isPlatformMuted = muted
    this.updateMasterVolume()
  }

  private updateMasterVolume(): void {
    if (!this.masterGain || !this.ctx) return
    const vol = this.isMuted || this.isPlatformMuted ? 0 : 0.8
    this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05)
  }

  public play(soundId: string): void {
    if (this.isMuted || this.isPlatformMuted || !this.ctx || !this.masterGain) return
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
      return
    }

    const t = this.ctx.currentTime

    switch (soundId) {
      case 'kick': {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(140, t)
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.12)
        gain.gain.setValueAtTime(1.0, t)
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12)
        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(t)
        osc.stop(t + 0.12)
        break
      }
      case 'charged_kick': {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(220, t)
        osc.frequency.exponentialRampToValueAtTime(25, t + 0.25)
        gain.gain.setValueAtTime(1.2, t)
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25)
        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(t)
        osc.stop(t + 0.25)
        break
      }
      case 'ricochet': {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'square'
        osc.frequency.setValueAtTime(650, t)
        osc.frequency.exponentialRampToValueAtTime(180, t + 0.18)
        gain.gain.setValueAtTime(0.7, t)
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18)
        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(t)
        osc.stop(t + 0.18)
        break
      }
      case 'wood_break': {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(180, t)
        osc.frequency.linearRampToValueAtTime(60, t + 0.15)
        gain.gain.setValueAtTime(0.9, t)
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15)
        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(t)
        osc.stop(t + 0.15)
        break
      }
      case 'cash_pickup': {
        const osc1 = this.ctx.createOscillator()
        const osc2 = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc1.type = 'sine'
        osc2.type = 'sine'
        osc1.frequency.setValueAtTime(987, t) // B5
        osc2.frequency.setValueAtTime(1318, t + 0.05) // E6
        gain.gain.setValueAtTime(0.5, t)
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2)
        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(this.masterGain)
        osc1.start(t)
        osc1.stop(t + 0.08)
        osc2.start(t + 0.05)
        osc2.stop(t + 0.2)
        break
      }
      case 'workbench_buy': {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(880, t)
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.3)
        gain.gain.setValueAtTime(0.8, t)
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3)
        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(t)
        osc.stop(t + 0.3)
        break
      }
      case 'dash':
      case 'whoosh': {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(320, t)
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.12)
        gain.gain.setValueAtTime(0.4, t)
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12)
        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(t)
        osc.stop(t + 0.12)
        break
      }
    }
  }
}

export const audioManager = AudioManager.getInstance()
