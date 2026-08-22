export class ProceduralSoundSynthesizer {
  private ctx: AudioContext;
  private destinationNode: AudioNode;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destinationNode = destination;
  }

  playC4Explosion(): void {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;

    // 1. Sub-bass sine drop (45Hz - 20Hz)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.6);
    subGain.gain.setValueAtTime(0.9, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    subOsc.connect(subGain);
    subGain.connect(this.destinationNode);
    subOsc.start(now);
    subOsc.stop(now + 1.2);

    // 2. White noise burst with lowpass filter sweep
    const bufferSize = this.ctx.sampleRate * 0.8;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.8);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.destinationNode);

    noise.start(now);
    noise.stop(now + 0.8);
  }

  playGunshot(type: "pistol" | "smg" | "shotgun" | "revolver"): void {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;

    let baseFreq = 380;
    let length = 0.25;
    let noiseVol = 0.7;

    if (type === "smg") {
      baseFreq = 300;
      length = 0.18;
      noiseVol = 0.5;
    } else if (type === "shotgun") {
      baseFreq = 180;
      length = 0.45;
      noiseVol = 1.0;
    } else if (type === "revolver") {
      baseFreq = 240;
      length = 0.38;
      noiseVol = 0.85;
    }

    // Punch transient
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + length * 0.5);

    oscGain.gain.setValueAtTime(0.8, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + length * 0.6);

    osc.connect(oscGain);
    oscGain.connect(this.destinationNode);
    osc.start(now);
    osc.stop(now + length * 0.6);

    // Crack noise
    const bufferSize = Math.floor(this.ctx.sampleRate * length);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.05));
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(type === "smg" ? 2200 : 1500, now);
    noiseFilter.Q.setValueAtTime(2.0, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(noiseVol, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + length);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.destinationNode);

    noiseSource.start(now);
    noiseSource.stop(now + length);
  }

  playHeadshotDing(): void {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;

    // Metallic helmet chime
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(2400, now);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(3600, now);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.destinationNode);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  }

  playShieldRicochet(): void {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(1100 + Math.random() * 400, now);
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.2);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.destinationNode);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  playHeartbeat(): void {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;

    const pulse = (timeOffset: number, volume: number) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(65, now + timeOffset);
      osc.frequency.exponentialRampToValueAtTime(35, now + timeOffset + 0.12);

      gain.gain.setValueAtTime(volume, now + timeOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.15);

      osc.connect(gain);
      gain.connect(this.destinationNode);
      osc.start(now + timeOffset);
      osc.stop(now + timeOffset + 0.15);
    };

    pulse(0, 0.5);
    pulse(0.12, 0.35);
  }

  playTinnitusBeep(duration = 1.8): void {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(4200, now);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.destinationNode);

    osc.start(now);
    osc.stop(now + duration);
  }

  playBombBeep(pitchMult = 1.0): void {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(880 * pitchMult, now);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.destinationNode);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  playWireSnip(): void {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.destinationNode);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  playDefusalSuccess(): void {
    if (this.ctx.state !== "running") return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0.3, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);

      osc.connect(gain);
      gain.connect(this.destinationNode);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.3);
    });
  }

  playDefusalWarning(): void {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.35);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.destinationNode);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  playC4Plant(): void {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;

    // Slap thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.destinationNode);
    osc.start(now);
    osc.stop(now + 0.12);

    // Beep 1 & Beep 2
    [0.15, 0.3].forEach((tOffset, i) => {
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bOsc.type = "sine";
      bOsc.frequency.setValueAtTime(i === 0 ? 1200 : 1800, now + tOffset);
      bGain.gain.setValueAtTime(0.2, now + tOffset);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + tOffset + 0.08);
      bOsc.connect(bGain);
      bGain.connect(this.destinationNode);
      bOsc.start(now + tOffset);
      bOsc.stop(now + tOffset + 0.08);
    });
  }

  playUiClick(): void {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.04);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.destinationNode);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  playReloadClick(): void {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;

    [0, 0.2, 0.45].forEach((tOffset, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(500 + i * 200, now + tOffset);
      osc.frequency.exponentialRampToValueAtTime(200, now + tOffset + 0.06);
      gain.gain.setValueAtTime(0.3, now + tOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + tOffset + 0.06);
      osc.connect(gain);
      gain.connect(this.destinationNode);
      osc.start(now + tOffset);
      osc.stop(now + tOffset + 0.06);
    });
  }
}
