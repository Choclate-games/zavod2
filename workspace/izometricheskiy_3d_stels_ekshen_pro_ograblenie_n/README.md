# Тени Фестиваля: Клинок и Эшелон 🎮

> **Тени Фестиваля: Клинок и Эшелон — это изометрический 3D ритм-стелс слэшер, в котором вор-фехтовальщик грабит механизированную карнавальную процессию, парирует удары стражи на движущихся платформах и скрывается в танцующей толпе под бой праздничных барабанов.**

---

## 🌟 Project Overview
- **Genre**: Изометрический 3D Стелс-Экшен (Ритмический слэшер с механикой маскировки в толпе)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web / Mobile)
- **Orientation**: Landscape
- **Target Audience**: Игроки 16–35 лет, ценящие стильные изометрические экшены, динамичный стелс, тайминги парирования и ритм-игры в духе Hi-Fi Rush, Hotline Miami и Shadow Tactics.
- **Core Hook**: Момент, когда на пике музыкального дропа ты парируешь алебарду элитного стража прямо на крыше медного левиафана и с разворота выбиваешь его пинком в танцующую толпу внизу под взрыв золотых конфетти.

---

## 📁 Package Directory Map
```text
workspace/izometricheskiy_3d_stels_ekshen_pro_ograblenie_n/
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

---

## Запуск и проверка

```bash
npm install        # один раз
npm run dev        # игра на http://localhost:5173
npm run build      # релизная сборка в dist/ (tsc + vite)
npm run preview    # предпросмотр собранной игры
npm run check:spec # статическая приёмка (node scripts/check-spec.mjs)
npm run smoke      # сборка + запуск в браузере + ввод (node scripts/smoke.mjs)
```

Игра работает и без площадки: Playgama Bridge подключается динамически, при его
отсутствии включается локальный мок (сохранение — localStorage, rewarded — имитация).

## Управление

Десктоп (клавиатура + мышь):
- **WASD / стрелки** — движение; **Space** (удержание) — шаг шествия (маскировка);
  **Space** рядом с оглушённым стражем — пинок.
- **ЛКМ** — ритмический выпад рапирой (в сторону курсора); **ПКМ** — парирование;
- **Shift** — таранный рывок с тотемом; **E / Q** — хлопушка в точку курсора / под себя;
- **Esc** — пауза.

Телефон (тач): виртуальный джойстик слева, зона «Шаг шествия» над ним,
кнопки справа — выпад, парирование, пинок, рывок, хлопушка; пауза — кнопкой сверху.

Принудительный выбор схемы: `?input=touch`, `?input=desktop`, `?touch=1` в адресе страницы.

## Структура каталогов

```text
├── index.html                  # страница игры и заставка загрузки
├── public/
│   └── playgama-bridge-config.json
├── src/
│   ├── main.ts                 # сборка приложения: площадка → рендер → UI → цикл
│   ├── config/balance.ts       # чтение чисел из balance.yaml
│   ├── core/                   # шина событий, цикл с фиксированным шагом
│   ├── platform/               # Playgama Bridge + сервис сохранения
│   ├── audio/audio.ts          # Web Audio синтез, мастер-гейн, ритм-трек
│   ├── render/                 # рендерер, мир, VFX-пул, утилиты мешей
│   ├── game/                   # сессия ограбления, вор, стража, танцоры
│   ├── input/                  # клавиатура+мышь и тач-слой
│   └── ui/                     # theme.css, локализация, роутер, экраны
└── scripts/                    # check-spec.mjs, smoke.mjs, fetch-knowledge.mjs
```
