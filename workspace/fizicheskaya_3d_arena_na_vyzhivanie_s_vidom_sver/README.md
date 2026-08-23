# Ледовый Сумо-Батл: Последний Тюбинг

> **Взрывной 3D физический батл-рояль на 8 участников: на реактивной надувной ватрушке выбивай соперников с раскалывающейся посреди океана льдины за 60 секунд чистого адреналина!**

---

## Запуск

```bash
npm install
npm run dev        # дев-сервер Vite, игра открывается в браузере
npm run build      # релизная сборка (tsc --noEmit + vite build) в dist/
npm run preview    # локальный просмотр собранной игры
```

Проверки приёмки:

```bash
npm run check:spec # статическая часть: исходники без заглушек, токены, шина, мост
npm run smoke      # собирает игру, открывает в Chromium, трогает ввод, проверяет телефон
```

## Управление

### Клавиатура и мышь (ПК)
- `W` / `S` или стрелки вверх/вниз — газ вперёд / тормоз-разворот
- `A` / `D` или стрелки влево/вправо — подруливание и занос (в заносе заряжается турбо)
- `Пробел` или `Shift` — реактивный форсаж (удержание)
- `Пробел` в момент контакта — ударная волна «идеального отскока»
- `P` / `Esc` — пауза

### Телефон и планшет
- Левая половина экрана — плавающий джойстик: отклонение задаёт тягу и угол заноса
- Кнопка **ТУРБО** справа внизу — форсаж (удержание), кольцо показывает заряд баллона
- Кнопка **ОТСКОК** над турбо — контр-ударная волна в момент столкновения
- Кнопка паузы справа сверху

Схема выбирается автоматически по типу устройства площадки; для отладки:
`?input=touch` или `?input=desktop` принудительно включают раскладку,
`?touch=1/0` — короткий алиас.

## Как играть
Оставайтесь последним тюбингом на льду. Разгоняйтесь, тараните соперников у кромки, следите за радаром: тонущие плиты подсвечены красным. За каждый фраг тюбинг тяжелеет и растёт — больше импульса, меньше поворотливости. Упали в воду — матч окончен (один раз за раунд можно вернуться за рекламу).

## Структура каталогов
```text
├── index.html                  # точка входа Vite
├── package.json                # скрипты dev/build/preview/check:spec/smoke
├── vite.config.ts              # конфигурация сборки
├── public/
│   └── playgama-bridge-config.json   # конфиг моста площадки
├── src/
│   ├── main.ts                 # bootstrap
│   ├── core/                   # Game, GameLoop (60 Гц), EventBus, Balance, InputRouter, Catalog
│   ├── platform/               # PlaygamaService (реклама, мост), StorageService (облачный сейв)
│   ├── physics/                # PhysicsWorld (Rapier3D, фиксированный шаг)
│   ├── entities/               # Tubing (контроллер ватрушки), EntityManager (пул из 8)
│   ├── systems/                # арена-раскол, кинетические тараны, боты, режиссёр матча
│   ├── rendering/              # SceneManager, ProceduralModels, ParticleSystem
│   ├── audio/                  # AudioManager (процедурный Web Audio)
│   └── ui/                     # theme.css (токены), экраны, HUD, TouchControls, i18n, иконки
├── scripts/                    # check-spec.mjs, smoke.mjs, fetch-knowledge.mjs
├── balance.yaml                # числа игры: код читает их отсюда
├── DESIGN.md                   # дизайн: палитра, камера, экраны, управление
├── ACCEPTANCE.md               # приёмка: пронумерованные проверки готовности
├── DEVLOG.md                   # журнал разработки
└── CHANGELOG.md                # история изменений глазами игрока
```

## Площадка
Игра интегрирована с Playgama Bridge v2 (`@playgama/bridge`): облачное сохранение (`player_trophies`), rewarded-реклама («Ледовое Спасение», утроение награды) только по факту просмотра, interstitial только между матчами с паузой 90 секунд, автопауза и глушение звука по событиям площадки. Игра запускается и локально — без моста всё работает на локальных умолчаниях.

---

---

## 📁 Package Directory Map
```text
workspace/fizicheskaya_3d_arena_na_vyzhivanie_s_vidom_sver/
├── AGENTS.md                        # Инструкция для ИИ-агента (пишет фабрика)
├── ACCEPTANCE.md                    # Приёмка: пронумерованные проверки готовности
├── AI_DEVELOPER_PROMPT.md           # Definitive master prompt for coding agent
├── balance.yaml                     # Числа игры: код читает их отсюда
├── scripts/check-spec.mjs           # Статическая часть приёмки, без зависимостей
├── scripts/smoke.mjs                # Сборка, запуск в браузере и проверка ввода
├── DEVLOG.md                        # Журнал разработки, ведёт кодовый агент
├── CHANGELOG.md                     # Changelog проекта, ведёт кодовый агент
├── GAME_DATA.yaml                   # Machine-readable game metadata
├── GAME_DESIGN_DOCUMENT.md          # Vision, player fantasy, game design
├── GAMEPLAY_SPECIFICATION.md        # Combat, movement, spawning formulas
├── TECHNICAL_SPECIFICATION.md       # TypeScript, Vite, physics, rendering
├── ARCHITECTURE_DOCUMENT.md         # Module hierarchy, system layer flow
├── PLAYGAMA_INTEGRATION.md          # Ads, Cloud Save, Leaderboards, SDK
├── MONETIZATION.md                  # Rewarded & Interstitial ad architecture
├── preview/
│   └── concept_preview.png          # Gameplay visual concept mockup
└── skills/
    ├── GAME_SKILL.md                # Game domain instructions
    ├── GAMEPLAY_SKILL.md            # Physics & combat coding rules
    ├── RENDERER_SKILL.md            # WebGL / Three.js performance guide
    ├── PLAYGAMA_SKILL.md            # Bridge SDK implementation guide
    └── CONTROLS_SKILL.md            # Тач- и десктоп-управление
```

---

## 🚀 How to Develop this Game
1. Open `AI_DEVELOPER_PROMPT.md`.
2. Feed the prompt into your AI coding assistant (Cursor / Antigravity / Claude).
3. Follow the 5-phase roadmap in `DEVELOPMENT_ROADMAP.md`.
4. Run `npm install && npm run dev` and check the game in the factory's built-in browser.
5. Keep `DEVLOG.md` and `CHANGELOG.md` updated after every work session.
6. Verify every deliverable against the **Definition of Done**.
