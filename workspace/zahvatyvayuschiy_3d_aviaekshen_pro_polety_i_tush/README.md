# Огненный Каньон: Водный Сброс 🎮

> **Динамичный 3D авиаэкшен, в котором вы на пожарном гидроплане бреющим полетом черпаете воду из бурной реки на дне пылающего каньона, преодолеваете тяжесть набранных тонн и точным залпом гасите лесные пожары за 60 секунд!**

---

## 🌟 Project Overview
- **Genre**: 3D Авиаэкшен (Физический авиасимулятор тушения пожаров / Каньон-раннер с инерцией груза)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web & Mobile)
- **Orientation**: Landscape
- **Target Audience**: Мужчины и женщины 12–45 лет, любители авиаэкшенов, динамичных раннеров, симуляторов спасателей и зрелищных физических 3D-аркад
- **Core Hook**: Тяжелеющий от тонн воды штурвал, когда вы глиссируете в метре над бурлящей рекой, и мгновенный взмыв в небо при залповом сбросе лавины воды на бушующий пожар!

---

## 📁 Package Directory Map
```text
workspace/zahvatyvayuschiy_3d_aviaekshen_pro_polety_i_tush/
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

## ▶️ Запуск

```bash
npm install        # один раз
npm run dev        # dev-сервер Vite, открыть показанный адрес в браузере
npm run build      # проверка типов + сборка в dist/
npm run preview    # локальный просмотр собранной версии
npm run check:spec # статическая часть приёмки
npm run smoke      # сборка + автозапуск игры в браузере (десктоп и телефон)
```

Игра запускается и без площадки: мост Playgama работает через mock-платформу.

## 🎮 Управление

| Действие | Клавиатура + мышь | Телефон |
|---|---|---|
| Ведение самолёта | WASD / стрелки, мышь | свайп/удержание в левой половине экрана |
| Нос к воде (глиссирование) | W / стрелка вниз | палец вниз в зоне штурвала |
| Залповый сброс воды | Space / левый клик | кнопка СБРОС справа снизу |
| Паровой форсаж | Shift / двойной Space | кнопка ФОРСАЖ |
| Пауза | Esc / P | кнопка ПАУЗА сверху справа |

Схема управления выбирается по типу устройства площадки; `?input=touch` /
`?input=desktop` переключают принудительно.

## 📁 Структура исходников

```text
src/
├── main.ts              # Bootstrap: мост → сейв → сцена/UI → прогресс → game_ready
├── core/                # GameLoop 60 Гц, EventBus, Game, Balance, MissionLayout
├── platform/            # PlaygamaService, StorageService, типы Bridge API
├── rendering/           # SceneManager (сцена каньона), палитра из theme.css
├── input/               # InputHub — клавиатура/мышь
└── ui/                  # theme.css (токены), UiRoot, ScreenRouter, TouchControls,
    └── screens/         # Экраны: меню, HUD полёта, пауза
public/
├── playgama-bridge.js   # Vendored Bridge SDK v2 (официальный CDN-билд)
└── playgama-bridge-config.json
```

Полная карта пакета — ниже.
