# Changelog — Гангейм: Контейнерный Прорыв

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версии — по [SemVer](https://semver.org/lang/ru/).

## [Unreleased]

### Added
- Полная игровая архитектура на Vite + Three.js + TypeScript + Playgama Bridge.
- Физический мир `PhysicsWorld` с AABB коллизиями морских контейнеров, лучами проверки пола и климбингом (перелаз 2.60 м).
- Боевой подкат `SlideFpsMovementPhysicsSystem` (скорость 10.8 м/с, длительность 0.90 с, снижение высоты хитбокса до 0.90 м).
- Система прогрессии оружия `WeaponLadderProgressionSystem` с мгновенным морфингом за 0.08 с через 12 рангов (от P99 до РПГ-7).
- Процедурные 3D модели оружия и рук бойца `ProceduralModels` (12 типов стволов, целик, перчатки, вражеские солдаты).
- Система частиц `ParticleSystem` на `InstancedMesh` (вспышки выстрелов, искры подката, гильзы, брызги крови, взрывы).
- ИИ соперников `Enemy` и спавнер `EntityManager` (FSM состояния, реакция 0.25-0.45с, укрытия, слух на 20м, респаун за 1.0с).
- Киллстрик система БПЛА «Оверлорд» `KillstreakDroneRadarSystem` (вызов за 3 фрага, подсветка врагов через стены, сонар 320 Гц).
- Модуль звука `AudioManager` с процедурным Web Audio FM-синтезом всех выстрелов, хитмаркеров (880 Гц / 1320 Гц) и интерфейса.
- Двойная система ввода `InputManager` и `TouchControls` (клавиатура + мышь с захватом указателя, виртуальный плавающий джойстик, свайп подката).
- Интеграция с платформой `PlaygamaService` и `StorageService` (сохранения в облако, баннеры, интерстишл 90с, rewarded x2 награда).
- Тактический UI и дизайн-система `theme.css`, `Hud`, `ScreenRouter`, экраны `MainMenuScreen`, `PauseScreen`, `VictoryDefeatScreen`.

---