// РџСЂРѕС†РµРґСѓСЂРЅС‹Р№ Р·РІСѓРє: С‚РѕР»СЊРєРѕ Web Audio, Р±РµР· Р°СѓРґРёРѕС„Р°Р№Р»РѕРІ.
// РћРґРёРЅ master GainNode, РѕС‚РґРµР»СЊРЅС‹Рµ РІС…РѕРґС‹ mute РёРіСЂРѕРєР° Рё mute РїР»РѕС‰Р°РґРєРё.

import type { EventBus } from '../core/EventBus'

export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private windGain: GainNode | null = null
  private windSource: AudioBufferSourceNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private _muted = false
  private platformMuted = true
  private started = false

  constructor(bus: EventBus) {
    bus.on('platform:audio', (enabled) => {
      this.platformMuted = !(enabled as boolean)
      this.applyGain()
    })
  }

  /** Р—Р°РїСѓСЃРєР°РµС‚СЃСЏ РёР· РїРµСЂРІРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРѕРіРѕ Р¶РµСЃС‚Р°; boot РЅРµ Р¶РґС‘С‚ СЌС‚РѕРіРѕ. */
  ensureStarted(): void {
    if (this.started) return
    try {
      this.ctx = new AudioContext()
      const master = this.ctx.createGain()
      master.gain.value = 0
      master.connect(this.ctx.destination)
      this.master = master
      const length = this.ctx.sampleRate * 2
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
      this.noiseBuffer = buffer
      this.startWind()
      this.started = true
      this.applyGain()
    } catch {
      this.ctx = null
    }
  }

  setPlayerMuted(muted: boolean): void {
    this._muted = muted
    this.applyGain()
  }

  get playerMuted(): boolean {
    return this._muted
  }

  private applyGain(): void {
    if (!this.master || !this.ctx) return
    const target = this._muted || this.platformMuted ? 0 : 0.8
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setTargetAtTime(target, now, 0.08)
  }

  private startWind(): void {
    if (!this.ctx || !this.noiseBuffer || !this.master) return
    const source = this.ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    source.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 400
    filter.Q.value = 0.6
    const gain = this.ctx.createGain()
    gain.gain.value = 0.05
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start()
    this.windSource = source
    this.windGain = gain
  }

  setWindIntensity(ms: number): void {
    if (!this.ctx || !this.windGain || !this.windSource) return
    const normalized = Math.min(1, ms / 50)
    const now = this.ctx.currentTime
    this.windGain.gain.setTargetAtTime(0.03 + normalized * 0.12, now, 0.4)
    // С‡Р°СЃС‚РѕС‚РЅРѕР№ РјРѕРґСѓР»СЏС†РёРё С„РёР»СЊС‚СЂР° РґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РґР»СЏ РѕС‰СѓС‰РµРЅРёСЏ С€РєРІР°Р»Р°
  }

  private burst(durationS: number, frequencyHz: number, type: OscillatorType, volume: number): void {
    if (!this.ctx || !this.master || !this.started) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(frequencyHz, now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequencyHz * 0.4), now + durationS)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationS)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + durationS + 0.02)
  }

  private noiseHit(durationS: number, cutoffHz: number, volume: number, delayS = 0): void {
    if (!this.ctx || !this.master || !this.noiseBuffer || !this.started) return
    const now = this.ctx.currentTime + delayS
    const source = this.ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    source.playbackRate.value = 0.7 + Math.random() * 0.6
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(cutoffHz, now)
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, cutoffHz * 0.15), now + durationS)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationS)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start(now)
    source.stop(now + durationS + 0.05)
  }

  playShot(): void {
    this.burst(0.09, 900, 'square', 0.25)
    this.noiseHit(0.12, 3200, 0.3)
  }

  playExplosion(): void {
    this.noiseHit(0.5, 1400, 0.55)
    this.burst(0.35, 120, 'sine', 0.5)
  }

  playThunder(delayS: number): void {
    this.noiseHit(1.6, 500, 0.5, Math.max(0, delayS))
  }

  playHit(): void {
    this.burst(0.05, 1600, 'triangle', 0.2)
  }

  playKill(): void {
    this.burst(0.16, 700, 'sawtooth', 0.28)
    this.noiseHit(0.25, 2000, 0.35)
  }

  playDamage(): void {
    this.burst(0.3, 160, 'square', 0.45)
    this.noiseHit(0.3, 800, 0.4)
  }

  playTesla(): void {
    this.burst(2.0, 220, 'sawtooth', 0.22)
    this.noiseHit(2.0, 2400, 0.18)
  }

  playUiClick(): void {
    this.burst(0.04, 1200, 'sine', 0.15)
  }

  playVictory(): void {
    this.burst(0.5, 520, 'triangle', 0.3)
    setTimeout(() => this.burst(0.7, 780, 'triangle', 0.3), 180)
  }

  playDefeat(): void {
    this.burst(0.9, 220, 'triangle', 0.35)
  }

  suspendOnBlur(): void {
    void this.ctx?.suspend().catch(() => undefined)
  }
}

