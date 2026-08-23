# Сейсмо-Домино: Точечный Снос 🎮

> **«Сейсмо-Домино: Точечный Снос» — это тактическая 3D физическая головоломка, где игрок одним точным свайпом подсекает основание гигантского небоскреба, запуская разрушительную цепную реакцию домино по всему финансовому кварталу.**

---

## 🌟 Project Overview
- **Genre**: 3D Физическая Головоломка / Тактический Снос (Каскадный Снос / Симулятор Цепных Реакций)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web)
- **Orientation**: Landscape
- **Target Audience**: Игроки 12–45 лет, ценящие тактические физические головоломки, кинематографичные разрушения, физику цепных реакций (домино) и мгновенный медитативный вау-эффект без таймеров спешки.
- **Core Hook**: Ты делаешь один точный срез у основания 60-этажной башни, она медленно кренится на закатном солнце, со звоном сминает соседний небоскрёб, и за 6 секунд весь финансовый квартал складывается в идеальный каскад обломков без единого лишнего движения.

---

## 📁 Package Directory Map
```text
workspace/3d_fizicheskaya_igra_pro_razrushenie_zdaniy_s_vi/
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

## Запуск

```bash
npm install
npm run dev        # dev-сервер Vite, игра открывается в браузере
npm run build      # строгая сборка: tsc --noEmit + vite build → dist/
npm run preview    # предпросмотр собранной версии
```

Проверки приёмки:

```bash
npm run check:spec     # статическая часть приёмки (читает src/)
npm run check:physics  # ядро физики каскада в Node, без браузера
npm run smoke          # собирает, открывает игру в Chromium и трогает ввод
```

## Управление

Десктоп (клавиатура + мышь):

| Действие | Ввод |
|---|---|
| Прицел и вектор среза | ЛКМ на пилоне — протянуть — отпустить |
| Орбита камеры | ПКМ или Пробел + движение мыши; колесо — зум |
| Заряд задержки | ПКМ по колонне удалённого здания |
| Рестарт / ракурс / пауза | R / C / Esc или P |

Тач (телефон/планшет):

| Действие | Жест |
|---|---|
| Прицел и вектор среза | свайп поперёк колонны |
| Орбита и зум | два пальца |
| Заряд задержки | двойной тап по колонне |
| Рестарт / пауза / задержка | кнопки внизу экрана |

Схема выбирается автоматически (`bridge.device.type`); `?input=touch` и
`?input=desktop` принудительно включают раскладку для проверки на одной машине.

## Структура каталогов

```text
index.html                     # точка входа Vite
public/playgama-bridge-config.json  # конфиг моста площадки
src/
├── main.ts                    # бутстрап: мост, сейв, UI, игра
├── core/                      # GameLoop 60 Гц, EventBus, Game, баланс, уровни
├── platform/                  # PlaygamaService, StorageService
├── physics/                   # PhysicsWorld (Rapier3D)
├── systems/                   # срез, дуга прогноза, каскад, отложенный клин
├── entities/                  # Building, EntityManager
├── rendering/                 # SceneManager, CameraRig, модели, частицы, гизмо
├── audio/AudioManager.ts      # процедурный звук Web Audio
├── input/InputRouter.ts       # единственный слушатель сырого ввода
└── ui/                        # theme.css (токены), экраны, компоненты, тач-слой
scripts/
├── check-spec.mjs             # статическая приёмка
├── physics-check.mjs          # проверка физики в Node
├── smoke.mjs                  # дымовой запуск в браузере
└── fetch-knowledge.mjs        # загрузка базы знаний в docs/ref/
docs/ref/                      # база знаний фабрики (офлайн)
```

---

