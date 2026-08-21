export class MusicSynthesizer {
  private actx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private isPlaying = false;
  private sequencerTimer: any = null;
  private step = 0;
  private readonly bpm = 140;

  // Chord progression: C min / Eb maj / F min / G phrygian
  private readonly bassNotes = [65.41, 77.78, 87.31, 98.00]; // C2, Eb2, F2, G2
  private readonly leadScale = [261.63, 311.13, 349.23, 392.00, 466.16, 523.25]; // C4, Eb4, F4, G4, Bb4, C5

  initialize(actx: AudioContext, outputGain: GainNode): void {
    this.actx = actx;
    this.masterGain = actx.createGain();
    this.masterGain.gain.value = 0.25;
    this.masterGain.connect(outputGain);
  }

  start(): void {
    if (this.isPlaying || !this.actx) return;
    this.isPlaying = true;
    this.step = 0;

    const stepTimeMs = (60 / this.bpm / 4) * 1000;
    this.sequencerTimer = setInterval(() => {
      this.tick();
    }, stepTimeMs);
  }

  stop(): void {
    if (this.sequencerTimer) {
      clearInterval(this.sequencerTimer);
      this.sequencerTimer = null;
    }
    this.isPlaying = false;
  }

  setVolume(vol: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = vol * 0.35;
    }
  }

  private tick(): void {
    if (!this.actx || !this.masterGain || !this.isPlaying) return;
    const now = this.actx.currentTime;
    const subStep = this.step % 16;
    const barIdx = Math.floor(this.step / 16) % 4;

    if (subStep % 4 === 0) {
      this.playKick(now);
    }

    if (subStep === 4 || subStep === 12) {
      this.playSnare(now);
    }

    if (subStep % 2 === 0) {
      const feq = this.bassNotes[barIdx];
      const octaveMult = (subStep === 2 || subStep === 10) ? 2.0 : 1.0;
      this.playBassNote(feq * octaveMult, now);
    }

    if (subStep % 2 === 1 && Math.random() < 0.85) {
      const leadNote = this.leadScale[Math.floor(Math.random() * this.leadScale.length)];
      this.playLeadNote(leadNote, now);
    }

    this.step++;
  }

  private playKick(when: number): void {
    if (!this.actx || !this.masterGain) return;
    const osc = this.actx.createOscillator();
    const gain = this.actx.createGain();

    osc.frequency.setValueAtTime(160, when);
    osc.frequency.exponentialRampToValueAtTime(38, when + 0.15);

    gain.gain.setValueAtTime(0.75, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(when);
    osc.stop(when + 0.20);
  }

  private playSnare(when: number): void {
    if (!this.actx || !this.masterGain) return;
    const bufferSize = this.actx.sampleRate * 0.20;
    const buffer = this.actx.createBuffer(1, bufferSize, this.actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }

    const noise = this.actx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.actx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    const gain = this.actx.createGain();
    gain.gain.setValueAtTime(0.30, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(when);
    noise.stop(when + 0.20);
  }

  private playBassNote(frequency: number, when: number): void {
    if (!this.actx || !this.masterGain) return;
    const osc = this.actx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, when);

    const filter = this.actx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(850, when);
    filter.frequency.exponentialRampToValueAtTime(180, when + 0.15);

    const gain = this.actx.createGain();
    gain.gain.setValueAtTime(0.35, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(when);
    osc.stop(when + 0.20);
  }

  private playLeadNote(frequency: number, when: number): void {
    if (!this.actx || !this.masterGain) return;
    const osc = this.actx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(frequency, when);

    const filter = this.actx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, when);
    filter.Q.value = 2.0;

    const gain = this.actx.createGain();
    gain.gain.setValueAtTime(0.12, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(when);
    osc.stop(when + 0.28);
  }
}

export const musicSynthesizer = new MusicSynthesizer();
