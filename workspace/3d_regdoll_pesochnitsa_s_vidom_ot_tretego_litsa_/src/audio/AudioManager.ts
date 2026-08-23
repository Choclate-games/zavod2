/**
 * Процедурный звук на Web Audio API: без аудиофайлов. Всё идёт через один
 * мастер GainNode с рампой; mute игрока и mute площадки — раздельные входы.
 * AudioContext стартует suspended и оживляется первым жестом игрока.
 */
export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private playerMuted = false
  private platformMuted = false
  private tensionOsc: OscillatorNode | null = null
  private tensionGain: GainNode | null = null
  private windSource: AudioBufferSourceNode | null = null
  private windGain: GainNode | null = null

  /** Вызывается из первого pointerdown/keydown игрока. */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.targetMasterGain()
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private targetMasterGain(): number {
    if (this.playerMuted || this.platformMuted) return 0
    return 0.8
  }

  setPlayerMuted(muted: boolean): void {
    this.playerMuted = muted
    this.applyGain()
  }

  setPlatformMuted(muted: boolean): void {
    this.platformMuted = muted
    this.applyGain()
  }

  /** Мьют и возврат из рекламы — только рампой, мгновенный щелчок недопустим. */
  private applyGain(): void {
    const master = this.master
    const ctx = this.ctx
    if (!master || !ctx) return
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.linearRampToValueAtTime(this.targetMasterGain(), ctx.currentTime + 0.15)
  }

  /** Нарастающий скрип тросов при натяжении катапульты. */
  startTension(): void {
    if (!this.ctx || !this.master) return
    this.stopTension()
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.value = 80
    gain.gain.value = 0.0001
    osc.connect(gain)
    gain.connect(this.master)
    osc.start()
    this.tensionOsc = osc
    this.tensionGain = gain
  }

  updateTension(pullFraction: number): void {
    if (!this.ctx || !this.tensionOsc || !this.tensionGain) return
    this.tensionOsc.frequency.setTargetAtTime(80 + pullFraction * 220, this.ctx.currentTime, 0.05)
    this.tensionGain.gain.setTargetAtTime(0.02 + pullFraction * 0.06, this.ctx.currentTime, 0.05)
  }

  stopTension(): void {
    try { this.tensionOsc?.stop() } catch { /* уже остановлен */ }
    this.tensionOsc?.disconnect()
    this.tensionGain?.disconnect()
    this.tensionOsc = null
    this.tensionGain = null
  }

  /** Свист ветра в полёте: фильтрованный шум с питчем от скорости. */
  startWind(): void {
    if (!this.ctx || !this.master) return
    this.stopWind()
    const seconds = 2
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 400
    filter.Q.value = 1.5
    const gain = this.ctx.createGain()
    gain.gain.value = 0
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start()
    this.windSource = source
    this.windGain = gain
  }

  updateWind(speedFraction: number): void {
    if (!this.ctx || !this.windGain) return
    this.windGain.gain.setTargetAtTime(speedFraction * 0.08, this.ctx.currentTime, 0.1)
  }

  stopWind(): void {
    try { this.windSource?.stop() } catch { /* уже остановлен */ }
    this.windSource?.disconnect()
    this.windGain?.disconnect()
    this.windSource = null
    this.windGain = null
  }

  /** Хлопок пробки на выстреле. */
  launchPop(): void {
    this.blip(180, 0.25, 0.3, 'square', 0.12)
  }

  /** Лязг разрыва стального троса. */
  cableSnap(): void {
    this.blip(3200, 0.5, 0.35, 'square', 0.2)
    this.noiseBurst(0.4, 0.18, 2400)
  }

  glassShatter(): void {
    for (let i = 0; i < 4; i++) {
      const freq = 1400 + Math.random() * 1800
      setTimeout(() => this.blip(freq, 0.18, 0.08, 'sine', 0.06), i * 40)
    }
  }

  creamSplat(): void {
    this.noiseBurst(0.5, 0.22, 300)
  }

  starChord(stars: number): void {
    const base = 523.25
    for (let i = 0; i < stars; i++) {
      const freq = base * (1 + i * 0.26)
      setTimeout(() => this.blip(freq, 0.5, 0.14, 'triangle', 0.1), i * 120)
    }
  }

  failThud(): void {
    this.blip(90, 0.6, 0.3, 'sine', 0.15)
  }

  private blip(freq: number, duration: number, decay: number, type: OscillatorType, volume: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + decay)
    osc.connect(gain)
    gain.connect(master)
    osc.start()
    osc.stop(ctx.currentTime + duration)
    osc.onended = () => osc.disconnect()
  }

  private noiseBurst(duration: number, decay: number, cutoffHz: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const length = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoffHz
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + decay)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    source.start()
    source.onended = () => source.disconnect()
  }
}
