import { balance } from '../data/balance'

/**
 * Процедурный звук на Web Audio API: дизель, визг шин по льду, глухой
 * гидроудар, клапан, фанфары и отсчёт. Ни одного аудиофайла. Один мастер-
 * гейн: mute игрока и mute площадки — два независимых входа, громкость
 * меняется рампой, чтобы не щёлкало. Контекст стартует по первому жесту
 * игрока и никогда не блокирует загрузку.
 */
export class AudioManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private engineOsc: OscillatorNode | null = null
  private engineSub: OscillatorNode | null = null
  private engineGain: GainNode | null = null
  private skidSource: AudioBufferSourceNode | null = null
  private skidGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  private playerMuted = false
  private platformMuted = false
  private volume = 0.8

  constructor() {
    const resume = (): void => {
      this.ensureContext()
    }
    window.addEventListener('pointerdown', resume, { once: false })
    window.addEventListener('keydown', resume, { once: false })
  }

  setPlayerMuted(muted: boolean): void {
    this.playerMuted = muted
    this.applyMute()
  }

  /** Флаг площадки приходит из AUDIO_STATE_CHANGED моста. */
  setPlatformAudio(enabled: boolean): void {
    this.platformMuted = !enabled
    this.applyMute()
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    this.applyMute()
  }

  private applyMute(): void {
    if (!this.ctx || !this.masterGain) return
    const target = this.playerMuted || this.platformMuted ? 0 : this.volume
    const now = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(now)
    this.masterGain.gain.setTargetAtTime(target, now, 0.08)
  }

  private ensureContext(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    try {
      this.ctx = new AudioContext()
    } catch {
      /* без звука игра остаётся играбельной */
      return
    }
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = this.playerMuted || this.platformMuted ? 0 : this.volume
    this.masterGain.connect(this.ctx.destination)

    const length = Math.floor(this.ctx.sampleRate * 1.2)
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const channel = this.noiseBuffer.getChannelData(0)
    for (let i = 0; i < length; i++) channel[i] = Math.random() * 2 - 1
  }

  startEngine(): void {
    this.ensureContext()
    if (!this.ctx || !this.masterGain || this.engineOsc) return
    this.engineGain = this.ctx.createGain()
    this.engineGain.gain.value = 0
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    this.engineOsc = this.ctx.createOscillator()
    this.engineOsc.type = 'sawtooth'
    this.engineOsc.frequency.value = 42
    this.engineSub = this.ctx.createOscillator()
    this.engineSub.type = 'triangle'
    this.engineSub.frequency.value = 21
    this.engineOsc.connect(filter)
    this.engineSub.connect(filter)
    filter.connect(this.engineGain)
    this.engineGain.connect(this.masterGain)
    this.engineOsc.start()
    this.engineSub.start()
    this.engineGain.gain.setTargetAtTime(0.16, this.ctx.currentTime, 0.4)
  }

  stopEngine(): void {
    if (!this.ctx) return
    const osc = this.engineOsc
    const sub = this.engineSub
    const gain = this.engineGain
    this.engineOsc = null
    this.engineSub = null
    this.engineGain = null
    if (gain && osc && sub) {
      gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2)
      setTimeout(() => {
        try { osc.stop(); sub.stop() } catch { /* уже остановлены */ }
      }, 600)
    }
  }

  updateEngine(speedRatio: number): void {
    if (!this.ctx || !this.engineOsc || !this.engineSub) return
    const rpmFactor = 0.55 + speedRatio * 1.5
    this.engineOsc.frequency.setTargetAtTime(38 * rpmFactor + 8, this.ctx.currentTime, 0.12)
    this.engineSub.frequency.setTargetAtTime(19 * rpmFactor + 4, this.ctx.currentTime, 0.12)
  }

  startSkid(): void {
    this.ensureContext()
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.skidSource) return
    this.skidSource = this.ctx.createBufferSource()
    this.skidSource.buffer = this.noiseBuffer
    this.skidSource.loop = true
    const bandpass = this.ctx.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = 2100
    bandpass.Q.value = 3.4
    this.skidGain = this.ctx.createGain()
    this.skidGain.gain.value = 0
    this.skidSource.connect(bandpass)
    bandpass.connect(this.skidGain)
    this.skidGain.connect(this.masterGain)
    this.skidSource.start()
  }

  updateSkid(slipAmount: number): void {
    if (!this.ctx || !this.skidGain) return
    const target = Math.max(0, Math.min(0.34, slipAmount * 0.34))
    this.skidGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08)
  }

  stopSkid(): void {
    if (!this.ctx || !this.skidSource) return
    const source = this.skidSource
    const gain = this.skidGain
    this.skidSource = null
    this.skidGain = null
    if (gain) gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06)
    setTimeout(() => {
      try { source.stop() } catch { /* уже остановлен */ }
    }, 300)
  }

  thud(strength: number): void {
    this.ensureContext()
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return
    const source = this.ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    const lowpass = this.ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 160 + strength * 120
    const gain = this.ctx.createGain()
    const peak = 0.25 + strength * 0.45
    const now = this.ctx.currentTime
    gain.gain.setValueAtTime(peak, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32)
    source.connect(lowpass)
    lowpass.connect(gain)
    gain.connect(this.masterGain)
    source.start(now)
    source.stop(now + 0.36)
  }

  valveHiss(): void {
    this.ensureContext()
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return
    const source = this.ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    const highpass = this.ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 2600
    const gain = this.ctx.createGain()
    const now = this.ctx.currentTime
    gain.gain.setValueAtTime(0.22, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
    source.connect(highpass)
    highpass.connect(gain)
    gain.connect(this.masterGain)
    source.start(now)
    source.stop(now + 0.75)
  }

  beep(frequency: number, durationS = 0.14): void {
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return
    const osc = this.ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = frequency
    const gain = this.ctx.createGain()
    const now = this.ctx.currentTime
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(0.18, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationS)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + durationS + 0.02)
  }

  click(): void {
    this.beep(660, 0.05)
  }

  fanfare(win: boolean): void {
    const notes = win ? [392, 494, 587, 784] : [330, 262]
    notes.forEach((freq, i) => {
      setTimeout(() => this.beep(freq, 0.22), i * 130)
    })
  }

  countdownTick(final: boolean): void {
    this.beep(final ? 880 : 440, final ? 0.4 : 0.15)
  }

  driftTick(pitch: number): void {
    this.beep(520 + pitch * 420, 0.04)
  }

  turboWhoosh(): void {
    this.valveHiss()
    this.beep(240, 0.25)
  }

  get targetFps(): number {
    return balance.target_fps
  }
}
