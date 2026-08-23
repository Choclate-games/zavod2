/**
 * Web Audio: процедурный синтез, ни одного mp3.
 * Адаптация готового модуля фабрики knowledge-showcase/src/audio/AudioManager.ts:
 * взяты ядро (ленивый контекст, мастер-гейн, мьют гейном, suspend на visibility)
 * и звуки выстрела/взрыва/клика; движок и транспортные звуки удалены,
 * добавлены игровые сигналы дубля.
 */

export class AudioManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private muted = false
  private platformMuted = false
  public masterVolume = 0.8

  constructor() {
    // Контекст создаётся лениво по первому жесту игрока.
    const unlock = (): void => {
      this.ensureContext()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return
      if (document.hidden) {
        if (this.ctx.state === 'running') void this.ctx.suspend()
      } else if (this.ctx.state === 'suspended') {
        void this.ctx.resume()
      }
    })
  }

  ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const Ctor = window.AudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.muted || this.platformMuted ? 0.0001 : this.masterVolume
      this.masterGain.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.applyGain()
  }

  setPlatformMuted(muted: boolean): void {
    this.platformMuted = muted
    this.applyGain()
  }

  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume))
    this.applyGain()
  }

  private applyGain(): void {
    if (this.masterGain && this.ctx) {
      const target = this.muted || this.platformMuted ? 0.0001 : this.masterVolume
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05)
    }
  }

  /** Выстрел-монтаж: питч-удар + шумовой щелчок. */
  playGunshot(): void {
    const ctx = this.readyForWorldSound()
    if (!ctx || !this.masterGain) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const oscGain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(260, now)
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.12)
    oscGain.gain.setValueAtTime(0.7, now)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    osc.connect(oscGain)
    oscGain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.14)
    this.noiseCrack(ctx, 1800, 0.07, 0.65)
  }

  /** Промах: сухой серый щелчок без тона подтверждения. */
  playMissClick(): void {
    const ctx = this.readyForWorldSound()
    if (!ctx) return
    this.noiseCrack(ctx, 500, 0.04, 0.22)
  }

  /** Подтверждённое попадание: короткий белый тон. */
  playHitConfirm(): void {
    this.blip(880, 1320, 0.07, 0.3)
  }

  /** Хедшот: двойной восходящий чирп — магазин снова полон. */
  playHeadshotRefill(): void {
    this.blip(660, 990, 0.06, 0.35)
    setTimeoutSafe(() => this.blip(990, 1480, 0.08, 0.35), 70)
  }

  /** Треск цепной декорации перед падением. */
  playChainCrack(): void {
    const ctx = this.readyForWorldSound()
    if (!ctx) return
    this.noiseCrack(ctx, 320, 0.16, 0.5)
  }

  /** Грохот обрушения фасада. */
  playCollapse(intensity = 1): void {
    const ctx = this.readyForWorldSound()
    if (!ctx || !this.masterGain) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, now)
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.4)
    gain.gain.setValueAtTime(0.9 * intensity, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.45)
    this.noiseCrack(ctx, 240, 0.5, 0.7 * intensity, true)
  }

  /** Попадание по игроку: резкий диссонанс. */
  playPlayerHit(): void {
    this.blip(220, 110, 0.18, 0.6, 'sawtooth')
  }

  /** Раннее предупреждение светового блокинга. */
  playWarnEarly(): void {
    this.blip(520, 520, 0.1, 0.2)
  }

  /** Позднее предупреждение: вход через мгновение. */
  playWarnLate(): void {
    this.blip(700, 700, 0.08, 0.3)
  }

  /** Заряд активирован: трёхимпульсный сигнал причины провала. */
  playChargeArmed(): void {
    for (let i = 0; i < 3; i++) {
      setTimeoutSafe(() => this.blip(180, 140, 0.12, 0.5, 'square'), i * 160)
    }
  }

  /** Провал «боезапас исчерпан»: сухой затвор. */
  playFailAmmo(): void {
    this.blip(160, 60, 0.15, 0.55, 'square')
  }

  /** Провал «стрелок ранен»: нисходящий минор. */
  playFailHits(): void {
    this.blip(330, 165, 0.4, 0.5, 'sawtooth')
  }

  /** Провал «не уложился в метраж»: сирена оповещения. */
  playAlarm(): void {
    const ctx = this.readyForWorldSound()
    if (!ctx || !this.masterGain) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(650, now)
    osc.frequency.linearRampToValueAtTime(950, now + 0.15)
    osc.frequency.linearRampToValueAtTime(650, now + 0.3)
    gain.gain.setValueAtTime(0.35, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.3)
  }

  /** Победа: фанфара из четырёх нот. */
  playVictory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, i) => {
      setTimeoutSafe(() => this.blip(freq, freq, 0.3, 0.32, 'triangle'), i * 90)
    })
  }

  /** Клик интерфейса — отличается от звуков мира. */
  playButtonClick(): void {
    this.blip(1400, 700, 0.04, 0.25)
  }

  /** Шаги: тихий шумовой тук. */
  playFootstep(): void {
    const ctx = this.readyForWorldSound()
    if (!ctx) return
    this.noiseCrack(ctx, 180, 0.05, 0.12)
  }

  private readyForWorldSound(): AudioContext | null {
    if (this.muted || this.platformMuted) return null
    return this.ensureContext()
  }

  private blip(
    fromHz: number, toHz: number, durationS: number, amplitude: number,
    type: OscillatorType = 'sine',
  ): void {
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(fromHz, now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, toHz), now + durationS)
    gain.gain.setValueAtTime(amplitude, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationS)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + durationS)
  }

  private noiseCrack(
    ctx: AudioContext, centerHz: number, durationS: number, amplitude: number,
    lowpass = false,
  ): void {
    if (!this.masterGain) return
    const now = ctx.currentTime
    const bufferSize = Math.floor(ctx.sampleRate * durationS)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = lowpass ? 'lowpass' : 'bandpass'
    filter.frequency.setValueAtTime(centerHz, now)
    filter.Q.setValueAtTime(lowpass ? 0.8 : 2.2, now)

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(amplitude, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + durationS)

    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(this.masterGain)
    noise.start(now)
  }
}

function setTimeoutSafe(cb: () => void, delayMs: number): void {
  setTimeout(() => {
    try {
      cb()
    } catch {
      /* контекст уже закрыт */
    }
  }, delayMs)
}
