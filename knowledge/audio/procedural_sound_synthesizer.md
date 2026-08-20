# Web Audio: Procedural Sound Synthesizer (Без MP3 файлов)

Полный модуль синтеза звуков на чистом Web Audio API. Не требует загрузки внешних аудиофайлов, работает мгновенно в любом браузере, поддерживает безопасное возобновление AudioContext после первого клика/тапа и корректное авто-приглушение при потере фокуса вкладки.

---

## 1. Модуль синтезатора (`SoundSynthesizer.ts`)

```typescript
export class SoundSynthesizer {
    private ctx: AudioContext | null = null;
    public isMuted = false;
    public masterVolume = 0.7;

    // Звук двигателя
    private engineOsc: OscillatorNode | null = null;
    private engineGain: GainNode | null = null;
    private engineFilter: BiquadFilterNode | null = null;

    constructor() {
        // Ленивая инициализация AudioContext по первому пользовательскому жесту
        const initAudio = () => {
            if (!this.ctx) {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                this.ctx = new AudioContextClass();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        };

        window.addEventListener('pointerdown', initAudio, { once: true });
        window.addEventListener('keydown', initAudio, { once: true });

        // Авто-приглушение при сворачивании вкладки (требование Яндекс / Playgama)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.ctx && this.ctx.state === 'running') {
                this.ctx.suspend();
            } else if (!document.hidden && this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        });
    }

    private ensureContext(): AudioContext | null {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.ctx = new AudioContextClass();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    // ────────────────────────────────────────── БОЕВЫЕ ЗВУКИ (ШУТТЕР / ЭКШЕН)

    /** Звук выстрела из огнестрельного оружия */
    public playGunshot(pitch = 1.0, power = 1.0) {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        // 1. Ударный низкочастотный «бум» (Pitch Drop Sine)
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240 * pitch, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

        oscGain.gain.setValueAtTime(0.8 * this.masterVolume * power, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);

        // 2. Вспышка белого шума (Crack)
        const bufferSize = ctx.sampleRate * 0.08;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800 * pitch, now);
        filter.Q.setValueAtTime(2.0, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.7 * this.masterVolume * power, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);
    }

    /** Звук взрыва (мощный низкий гул + длинный шум) */
    public playExplosion() {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const duration = 0.65;

        // Генерация шума взрыва
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + duration);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(1.0 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
    }

    /** Звук металлического удара / парирования клинков (Parry Clang) */
    public playParryClang() {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        [880, 1320, 1760, 2640].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 40, now);

            gain.gain.setValueAtTime(0.3 * this.masterVolume / (i + 1), now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.35);
        });
    }

    // ────────────────────────────────────────── ИНТЕРФЕЙС И НАГРАДЫ

    /** Звук сбора золотой монеты (арпеджио вверх) */
    public playCoinPickup() {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const notes = [987.77, 1318.51]; // B5 -> E6

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.06);

            gain.gain.setValueAtTime(0.28 * this.masterVolume, now + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.18);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.18);
        });
    }

    /** Звук клика по UI-кнопке */
    public playButtonClick() {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.04);

        gain.gain.setValueAtTime(0.2 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
    }

    // ────────────────────────────────────────── ДВИГАТЕЛЬ АВТОМОБИЛЯ (ГОНКИ)

    /** Старт постоянного звука двигателя */
    public startEngineSound() {
        if (this.engineOsc || this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        this.engineOsc = ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.setValueAtTime(45, ctx.currentTime);

        this.engineFilter = ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.setValueAtTime(160, ctx.currentTime);

        this.engineGain = ctx.createGain();
        this.engineGain.gain.setValueAtTime(0.22 * this.masterVolume, ctx.currentTime);

        this.engineOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(ctx.destination);

        this.engineOsc.start();
    }

    /** Модуляция звука мотора в зависимости от оборотов / скорости */
    public updateEngineRPM(speedRatio: number, throttle: number) {
        if (!this.engineOsc || !this.engineFilter || !this.ctx) return;

        // Базовая частота мотора: 45 Гц на холостых -> 260 Гц на отсечке
        const targetFreq = 45 + speedRatio * 180 + throttle * 40;
        this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);

        // Раскрытие фильтра при нажатии газа (рык)
        const filterFreq = 160 + speedRatio * 800 + throttle * 450;
        this.engineFilter.frequency.setTargetAtTime(filterFreq, this.ctx.currentTime, 0.05);
    }

    public stopEngineSound() {
        if (this.engineOsc) {
            try { this.engineOsc.stop(); } catch {}
            this.engineOsc.disconnect();
            this.engineOsc = null;
        }
    }
}
```
