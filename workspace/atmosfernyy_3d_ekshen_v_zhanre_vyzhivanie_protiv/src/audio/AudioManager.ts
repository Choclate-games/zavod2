/**
 * Процедурный звук на Web Audio API: ни одного аудиофайла. AudioContext
 * создаётся лениво по первому жесту игрока; всё идёт через один мастер-гейн,
 * мьют и приглушение трогают только его. Мьют игрока и мьют площадки —
 * два независимых входа.
 */
export class AudioManager {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private humOsc: OscillatorNode | null = null
  private humGain: GainNode | null = null
  private playerMuted = false
  private platformMuted = false
  private volume = 0.8

  constructor() {
    const unlock = (): void => {
      this.ensureContext()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    document.addEventListener('visibilitychange', () => {
      if (!this.context) return
      if (document.visibilityState === 'hidden') void this.context.suspend()
      else void this.context.resume()
    })
  }

  private ensureContext(): void {
    if (this.context) return
    const ContextCtor = window.AudioContext
    if (!ContextCtor) return
    this.context = new ContextCtor()
    this.masterGain = this.context.createGain()
    this.masterGain.gain.value = this.effectiveVolume()
    this.masterGain.connect(this.context.destination)
    this.startAmbient()
  }

  private effectiveVolume(): number {
    return this.playerMuted || this.platformMuted ? 0 : this.volume
  }

  private applyVolume(): void {
    if (!this.context || !this.masterGain) return
    // Плавный рамп: мгновенное изменение щёлкает.
    this.masterGain.gain.cancelScheduledValues(this.context.currentTime)
    this.masterGain.gain.linearRampToValueAtTime(this.effectiveVolume(), this.context.currentTime + 0.08)
  }

  setPlayerMuted(muted: boolean): void {
    this.playerMuted = muted
    this.applyVolume()
  }

  setPlatformMuted(muted: boolean): void {
    this.platformMuted = muted
    this.applyVolume()
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    this.applyVolume()
  }

  private startAmbient(): void {
    if (!this.context || !this.masterGain) return

    // Гул дуговой лампы: непрерывный осциллятор с меняющейся высотой.
    this.humOsc = this.context.createOscillator()
    this.humOsc.type = 'sawtooth'
    this.humOsc.frequency.value = 46
    this.humGain = this.context.createGain()
    this.humGain.gain.value = 0.035
    const humFilter = this.context.createBiquadFilter()
    humFilter.type = 'lowpass'
    humFilter.frequency.value = 220
    this.humOsc.connect(humFilter)
    humFilter.connect(this.humGain)
    this.humGain.connect(this.masterGain)
    this.humOsc.start()

    // Штормовой ветер: шумовой буфер через полосовой фильтр.
    const wind = this.context.createBufferSource()
    wind.buffer = this.getNoise(4)
    wind.loop = true
    const windFilter = this.context.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 380
    windFilter.Q.value = 0.6
    const windGain = this.context.createGain()
    windGain.gain.value = 0.05
    wind.connect(windFilter)
    windFilter.connect(windGain)
    windGain.connect(this.masterGain)
    wind.start()
  }

  private getNoise(seconds: number): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.duration >= seconds) return this.noiseBuffer
    const ctx = this.context as AudioContext
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuffer = buffer
    return buffer
  }

  /** Непрерывные звуки меняются параметрами, а не рестартуют каждый кадр. */
  setBeamState(focus: boolean, overheated: boolean): void {
    if (!this.context || !this.humOsc || !this.humGain) return
    const target = overheated ? 0.012 : focus ? 0.09 : 0.035
    this.humGain.gain.linearRampToValueAtTime(target, this.context.currentTime + 0.15)
    this.humOsc.frequency.linearRampToValueAtTime(focus ? 92 : 46, this.context.currentTime + 0.2)
  }

  click(): void {
    this.blip(880, 0.04, 'square', 0.06)
  }

  hover(): void {
    this.blip(520, 0.03, 'triangle', 0.03)
  }

  private blip(freq: number, duration: number, type: OscillatorType, gainValue: number): void {
    if (!this.ensureForSfx()) return
    const ctx = this.context as AudioContext
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(gainValue, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(this.masterGain as GainNode)
    osc.start()
    osc.stop(ctx.currentTime + duration + 0.02)
  }

  /** Бирюзовая детонация: низкий удар плюс шипящий спад. */
  blast(): void {
    if (!this.ensureForSfx()) return
    const ctx = this.context as AudioContext
    const thump = ctx.createOscillator()
    thump.type = 'sine'
    thump.frequency.setValueAtTime(120, ctx.currentTime)
    thump.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.35)
    const thumpGain = ctx.createGain()
    thumpGain.gain.setValueAtTime(0.5, ctx.currentTime)
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
    thump.connect(thumpGain)
    thumpGain.connect(this.masterGain as GainNode)
    thump.start()
    thump.stop(ctx.currentTime + 0.45)
    this.noiseHit(900, 0.28, 0.22)
  }

  vaporize(): void {
    this.noiseHit(2400, 0.14, 0.1)
  }

  steamBurst(): void {
    this.noiseHit(3200, 0.9, 0.3)
  }

  overheatAlarm(): void {
    this.blip(660, 0.18, 'square', 0.12)
    setTimeout(() => this.blip(495, 0.24, 'square', 0.12), 190)
  }

  phaseFanfare(): void {
    this.playNotes([392, 523, 659], 0.16)
  }

  victoryChord(): void {
    this.playNotes([523, 659, 784, 1047], 0.5)
  }

  defeatToll(): void {
    this.playNotes([196, 147, 98], 0.4)
  }

  private playNotes(freqs: number[], noteDuration: number): void {
    if (!this.ensureForSfx()) return
    freqs.forEach((freq, index) => {
      setTimeout(() => this.blip(freq, noteDuration * 2.2, 'triangle', 0.12), index * noteDuration * 1000)
    })
  }

  private noiseHit(filterFreq: number, duration: number, gainValue: number): void {
    if (!this.ensureForSfx()) return
    const ctx = this.context as AudioContext
    const source = ctx.createBufferSource()
    source.buffer = this.getNoise(duration + 0.1)
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    filter.Q.value = 0.8
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(gainValue, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain as GainNode)
    source.start()
    source.stop(ctx.currentTime + duration + 0.05)
  }

  private ensureForSfx(): boolean {
    this.ensureContext()
    if (!this.context || this.context.state !== 'running') return false
    return true
  }
}
