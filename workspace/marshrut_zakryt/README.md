# Курьерский прорыв 🎮

> **Вид от первого лица, автоматическая очередь и свайп на перекрёстке: ночной курьер пробивается через четыре волны преследователей, но после каждой волны орда закрывает самый часто использованный путь, заставляя доставлять пакет через всё более хитрый город.**

---

## 🌟 Project Overview
- **Genre**: 3D экшен-выживание против орды от первого лица (Маршрутный FPS с автоматической очередью и адаптивным перекрытием улиц)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge, Yandex Games, VK и мобильный веб
- **Orientation**: Landscape
- **Target Audience**: Игроки 12+, которым нравятся короткие напряжённые шутерные сессии, чтение пространства и управление без виртуального джойстика.
- **Core Hook**: Игрок замечает, что орда действительно выучила его круг: после волны знакомый переулок закрывается чёрной массой, и под автоматической очередью ему приходится на ходу выбрать новый освещённый путь к адресу.

---

## 📁 Package Directory Map
```text
workspace/marshrut_zakryt/
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

## Запуск

```bash
npm install
npm run dev        # dev-сервер Vite
npm run build      # проверка типов + сборка в dist/
npm run preview    # просмотр собранной версии
```

Проверки приёмки:

```bash
npm run check:spec   # статическая часть приёмки
npm run smoke        # сборка, запуск в браузере, ввод, телефон
npm run gen:balance  # регенерация src/generated/balanceValues.ts из balance.yaml
```

## Управление

| Действие | Клавиатура + мышь | Тач |
|---|---|---|
| Движение | WASD | вести палец в нижней половине экрана |
| Прицел | мышь | палец по экрану |
| Автоматическая очередь | удерживать ЛКМ | второй палец |
| Выбор улицы на перекрёстке | A / D / W | свайп (появится в фазе 4) |

Схема выбирается автоматически от площадки; `?input=touch` и `?input=desktop`
принудительно включают раскладку для проверки на одной машине.

## Структура каталогов

```text
src/
├── main.ts                 # Bootstrap: мост → вехи загрузки → движок → game_ready
├── core/                   # EventBus, GameLoop (60 Гц фикс. шаг), Game (состояния)
├── platform/               # PlaygamaService, StorageService — единственные точки моста
├── input/                  # InputRouter: обе схемы управления, режим от площадки
├── rendering/              # SceneManager: мокрый перекрёсток, дождь, свет
├── generated/              # balanceValues.ts — автогенерация из balance.yaml
└── ui/                     # theme.css (все значения), UiRoot, экраны, HUD
```

