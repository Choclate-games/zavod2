# Skill: THREEJS WebGL Performance Guide

## Purpose
Optimization and visual standards for THREEJS WebGL pipeline.

## When to Use
Use when configuring scenes, cameras, lighting, materials, instanced meshes, and particle systems.

## Core Rules & Constraints
- Keep active draw calls strictly under 80.
- Use InstancedMesh for debris, bullets, and crowd mobs.
- Clamp pixel ratio to Math.min(window.devicePixelRatio, 1.5) on mobile.
- Share material instances across identical geometry.

## System Architecture
Scene graph with pre-allocated sprite and mesh pools, dynamic shadow frustum optimization.

## Implementation Guidance
Initialize renderer with antialias enabled on desktop, powerPreference 'high-performance'.

## Common Mistakes to Avoid
- ❌ **Mistake**: Do not construct new Geometries, Textures, or Materials in the render loop.
- ❌ **Mistake**: Do not leave unused GPU assets without calling .dispose().
- ❌ **Mistake**: Do not tune quality from raw frame time — under vsync every frame reads as budget-length.
- ❌ **Mistake**: Do not launch in reduced quality and climb up; start optimistic and step down.

## Validation Checklist
- [ ] Maintains solid 60 FPS on desktop and >= 50 FPS on mobile.
- [ ] No WebGL context loss errors on tab switches.
- [ ] Shadow map renders crisp without artifact acne.
- [ ] The quality auto-tuner converges and locks instead of oscillating.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/threejs/performance_guide.md` — Three.js Performance Guide for Web & Mobile — Use `THREE.InstancedMesh` for repeated objects (enemies, projectiles, debris chunks, pillars, grass blades).
- `docs/ref/knowledge/threejs/adaptive_quality.md` — Adaptive Quality That Actually Converges — The goal: auto-tune to the **richest quality the device sustains smoothly** — degrade under load and climb back up when there is headroom, converging without the player ever…
- `docs/ref/knowledge/threejs/procedural_mesh_builder.md` — Three.js: Procedural 3D Mesh Builder (Без внешних GLTF-файлов) — Коллекция чистых процедурных генераторов стилизованной Low-Poly 3D графики на Three.js. Позволяет создавать выразительных персонажей, машины, здания…
- `docs/ref/knowledge/threejs/physics_integration.md` — Three.js & Physics Engine Integration (Rapier3D / Cannon-es) — **Rapier3D (@dimforge/rapier3d-compat)**: WebAssembly-powered, deterministic, exceptionally fast with thousands of active rigidbodies, ideal for swarm…
- `docs/ref/knowledge/threejs/fps_controller_and_shooting.md` — Three.js: FPS-контроллер, оружие, вьюмодель и обратная связь выстрела — Что делает противник и как считается урон — `shooter_enemy_ai_and_combat.md`. Здесь — **всё, что находится под управлением игрока**: движение…
- `docs/ref/knowledge/threejs/shooter_enemy_ai_and_combat.md` — Стрелялка на Three.js: ИИ противника, укрытия, модель урона, орда — Контроллер игрока, выбор оружия, вьюмодель и эффекты выстрела — `fps_controller_and_shooting.md`. Здесь — вторая половина шутера: **что делает…
- `docs/ref/knowledge/threejs/procedural_character_rig.md` — Процедурный персонаж-человек на Three.js: риг, поза, износ, рэгдолл — `procedural_mesh_builder.md` отвечает на вопрос «как собрать модель из боксов». Этот файл — о том, **почему одна коробочная модель читается как…
- `docs/ref/knowledge/threejs/juice_and_vfx_pool.md` — Three.js: Juice, Instanced Particle VFX & Toon Shading — Рецепт оптимизированной системы частиц (`InstancedMesh` на 1000+ частиц за 1 Draw Call), шейка камеры и Toon (Cel) шейдинга.
- `docs/ref/knowledge/threejs/mobile_shaders.md` — Mobile Shaders & Material Optimization in Three.js — 1. **Prefer `MeshLambertMaterial` or `MeshPhongMaterial`** over complex `MeshPhysicalMaterial` for hordes of enemies. 2. **Avoid Heavy Post-Processing**:
- `docs/ref/knowledge/audio/procedural_sound_synthesizer.md` — Web Audio: Procedural Sound Synthesizer (Без MP3 файлов) — Полный модуль синтеза звуков на чистом Web Audio API. Не требует загрузки внешних аудиофайлов, работает мгновенно в любом браузере, поддерживает безопасное…
