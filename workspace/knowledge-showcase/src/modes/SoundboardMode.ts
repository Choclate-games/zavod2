import { AudioManager } from '../audio/AudioManager';

export class SoundboardMode {
  private analyserCanvas: HTMLCanvasElement | null = null;
  private analyserCtx: CanvasRenderingContext2D | null = null;
  private dataArray: Uint8Array | null = null;

  // Rhythm Metronome Game
  public bpm = 120;
  public rhythmTimer = 0;
  public rhythmScore = 0;
  public isRhythmActive = false;
  public beatWindowActive = false;

  constructor(private audio: AudioManager) {}

  public initialize(canvasId: string): void {
    this.analyserCanvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (this.analyserCanvas) {
      this.analyserCtx = this.analyserCanvas.getContext('2d');
    }
  }

  public playSound(soundKey: string): void {
    switch (soundKey) {
      case 'gunshot':
        this.audio.playGunshot();
        break;
      case 'explosion':
        this.audio.playExplosion();
        break;
      case 'parry':
        this.audio.playParryClang();
        break;
      case 'slash':
        this.audio.playSwordSlash();
        break;
      case 'kick':
        this.audio.playSpartanKick();
        break;
      case 'coin':
        this.audio.playCoinPickup();
        break;
      case 'click':
        this.audio.playButtonClick();
        break;
      case 'drift':
        this.audio.playDriftScreech();
        break;
      case 'dash':
        this.audio.playDash();
        break;
      case 'laser':
        this.audio.playLaser();
        break;
      case 'levelup':
        this.audio.playLevelUp();
        break;
      case 'alarm':
        this.audio.playAlarm();
        break;
    }
  }

  public updateEngineRPM(rpmSliderValue: number): void {
    // rpmSliderValue 0..1
    this.audio.updateEngineRPM(rpmSliderValue, rpmSliderValue);
  }

  public triggerRhythmHit(): void {
    if (this.beatWindowActive) {
      this.rhythmScore += 100;
      this.audio.playCoinPickup();
      const feedback = document.getElementById('rhythm-feedback');
      if (feedback) {
        feedback.textContent = '🌟 PERFECT HIT! +100';
        feedback.style.color = '#2ecc71';
      }
    } else {
      this.rhythmScore = Math.max(0, this.rhythmScore - 20);
      this.audio.playButtonClick();
      const feedback = document.getElementById('rhythm-feedback');
      if (feedback) {
        feedback.textContent = '❌ MISS';
        feedback.style.color = '#e74c3c';
      }
    }
    const scoreEl = document.getElementById('rhythm-score');
    if (scoreEl) scoreEl.textContent = this.rhythmScore.toString();
  }

  public updateAndRender(dt: number): void {
    // 1. Rhythm Metronome Timer
    const beatInterval = 60 / this.bpm;
    this.rhythmTimer += dt;

    if (this.rhythmTimer >= beatInterval) {
      this.rhythmTimer = 0;
      this.beatWindowActive = true;
      this.audio.playRhythmBeat(true);

      const indicator = document.getElementById('rhythm-indicator');
      if (indicator) {
        indicator.classList.add('pulse');
        setTimeout(() => indicator.classList.remove('pulse'), 120);
      }

      setTimeout(() => {
        this.beatWindowActive = false;
      }, 140);
    }

    // 2. Render Oscilloscope & Frequency Spectrum
    if (!this.analyserCanvas || !this.analyserCtx) return;
    const analyser = this.audio.getAnalyser();
    if (!analyser) return;

    if (!this.dataArray) {
      this.dataArray = new Uint8Array(analyser.frequencyBinCount);
    }

    const w = this.analyserCanvas.width;
    const h = this.analyserCanvas.height;
    const ctx = this.analyserCtx;

    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, w, h);

    // Draw Frequency Bars
    analyser.getByteFrequencyData(this.dataArray);
    const barWidth = (w / this.dataArray.length) * 2.5;
    let x = 0;

    for (let i = 0; i < this.dataArray.length; i++) {
      const barHeight = (this.dataArray[i] / 255) * h * 0.7;
      ctx.fillStyle = `hsl(${200 + i * 2}, 90%, 55%)`;
      ctx.fillRect(x, h - barHeight, barWidth, barHeight);
      x += barWidth + 1;
      if (x > w) break;
    }

    // Draw Waveform Oscilloscope Line
    analyser.getByteTimeDomainData(this.dataArray);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#00cec9';
    ctx.beginPath();

    const sliceWidth = w / this.dataArray.length;
    let waveX = 0;

    for (let i = 0; i < this.dataArray.length; i++) {
      const v = this.dataArray[i] / 128.0;
      const waveY = (v * h) / 2;

      if (i === 0) ctx.moveTo(waveX, waveY);
      else ctx.lineTo(waveX, waveY);

      waveX += sliceWidth;
    }

    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }
}
