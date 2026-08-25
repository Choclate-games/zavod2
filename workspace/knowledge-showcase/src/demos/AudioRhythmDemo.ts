import * as THREE from 'three';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import {
  GOOD_WINDOW,
  PERFECT_WINDOW,
  computeBeat,
  evaluateRhythmHit,
  type HitRating,
} from '../game/rhythmAudio';

export class AudioRhythmDemo implements Demo {
  readonly id = 'audiorhythm';
  readonly title = ['🔊 Синтез звука и ритм', '🔊 Procedural Audio & Beat Sync'] as const;
  readonly hint = [
    '<b>Space / ЛКМ</b> попадать в ритм на кольце · <b>1..8</b> саундборд синтезатора (выстрел, взрыв, парирование, монета, мотор…)'
    + ' · <b>M</b> mute · <b>R</b> сброс комбо<br>Чистый Web Audio без аудиофайлов: аппаратный тайминг, спектр частот, окна точности PERFECT/GOOD.',
    '<b>Space / LMB</b> hit beat on pulse ring · <b>1..8</b> synthesizer soundboard (gunshot, explosion, parry, coin, engine…)'
    + ' · <b>M</b> mute · <b>R</b> reset combo<br>Zero audio files Web Audio: hardware timing, FFT frequency bars, PERFECT/GOOD accuracy.',
  ] as const;
  readonly category = ['🎵 Аудио и ритм', '🎵 Audio & Rhythm'] as const;
  readonly tags = ['звук', 'web-audio', 'синтез', 'ритм', 'bpm', 'эквалайзер', 'audio', 'sound', 'rhythm', 'beat', 'synth'] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.5, 100);

  private ctx!: DemoContext;
  private bpm = 120;
  private startTime = 0;
  private lastBeatIdx = -1;

  // Rhythm Game State
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private lastRating: HitRating | null = null;
  private lastDeltaMs = 0;

  // 3D Visual Elements
  private beatRingMesh!: THREE.Mesh;
  private targetRingMesh!: THREE.Mesh;
  private ratingTextRing!: THREE.Mesh;
  private equalizerBars: THREE.Mesh[] = [];
  private readonly barCount = 24;
  private freqData = new Uint8Array(128);

  private isEngineRunning = false;
  private unsubscribeKey: (() => void) | null = null;

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.scene.background = new THREE.Color(0x0c0d18);
    this.scene.fog = new THREE.FogExp2(0x0c0d18, 0.02);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 0.8);
    dirLight.position.set(10, 20, 10);
    this.scene.add(dirLight);

    this.scene.add(new THREE.AmbientLight(0x334466, 0.6));

    this.buildEqualizer();
    this.buildRhythmRings();

    this.camera.position.set(0, 7.5, 14);
    this.camera.lookAt(0, 1.5, 0);

    this.startTime = performance.now() / 1000.0;
  }

  enter(): void {
    this.startTime = performance.now() / 1000.0;
    this.lastBeatIdx = -1;

    this.unsubscribeKey = this.ctx.input.onKey((code) => {
      if (code === 'Space') {
        this.triggerHit();
      } else if (code === 'Digit1') {
        this.ctx.audio.playGunshot(1.0, 1.0);
      } else if (code === 'Digit2') {
        this.ctx.audio.playExplosion(1.0);
        this.ctx.addTrauma(0.4);
      } else if (code === 'Digit3') {
        this.ctx.audio.playParryClang();
      } else if (code === 'Digit4') {
        this.ctx.audio.playCoinPickup();
      } else if (code === 'Digit5') {
        this.ctx.audio.playSpartanKick();
        this.ctx.addTrauma(0.2);
      } else if (code === 'Digit6') {
        this.ctx.audio.playAlarm();
      } else if (code === 'Digit7') {
        if (this.isEngineRunning) {
          this.ctx.audio.stopEngine();
          this.isEngineRunning = false;
        } else {
          this.ctx.audio.startEngine();
          this.isEngineRunning = true;
        }
      } else if (code === 'Digit8') {
        this.ctx.audio.playLevelUp();
      } else if (code === 'KeyR') {
        this.score = 0;
        this.combo = 0;
        this.lastRating = null;
      }
    });
  }

  exit(): void {
    if (this.isEngineRunning) {
      this.ctx.audio.stopEngine();
      this.isEngineRunning = false;
    }
    this.unsubscribeKey?.();
    this.unsubscribeKey = null;
  }

  fixedUpdate(dt: number): void {
    const elapsed = performance.now() / 1000.0 - this.startTime;
    const currentBeat = computeBeat(elapsed, this.bpm);
    const beatIdx = Math.floor(currentBeat);

    // Play metronome click on each whole beat
    if (beatIdx > this.lastBeatIdx) {
      this.lastBeatIdx = beatIdx;
      const isAccent = beatIdx % 4 === 0;
      this.ctx.audio.playRhythmBeat(isAccent);
    }

    // Pointer down can trigger rhythm hit
    const primary = this.ctx.input.primary;
    if (primary && primary.down) {
      this.triggerHit();
    }

    if (this.isEngineRunning) {
      const speedRatio = 0.5 + Math.sin(elapsed * 1.5) * 0.5;
      this.ctx.audio.updateEngineRPM(speedRatio, 0.8);
    }

    this.pushStatus();
  }

  update(dt: number): void {
    const elapsed = performance.now() / 1000.0 - this.startTime;
    const beatInterval = 60.0 / this.bpm;
    const beatFraction = (elapsed % beatInterval) / beatInterval;

    // Expanding pulse ring (approaches radius 3.0 at beatFraction = 1.0)
    const scale = 0.5 + (1.0 - beatFraction) * 2.0;
    this.beatRingMesh.scale.set(scale, scale, 1);
    const ringMat = this.beatRingMesh.material as THREE.MeshBasicMaterial;
    ringMat.opacity = Math.max(0.1, 1.0 - beatFraction * 0.7);

    // Target ring subtle pulse
    const targetScale = 1.0 + Math.sin(beatFraction * Math.PI) * 0.08;
    this.targetRingMesh.scale.set(targetScale, targetScale, 1);

    // Frequency Spectrum Equalizer from AudioContext AnalyserNode
    const analyser = this.ctx.audio.getAnalyser();
    if (analyser) {
      analyser.getByteFrequencyData(this.freqData);

      for (let i = 0; i < this.barCount; i++) {
        const bar = this.equalizerBars[i];
        const val = this.freqData[i * 2] || 0; // 0..255
        const targetH = Math.max(0.1, (val / 255.0) * 4.5);
        bar.scale.y += (targetH - bar.scale.y) * Math.min(1.0, dt * 15.0);
        bar.position.y = bar.scale.y / 2;

        const hue = (i / this.barCount) * 0.7;
        const color = new THREE.Color().setHSL(hue, 0.9, 0.5);
        (bar.material as THREE.MeshStandardMaterial).color.copy(color);
      }
    }
  }

  dispose(): void {
    if (this.isEngineRunning) {
      this.ctx.audio.stopEngine();
    }
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  private buildEqualizer(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 20),
      new THREE.MeshStandardMaterial({ color: 0x141824, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const barGeo = new THREE.BoxGeometry(0.35, 1.0, 0.35);
    const startX = -((this.barCount - 1) * 0.5) / 2;

    for (let i = 0; i < this.barCount; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x00f5d4,
        emissive: 0x003322,
        roughness: 0.3,
      });
      const bar = new THREE.Mesh(barGeo, mat);
      bar.position.set(startX + i * 0.5, 0.5, -4);
      this.scene.add(bar);
      this.equalizerBars.push(bar);
    }
  }

  private buildRhythmRings(): void {
    // Target ring (where beats hit)
    const targetGeo = new THREE.RingGeometry(2.4, 2.6, 32);
    const targetMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4, side: THREE.DoubleSide });
    this.targetRingMesh = new THREE.Mesh(targetGeo, targetMat);
    this.targetRingMesh.position.set(0, 2.6, 0);
    this.scene.add(this.targetRingMesh);

    // Incoming pulse ring
    const beatGeo = new THREE.RingGeometry(2.4, 2.6, 32);
    const beatMat = new THREE.MeshBasicMaterial({
      color: 0xf1c40f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    this.beatRingMesh = new THREE.Mesh(beatGeo, beatMat);
    this.beatRingMesh.position.set(0, 2.6, 0.02);
    this.scene.add(this.beatRingMesh);

    // Hit rating indicator halo
    const ratingGeo = new THREE.RingGeometry(2.0, 2.2, 32);
    const ratingMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71, side: THREE.DoubleSide, transparent: true, opacity: 0.0 });
    this.ratingTextRing = new THREE.Mesh(ratingGeo, ratingMat);
    this.ratingTextRing.position.set(0, 2.6, 0.04);
    this.scene.add(this.ratingTextRing);
  }

  private triggerHit(): void {
    const elapsed = performance.now() / 1000.0 - this.startTime;
    const res = evaluateRhythmHit(elapsed, this.bpm, this.combo);

    this.lastRating = res.rating;
    this.lastDeltaMs = Math.round(res.deltaSeconds * 1000);
    this.combo = res.combo;
    this.score += res.score;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    const ratingMat = this.ratingTextRing.material as THREE.MeshBasicMaterial;

    if (res.rating === 'PERFECT') {
      ratingMat.color.setHex(0x2ecc71); // bright green
      ratingMat.opacity = 0.9;
      this.ctx.audio.playCoinPickup();
      this.ctx.addTrauma(0.1);
    } else if (res.rating === 'GOOD') {
      ratingMat.color.setHex(0xf1c40f); // yellow
      ratingMat.opacity = 0.7;
      this.ctx.audio.playButtonClick();
    } else {
      ratingMat.color.setHex(0xe74c3c); // red miss
      ratingMat.opacity = 0.8;
      this.ctx.audio.playSpartanKick();
    }
  }

  private pushStatus(): void {
    let ratingHtml = '<span style="color:#7f8c8d">—</span>';
    if (this.lastRating === 'PERFECT') {
      ratingHtml = `<span style="color:#2ecc71;font-weight:bold">★ PERFECT (Δ ${this.lastDeltaMs} мс)</span>`;
    } else if (this.lastRating === 'GOOD') {
      ratingHtml = `<span style="color:#f1c40f;font-weight:bold">✓ GOOD (Δ ${this.lastDeltaMs} мс)</span>`;
    } else if (this.lastRating === 'MISS') {
      ratingHtml = `<span style="color:#e74c3c;font-weight:bold">✗ MISS (Δ ${this.lastDeltaMs} мс)</span>`;
    }

    const mult = this.combo >= 50 ? '3.0x' : this.combo >= 25 ? '2.0x' : this.combo >= 10 ? '1.5x' : '1.0x';

    this.ctx.setStatus(
      `Темп: <b>${this.bpm} BPM</b> · Очки: <b>${this.score}</b> · Комбо: <b>${this.combo}</b> (макс: ${this.maxCombo}, множитель ${mult})`
      + ` · Оценка: ${ratingHtml} · Саундборд: <b>1..8</b> · MP3 файлов: <b>0</b>`,
    );
  }
}
