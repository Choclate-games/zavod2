import type { EventBus } from '../core/EventBus'

/**
 * Процедурный звук на чистом Web Audio API: никаких аудиофайлов.
 * Один мастер-GainNode: mute, приглушение и флаг площадки трогают только его,
 * громкость меняется ramp-ом, чтобы не щёлкать. Контекст стартует suspended
 * и разблокируется первым жестом игрока, boot не блокирует.
 */
export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private musicTimer = 0
  private musicStep = 0
  private userMuted = false
  private platformMuted = false
  private engineOsc: OscillatorNode | null = null
  private engineGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  constructor(bus: EventBus) {
    bus.on('platform:audio', ({ value }) => {
      // Флаг площадки — отдельный вход мьюта, не трогает пользовательский.
      this.setPlatformMuted(value === 'MUTED')
    })
  }

  /** Разблокировка по первому жесту — вызывается из обработчика клика/тапа. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.userMuted || this.platformMuted ? 0 : 0.9
      this.master.connect(this.ctx.destination)
      this.musicGain = this.ctx.createGain()
      this.musicGain.gain.value = 0.22
      this.musicGain.connect(this.master)
      this.noiseBuffer = this.createNoiseBuffer()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setPlatformMuted(muted: boolean): void {
    this.platformMuted = muted
    this.applyMasterVolume()
  }

  setUserMuted(muted: boolean): void {
    this.userMuted = muted
    this.applyMasterVolume()
  }

  isUserMuted(): boolean {
    return this.userMuted
  }

  private applyMasterVolume(): void {
    if (!this.ctx || !this.master) return
    const target = this.userMuted || this.platformMuted ? 0 : 0.9
    // Ramp вместо мгновенной установки: иначе щелчок в колонках.
    this.master.gain.cancelScheduledValues(this.ctx.currentTime)
    this.master.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.08)
  }

  impact(strength: number): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    // Басовый «бум» столкновения: синус с быстрым спадом высоты и громкости.
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    const volume = Math.min(1, strength)
    osc.frequency.setValueAtTime(120 + volume * 60, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.18)
    gain.gain.setValueAtTime(0.7 * volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28)
    osc.connect(gain).connect(this.master)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
    this.playNoise(0.12, 0.25 * volume, 900)
  }

  crack(): void {
    // Треск льда: короткая серия шумовых щелчков с падающей частотой.
    for (let i = 0; i < 4; i++) {
      window.setTimeout(() => this.playNoise(0.05, 0.3 - i * 0.05, 2400 - i * 400), i * 45)
    }
  }

  splash(): void {
    this.playNoise(0.5, 0.5, 700)
    window.setTimeout(() => this.playNoise(0.35, 0.25, 420), 90)
  }

  boostWhoosh(): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const source = ctx.createBufferSource()
    if (!source.buffer && this.noiseBuffer) source.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(300, ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(2600, ctx.currentTime + 0.3)
    filter.Q.value = 1.2
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.1)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55)
    source.connect(filter).connect(gain).connect(this.master)
    source.start()
    source.stop(ctx.currentTime + 0.6)
  }

  countdownBeep(final: boolean): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = final ? 880 : 440
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (final ? 0.5 : 0.15))
    osc.connect(gain).connect(this.master)
    osc.start()
    osc.stop(ctx.currentTime + 0.55)
  }

  coin(): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(1180, ctx.currentTime)
    osc.frequency.setValueAtTime(1560, ctx.currentTime + 0.07)
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.connect(gain).connect(this.master)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  }

  /** Рёв турбины во время форсажа: управляемый осциллятор движка. */
  setEngineActive(active: boolean, intensity: number): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    if (active && !this.engineOsc) {
      this.engineOsc = ctx.createOscillator()
      this.engineGain = ctx.createGain()
      this.engineOsc.type = 'sawtooth'
      this.engineOsc.frequency.value = 70
      this.engineGain.gain.value = 0.001
      this.engineOsc.connect(this.engineGain).connect(this.master)
      this.engineOsc.start()
    } else if (!active && this.engineOsc && this.engineGain) {
      this.engineGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.12)
      const osc = this.engineOsc
      window.setTimeout(() => {
        try {
          osc.stop()
        } catch {
          // Осциллятор уже остановлен.
        }
      }, 200)
      this.engineOsc = null
      this.engineGain = null
      return
    }
    if (this.engineOsc && this.engineGain) {
      this.engineOsc.frequency.setTargetAtTime(60 + intensity * 80, ctx.currentTime, 0.06)
      this.engineGain.gain.setTargetAtTime(0.14 * intensity, ctx.currentTime, 0.06)
    }
  }

  /**
   * Музыка: минималистичный драйвовый секвенсор на осцилляторах.
   * Вызывается каждый кадр с dt; шаги тикают по внутреннему таймеру.
   */
  updateMusic(dt: number, playing: boolean): void {
    if (!this.ctx || !this.musicGain) return
    if (!playing) {
      this.musicStep = 0
      return
    }
    const stepDuration = 0.24
    this.musicTimer += dt
    while (this.musicTimer >= stepDuration) {
      this.musicTimer -= stepDuration
      const scale = [110, 130.81, 146.83, 174.61, 196, 220, 261.63]
      const step = this.musicStep % 16
      const note = scale[step % scale.length]
      this.playNote(step % 4 === 0 ? note / 2 : note, step % 8 === 6 ? 0.16 : 0.09, 0.18)
      this.musicStep++
    }
  }

  private playNote(freq: number, volume: number, duration: number): void {
    const ctx = this.ctx
    if (!ctx || !this.musicGain) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain).connect(this.musicGain)
    osc.start()
    osc.stop(ctx.currentTime + duration + 0.02)
  }

  private playNoise(duration: number, volume: number, filterFreq: number): void {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.noiseBuffer) return
    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = filterFreq
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    source.connect(filter).connect(gain).connect(this.master)
    source.start()
    source.stop(ctx.currentTime + duration + 0.02)
  }

  private createNoiseBuffer(): AudioBuffer | null {
    const ctx = this.ctx
    if (!ctx) return null
    const length = Math.floor(ctx.sampleRate * 0.6)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  dispose(): void {
    this.setEngineActive(false, 0)
    if (this.ctx) void this.ctx.close()
    this.ctx = null
  }
}

