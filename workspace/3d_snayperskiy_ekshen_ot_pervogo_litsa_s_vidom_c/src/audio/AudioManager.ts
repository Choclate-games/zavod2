/** Процедурный звук на Web Audio: один мастер-GainNode, отдельные входы мьюта
 * игрока и площадки, контекст оживает по первому жесту игрока. */
export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private windSource: AudioBufferSourceNode | null = null
  private windGain: GainNode | null = null
  private heartbeatTimer = 0
  private heartbeatOn = false

  playerMuted = false
  platformMuted = false

  /** Вызывается из первого реального жеста игрока; никогда не блокирует загрузку. */
  resume(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? null
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
      this.applyMute()
      this.noiseBuffer = this.createNoise()
    }
    void this.ctx.resume().catch(() => undefined)
    this.startWind()
  }

  private applyMute(): void {
    if (!this.ctx || !this.master) return
    const target = this.playerMuted || this.platformMuted ? 0 : 0.9
    // рампа вместо мгновенного скачка — иначе щелчок в колонках
    this.master.gain.cancelScheduledValues(this.ctx.currentTime)
    this.master.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.15)
  }

  setPlayerMuted(muted: boolean): void {
    this.playerMuted = muted
    this.applyMute()
  }

  setPlatformMuted(muted: boolean): void {
    this.platformMuted = muted
    this.applyMute()
  }

  private createNoise(): AudioBuffer {
    const ctx = this.requireCtx()
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  private requireCtx(): AudioContext {
    if (!this.ctx) throw new Error('AudioContext is not initialized')
    return this.ctx
  }

  private startWind(): void {
    if (this.windSource || !this.noiseBuffer) return
    const ctx = this.requireCtx()
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 420
    filter.Q.value = 0.6
    const gain = ctx.createGain()
    gain.gain.value = 0.05
    src.connect(filter).connect(gain).connect(this.master ?? ctx.destination)
    src.start()
    this.windSource = src
    this.windGain = gain
  }

  /** Сила ветра слышна как громкость и высота бури. */
  setWind(speed: number): void {
    if (!this.windGain || !this.ctx) return
    const t0 = this.ctx.currentTime
    this.windGain.gain.setTargetAtTime(0.02 + Math.min(speed, 14.5) / 90, t0, 0.4)
  }

  shot(): void {
    this.playNoiseBurst(0.5, 240, 'lowpass', 3)
    this.playTone(70, 0.18, 0.5, 'sine', -12)
    this.playNoiseEcho(0.35, 500, 0.28)
  }

  ricochet(): void {
    this.playTone(1750, 0.22, 0.16, 'triangle', -30)
    this.playNoiseBurst(0.12, 3200, 'highpass', 1)
  }

  iceCrack(): void {
    for (let k = 0; k < 6; k++) {
      setTimeout(() => this.playNoiseBurst(0.09, 2600 + k * 400, 'highpass', 1), k * 55)
    }
    this.playTone(140, 0.7, 0.4, 'sawtooth', -10)
  }

  avalancheRumble(duration: number): void {
    const ctx = this.ctx
    if (!ctx || !this.noiseBuffer || !this.master) return
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 85
    const gain = ctx.createGain()
    const t0 = ctx.currentTime
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.85, t0 + 0.6)
    gain.gain.setTargetAtTime(0.0001, t0 + duration, duration * 0.45)
    src.connect(filter).connect(gain).connect(this.master)
    src.start()
    src.stop(t0 + duration * 2.2)
  }

  titanStep(): void {
    this.playTone(42, 0.34, 0.5, 'sine', -6)
  }

  whistle(): void {
    this.playTone(2100, 0.32, 0.22, 'sine', -14)
    setTimeout(() => this.playTone(2650, 0.24, 0.18, 'sine', -16), 120)
  }

  scopeClick(): void {
    this.playNoiseBurst(0.04, 1800, 'bandpass', 0.8)
  }

  victoryChord(): void {
    for (const [freq, delay] of [[392, 0], [494, 130], [587, 260]] as Array<[number, number]>) {
      setTimeout(() => this.playTone(freq, 0.6, 0.2, 'triangle', -12), delay)
    }
  }

  defeatLow(): void {
    this.playTone(110, 0.9, 0.3, 'sawtooth', -14)
  }

  /** Глухое сердцебиение при задержке дыхания: низкий тук-тук раз в секунду. */
  setHeartbeat(on: boolean): void {
    this.heartbeatOn = on
    if (!on) this.heartbeatTimer = 0
  }

  update(dt: number): void {
    if (!this.heartbeatOn || !this.ctx) return
    this.heartbeatTimer -= dt
    if (this.heartbeatTimer <= 0) {
      this.heartbeatTimer = 1.05
      this.playTone(52, 0.12, 0.5, 'sine', -4)
      setTimeout(() => this.playTone(48, 0.1, 0.38, 'sine', -6), 190)
    }
  }

  private playTone(freq: number, duration: number, gainValue: number, type: OscillatorType, db = 0): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const gain = ctx.createGain()
    const t0 = ctx.currentTime
    const peak = gainValue * Math.pow(10, db / 20)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    osc.connect(gain).connect(this.master)
    osc.start()
    osc.stop(t0 + duration + 0.05)
  }

  private playNoiseBurst(duration: number, cutoff: number, filterType: BiquadFilterType, gainValue: number): void {
    const ctx = this.ctx
    if (!ctx || !this.noiseBuffer || !this.master) return
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = filterType
    filter.frequency.value = cutoff
    const gain = ctx.createGain()
    const t0 = ctx.currentTime
    gain.gain.setValueAtTime(gainValue, t0)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
    src.connect(filter).connect(gain).connect(this.master)
    src.start(t0)
    src.stop(t0 + duration + 0.05)
  }

  private playNoiseEcho(duration: number, cutoff: number, gainValue: number): void {
    setTimeout(() => this.playNoiseBurst(duration, cutoff, 'lowpass', gainValue * 0.5), 340)
    setTimeout(() => this.playNoiseBurst(duration, cutoff, 'lowpass', gainValue * 0.25), 720)
  }
}
