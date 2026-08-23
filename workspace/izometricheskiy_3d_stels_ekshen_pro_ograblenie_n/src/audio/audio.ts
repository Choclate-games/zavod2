import { bus } from '../core/events.js'
import { MUSIC_BPM } from '../config/balance.js'

/**
 * Процедурный звук без файлов: ленивый AudioContext, один мастер-гейн,
 * музыкальный трек шествия и эффекты. Время ритма берётся из
 * AudioContext.currentTime, а не из rAF — иначе троттлинг вкладки рассыпает такт.
 */

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private nextBeatTime = 0
  private beatIndex = 0
  private schedulerId = 0
  private muted = false
  private started = false

  get ready(): boolean {
    return this.ctx !== null
  }

  /** Создание контекста лениво — по первому жесту игрока (pointerdown/keydown). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    type WindowWithLegacyAudio = Window & { webkitAudioContext?: typeof AudioContext }
    const Ctor = window.AudioContext ?? (window as WindowWithLegacyAudio).webkitAudioContext
    if (!Ctor) return
    this.ctx = new Ctor()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 1
    this.master.connect(this.ctx.destination)
    this.musicGain = this.ctx.createGain()
    this.musicGain.gain.value = 0.5
    this.musicGain.connect(this.master)
    this.sfxGain = this.ctx.createGain()
    this.sfxGain.gain.value = 0.9
    this.sfxGain.connect(this.master)

    const len = Math.floor(this.ctx.sampleRate * 0.5)
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const channel = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) channel[i] = Math.random() * 2 - 1
    this.noiseBuffer = buffer

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return
      if (document.hidden) void this.ctx.suspend()
      else void this.ctx.resume()
    })
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx?.currentTime ?? 0, 0.05)
    }
  }

  /** Доля такта [0..1) и фаза сильной доли для механик ритма. */
  beatPhase(): number {
    if (!this.ctx || !this.started) return -1
    return ((this.ctx.currentTime * MUSIC_BPM) / 60) % 1
  }

  isOnStrongBeat(windowSec: number): { onBeat: boolean; offset: number } {
    if (!this.ctx || !this.started) return { onBeat: false, offset: 1 }
    const beatLen = 60 / MUSIC_BPM
    const pos = (this.ctx.currentTime % beatLen) / beatLen
    let offset = pos * beatLen
    if (offset > beatLen / 2) offset -= beatLen
    return { onBeat: Math.abs(offset) <= windowSec, offset }
  }

  startMusic(): void {
    if (!this.ctx || this.started) return
    this.started = true
    this.nextBeatTime = this.ctx.currentTime + 0.1
    this.beatIndex = 0
    this.schedulerId = window.setInterval(() => this.scheduleAhead(), 80)
  }

  stopMusic(): void {
    this.started = false
    if (this.schedulerId) {
      clearInterval(this.schedulerId)
      this.schedulerId = 0
    }
  }

  /** Планировщик с lookahead: ноты назначаются по времени контекста. */
  private scheduleAhead(): void {
    const ctx = this.ctx
    if (!ctx || !this.started) return
    const beatLen = 60 / MUSIC_BPM
    while (this.nextBeatTime < ctx.currentTime + 0.25) {
      const t = this.nextBeatTime
      const step = this.beatIndex % 4
      this.kick(t)
      if (step === 2) this.snare(t)
      if (step === 1 || step === 3) this.hat(t + beatLen / 2)
      if (step === 0) this.bassNote(t, 98)
      if (step === 2) this.bassNote(t, 130.8)
      this.nextBeatTime += beatLen / 2
      this.beatIndex++
    }
  }

  private kick(t: number): void {
    const ctx = this.ctx
    if (!ctx || !this.musicGain) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(140, t)
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12)
    gain.gain.setValueAtTime(0.9, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
    osc.connect(gain).connect(this.musicGain)
    osc.start(t)
    osc.stop(t + 0.25)
  }

  private snare(t: number): void {
    const ctx = this.ctx
    if (!ctx || !this.noiseBuffer || !this.musicGain) return
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1800
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.5, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
    src.connect(filter).connect(gain).connect(this.musicGain)
    src.start(t)
    src.stop(t + 0.2)
  }

  private hat(t: number): void {
    const ctx = this.ctx
    if (!ctx || !this.noiseBuffer || !this.musicGain) return
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 7000
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.18, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    src.connect(filter).connect(gain).connect(this.musicGain)
    src.start(t)
    src.stop(t + 0.08)
  }

  private bassNote(t: number, freq: number): void {
    const ctx = this.ctx
    if (!ctx || !this.musicGain) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = freq / 2
    gain.gain.setValueAtTime(0.16, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
    osc.connect(gain).connect(this.musicGain)
    osc.start(t)
    osc.stop(t + 0.3)
  }

  /** Короткий тон с огибающей — база большинства эффектов. */
  private blip(freq: number, dur: number, type: OscillatorType, vol: number): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(gain).connect(this.sfxGain)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private noiseBurst(dur: number, filterFreq: number, vol: number, sweepTo?: number): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(filterFreq, t)
    if (sweepTo !== undefined) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(filter).connect(gain).connect(this.sfxGain)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  lunge(): void {
    this.noiseBurst(0.16, 2400, 0.4, 600)
  }

  clang(): void {
    this.blip(1250, 0.22, 'triangle', 0.6)
    this.blip(1875, 0.14, 'sine', 0.35)
  }

  hitTaken(): void {
    this.blip(160, 0.25, 'sawtooth', 0.5)
  }

  takedown(): void {
    this.blip(520, 0.12, 'sine', 0.4)
    this.blip(780, 0.16, 'sine', 0.3)
  }

  pickup(): void {
    this.blip(660, 0.1, 'triangle', 0.4)
    setTimeout(() => this.blip(990, 0.14, 'triangle', 0.4), 90)
  }

  alarmSting(): void {
    this.blip(320, 0.4, 'sawtooth', 0.45)
  }

  confettiPop(): void {
    this.noiseBurst(0.24, 900, 0.6, 3500)
  }

  kickLaunch(): void {
    this.blip(90, 0.2, 'sine', 0.7)
    this.noiseBurst(0.12, 500, 0.4)
  }

  click(): void {
    this.blip(880, 0.06, 'square', 0.15)
  }

  winFanfare(): void {
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => setTimeout(() => this.blip(freq, 0.22, 'triangle', 0.4), i * 120))
  }

  loseSting(): void {
    const notes = [392, 330, 262]
    notes.forEach((freq, i) => setTimeout(() => this.blip(freq, 0.3, 'sawtooth', 0.35), i * 160))
  }
}

export const audio = new AudioEngine()

/** Звук площадки и сворачивания вкладки приходит из событий моста. */
export function bindAudioToBus(): void {
  bus.on('platform:audio', (muted) => audio.setMuted(muted))
}
