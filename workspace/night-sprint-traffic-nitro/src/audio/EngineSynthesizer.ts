export class EngineSynthesizer {
  private actx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private osc3: OscillatorNode | null = null;
  private turboOsc: OscillatorNode | null = null;

  private engineGain: GainNode | null = null;
  private turboGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;

  private isRunning = false;
  private lastThrottle = 0;

  initialize(actx: AudioContext, outputGain: GainNode): void {
    this.actx = actx;
    this.masterGain = actx.createGain();
    this.masterGain.gain.value = 0.40;
    this.masterGain.connect(outputGain);

    this.filter = actx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 900;
    this.filter.connect(this.masterGain);

    this.engineGain = actx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineGain.connect(this.filter);

    this.osc1 = actx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc1.frequency.value = 50;
    this.osc1.connect(this.engineGain);

    this.osc2 = actx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.value = 100;
    this.osc2.connect(this.engineGain);

    this.osc3 = actx.createOscillator();
    this.osc3.type = 'square';
    this.osc3.frequency.value = 150;
    this.osc3.connect(this.engineGain);

    this.turboGain = actx.createGain();
    this.turboGain.gain.value = 0.0;
    this.turboGain.connect(this.masterGain);

    this.turboOsc = actx.createOscillator();
    this.turboOsc.type = 'sine';
    this.turboOsc.frequency.value = 1500;
    this.turboOsc.connect(this.turboGain);

    this.osc1.start();
    this.osc2.start();
    this.osc3.start();
    this.turboOsc.start();
    this.isRunning = true;
  }

  update(rpm: number, throttle: number, isNitro: boolean): void {
    if (!this.isRunning || !this.actx || !this.filter) return;

    const now = this.actx.currentTime;

    const fundamentalHz = 35 + (rpm / 8500) * 220;

    this.osc1?.frequency.setValueAtTime(fundamentalHz, now);
    this.osc2?.frequency.setValueAtTime(fundamentalHz * 1.5, now);
    this.osc3?.frequency.setValueAtTime(fundamentalHz * 2.0, now);

    const cutoffHz = 600 + throttle * 1800 + (rpm / 8500) * 2200 + (isNitro ? 1200 : 0);
    this.filter.frequency.setValueAtTime(cutoffHz, now);

    const vol = 0.15 + throttle * 0.25 + (isNitro ? 0.15 : 0);
    this.engineGain?.gain.setValueAtTime(vol, now);

    const turboFreq = 1200 + (rpm / 8500) * 3500;
    this.turboOsc?.frequency.setValueAtTime(turboFreq, now);
    const turboVol = throttle * (isNitro ? 0.08 : 0.04);
    this.turboGain?.gain.setValueAtTime(turboVol, now);

    if (this.lastThrottle > 0.7 && throttle < 0.2 && rpm > 4500) {
      this.playBlowOffValve();
    }
    this.lastThrottle = throttle;
  }

  playIdle(): void {
    if (!this.isRunning || !this.actx) return;
    const now = this.actx.currentTime;
    this.osc1?.frequency.setValueAtTime(35, now);
    this.osc2?.frequency.setValueAtTime(52, now);
    this.filter?.frequency.setValueAtTime(500, now);
    this.engineGain?.gain.setValueAtTime(0.10, now);
    this.turboGain?.gain.setValueAtTime(0, now);
  }

  private playBlowOffValve(): void {
    if (!this.actx || !this.masterGain) return;
    const now = this.actx.currentTime;

    // White noise burst with highpass
    const bufferSize = this.actx.sampleRate * 0.35;
    const noiseBuffer = this.actx.createBuffer(1, bufferSize, this.actx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.actx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.actx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3800;
    filter.Q.value = 3.0;

    const gain = this.actx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.35);
  }

  stop(): void {
    if (this.isRunning) {
      this.osc1?.stop();
      this.osc2?.stop();
      this.osc3?.stop();
      this.turboOsc?.stop();
      this.isRunning = false;
    }
  }
}

export const engineSynthesizer = new EngineSynthesizer();
