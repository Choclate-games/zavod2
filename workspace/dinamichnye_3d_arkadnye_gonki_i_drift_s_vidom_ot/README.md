# Ледяной Экспресс: Жидкий Баланс 🎮

> **Удержи 15-тонный молоковоз в непрерывном заносе на зеркальном льду горного серпантина: используй волну молока в цистерне как стабилизатор в шпильках, балансируй на двух колесах над пропастью и доставь молоко в целости за 70 секунд!**

---

## 🌟 Project Overview
- **Genre**: 3D Аркадный Автосимулятор (Физический Дрифт-Спуск / Горный Тайм-Аттак Тяжеловоза)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web / Mobile)
- **Orientation**: Landscape
- **Target Audience**: Игроки 14–35 лет, поклонники физических автосимуляторов, дрифта и напряженных скоростных испытаний (Time Attack), ценящие сочный геймфил, честную физику тяжелой техники и короткие адреналиновые сессии по 1–2 минуты на смартфонах и ПК.
- **Core Hook**: Момент, когда на скорости 90 км/ч в заносе над километровым обрывом ты видишь, как 8 тонн молока внутри хромированной цистерны с грохотом бьют в противоположный борт, кабина отрывает два колеса от зеркального синего льда, и ты резким контррулением в миллиметре от бездны ловишь горизонт и выстреливаешь из шпильки.

---

## 📁 Package Directory Map
```text
workspace/dinamichnye_3d_arkadnye_gonki_i_drift_s_vidom_ot/
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
