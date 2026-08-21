# Ночной Спринт: Трафик и Закись 🎮

> **«Ночной Спринт» — это скоростной 3D-рейсинг в духе NFS Underground для браузеров и мобильных: управляй спорткаром на мокром ночном шоссе, лавируй между фурами на волосок от столкновения для мгновенной зарядки нитро и ставь рекорды времени в плотных 90-секундных спринтах.**

---

## 🌟 Project Overview
- **Genre**: 3D Аркадный Автосимулятор / Уличные Гонки (Тайм-атака в плотном трафике / Хайвей-спринт с физикой заноса)
- **Renderer**: **THREE.js** + Rapier3D (`@dimforge/rapier3d-compat` ^0.20.0)
- **Platform**: Playgama Bridge v2 (Yandex Games / VK / Web / Mobile Webview)
- **Audio**: Web Audio API Procedural Synthesizers (Engine RPM, Turbo Spool, Blow-off, 140 BPM Phonk/Synthwave music)
- **Orientation**: Landscape
- **Target Audience**: Любители уличных гонок, плотного трафика, дрифта, ночной неоновой эстетики и динамичных спринт-заездов.

---

## 🏎️ Core Gameplay Mechanics
1. **Raycast Vehicle Physics**: 4 независимых колеса с упругостью подвески, поперечным демпфированием и расчётом заноса при скандинавском щелчке руля (Scandinavian Flick).
2. **Two-Stage Nitro Overdrive**: 1-я ступень (быстрое ускорение, FOV 80°) и 2-я ступень овердрайва (сверхзвуковой форсаж свыше 300 км/ч, FOV 92° и синее пламя).
3. **Adrenaline & Near Miss System**: Зарядка закиси азота и множитель очков x1.0–x5.0 за миллиметровые разъезды с трафиком и встречными авто.
4. **Slipstream Slingshot**: Прилипание к заднему борту 18-колёсных фур для набора давления и катапультирования на +35 км/ч.
5. **Checkpoint Time Trial**: Спринт по 12 трассам с ограниченным запасом времени (25 с на старте + 16–20 с за каждый чекпоинт) и медалями за время (Золото/Серебро/Бронза).

---

## 🛠️ Tech Stack & Architecture
- **Three.js** (WebGL2, PBR Wet Asphalt, ACESFilmic Tone Mapping, Dynamic Shadows, Chase Camera with Trauma Shake)
- **Rapier3D** (Deterministic 60Hz Physics, Collision Filtering Groups)
- **Playgama Bridge v2** (Cloud Save sync, Rewarded Video Revive, Interstitial Ads, Global Leaderboards)
- **Procedural Web Audio** (Subtractive 6-cylinder engine sound synthesis, turbo spool, blow-off valve, 140 BPM electronic sequencer)
- **TypeScript & Vite** (Strict type safety, zero dependencies bloat, instant HMR)

---

## 🚀 Commands

### Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
```

### Type Check
```bash
npx tsc --noEmit
```
