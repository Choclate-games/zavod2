import type { EventBus } from '../core/EventBus'

type Synth = {
  ctx: AudioContext
  master: GainNode
}

/**
 * Процедурный звук на Web Audio API без внешних файлов: удары бетона — шумовой
 * всплеск через низкочастотный фильтр, металлический стон — расстроенные
 * осцилляторы, лазер резки — свип пилы. Один мастер-gain: mute и глушение от
 * площадки меняют только его.
 */
export class AudioManager {
  private synth: Synth | null = null
  private playerMuted = false
  private platformMuted = false
  private pumpOsc: OscillatorNode | null = null
  private pumpGain: GainNode | null = null

  constructor(private readonly events: EventBus) {
    this.events.on('platform:audio', ({ enabled }) => {
      this.platformMuted = !enabled
      this.applyGain()
    })
    this.events.on('audio:muted', ({ muted }) => {
      this.playerMuted = muted
      if (!muted) void this.resume()
      this.applyGain()
    })
    const unlock = (): void => {
      void this.resume()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
  }

  get muted(): boolean {
    return this.playerMuted
  }

  toggleMute(): boolean {
    this.playerMuted = !this.playerMuted
    this.events.emit('audio:muted', { muted: this.playerMuted })
    return this.playerMuted
  }

  private applyGain(): void {
    const synth = this.synth
    if (!synth) return
    const target = this.playerMuted || this.platformMuted ? 0 : 0.8
    const gain = synth.master.gain
    // Рампуем усиление: мгновенная смена щёлкает по слуху.
    gain.cancelScheduledValues(synth.ctx.currentTime)
    gain.setTargetAtTime(target, synth.ctx.currentTime, 0.05)
  }

  private async resume(): Promise<void> {
    try {
      if (!this.synth) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) return
        const ctx = new Ctor()
        const master = ctx.createGain()
        master.gain.value = this.platformMuted || this.playerMuted ? 0 : 0.8
        master.connect(ctx.destination)
        this.synth = { ctx, master }
      }
      if (this.synth.ctx.state === 'suspended') await this.synth.ctx.resume()
    } catch {
      // без аудио игра остаётся играбельной
    }
  }

  private noiseBurst(durationS: number, cutoffHz: number, level: number): void {
    const synth = this.synth
    if (!synth) return
    const rate = synth.ctx.sampleRate
    const frames = Math.floor(rate * durationS)
    const buffer = synth.ctx.createBuffer(1, frames, rate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
    const source = synth.ctx.createBufferSource()
    source.buffer = buffer
    const filter = synth.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoffHz
    const gain = synth.ctx.createGain()
    gain.gain.value = level
    source.connect(filter).connect(gain).connect(synth.master)
    source.start()
  }

  private tone(freqHz: number, endFreqHz: number, durationS: number, type: OscillatorType, level: number): void {
    const synth = this.synth
    if (!synth) return
    const osc = synth.ctx.createOscillator()
    const gain = synth.ctx.createGain()
    osc.type = type
    const now = synth.ctx.currentTime
    osc.frequency.setValueAtTime(freqHz, now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreqHz), now + durationS)
    gain.gain.setValueAtTime(level, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationS)
    osc.connect(gain).connect(synth.master)
    osc.start(now)
    osc.stop(now + durationS + 0.02)
  }

  uiClick(): void {
    void this.resume()
    this.tone(660, 440, 0.08, 'square', 0.12)
  }

  plasmaCut(): void {
    this.tone(1800, 220, 0.28, 'sawtooth', 0.2)
    this.noiseBurst(0.22, 5200, 0.25)
  }

  wedgeThud(power: number): void {
    const clamped = Math.min(1, Math.max(0.15, power))
    this.noiseBurst(0.5 * clamped + 0.15, 260, 0.55 * clamped)
    this.tone(90, 34, 0.6 * clamped + 0.1, 'sine', 0.5 * clamped)
  }

  metalGroan(): void {
    this.tone(140, 60, 1.4, 'sawtooth', 0.14)
    this.tone(97, 52, 1.5, 'triangle', 0.12)
  }

  chargeArm(): void {
    this.tone(320, 720, 0.18, 'square', 0.14)
  }

  victoryChord(): void {
    this.tone(523, 523, 0.9, 'triangle', 0.16)
    this.tone(659, 659, 0.9, 'triangle', 0.14)
    this.tone(784, 784, 1.1, 'sine', 0.16)
  }

  defeatTone(): void {
    this.tone(220, 110, 0.7, 'triangle', 0.18)
  }

  pumpStart(): void {
    const synth = this.synth
    if (!synth || this.pumpOsc) {
      void this.resume()
      return
    }
    const osc = synth.ctx.createOscillator()
    const gain = synth.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 120
    gain.gain.value = 0.06
    osc.connect(gain).connect(synth.master)
    osc.start()
    this.pumpOsc = osc
    this.pumpGain = gain
  }

  pumpUpdate(angleDeg: number): void {
    if (!this.pumpOsc || !this.synth) return
    this.pumpOsc.frequency.setTargetAtTime(
      90 + angleDeg * 3,
      this.synth.ctx.currentTime,
      0.04,
    )
  }

  pumpStop(): void {
    if (!this.pumpOsc || !this.pumpGain || !this.synth) return
    const now = this.synth.ctx.currentTime
    this.pumpGain.gain.setTargetAtTime(0, now, 0.03)
    const osc = this.pumpOsc
    setTimeout(() => {
      try { osc.stop() } catch { /* уже остановлен */ }
    }, 150)
    this.pumpOsc = null
    this.pumpGain = null
  }
}
