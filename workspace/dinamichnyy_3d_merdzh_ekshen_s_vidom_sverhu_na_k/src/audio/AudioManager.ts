import { EventBus } from '../core/EventBus'

export class AudioManager {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private playerMuted = false
  private platformMuted = false

  constructor(private readonly bus: EventBus) {
    bus.on('platform:audio', (state) => { this.platformMuted = state === 'MUTED'; this.updateGain() })
    bus.on('input:pointer-down', () => this.unlock())
    bus.on('input:chomp', () => this.play(180, 0.08))
    bus.on('input:pause', () => this.play(260, 0.06))
    document.addEventListener('visibilitychange', () => { if (document.hidden) void this.context?.suspend(); else void this.context?.resume() })
  }

  setPlayerMuted(muted: boolean): void {
    this.playerMuted = muted
    this.updateGain()
  }

  togglePlayerMute(): void { this.setPlayerMuted(!this.playerMuted) }

  playMerge(): void { this.play(55, 0.35); window.setTimeout(() => this.play(440, 0.16), 55) }
  playFling(): void { this.play(120, 0.07) }
  playRingout(): void { this.play(820, 0.1) }

  private unlock(): void {
    if (!this.context) {
      this.context = new AudioContext()
      this.master = this.context.createGain()
      this.master.gain.value = 0.22
      this.master.connect(this.context.destination)
    }
    if (this.context.state === 'suspended') void this.context.resume()
  }

  private play(frequency: number, duration: number): void {
    this.unlock()
    if (!this.context || !this.master || this.playerMuted || this.platformMuted) return
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, this.context.currentTime)
    gain.gain.setValueAtTime(0.001, this.context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.28, this.context.currentTime + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration)
    oscillator.connect(gain)
    gain.connect(this.master)
    oscillator.start()
    oscillator.stop(this.context.currentTime + duration)
  }

  private updateGain(): void {
    if (this.master) this.master.gain.setTargetAtTime(this.playerMuted || this.platformMuted ? 0 : 0.22, this.context?.currentTime ?? 0, 0.03)
  }
}
