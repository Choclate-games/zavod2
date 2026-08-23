# Ночной Синдикат: Дуэли и Контракты 🎮

> **Аркадная ночная гонка в духе классических NFS, где вы управляете заряженным японским спорткаром на трех контрастных трассах (Кольцо, Спринт, Дрифт-Трек), заряжаете закись азота управляемыми заносами и вырываете победу у агрессивных соперников на скоростях свыше 220 км/ч!**

---

## 🌟 Project Overview
- **Genre**: 3D Аркадный Автосимулятор (Уличные ночные гонки с физикой дрифта и нитро)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web)
- **Orientation**: Landscape
- **Target Audience**: Мужчины и женщины 12–35 лет, поклонники Need for Speed: Underground/Most Wanted, любители эффектных управляемых заносов, быстрых аркадных дуэлей и неоновой эстетики ночных мегаполисов.
- **Core Hook**: Выход из затяжной шпильки под 50 градусов в метре от бетонного отбойника с мгновенным подрывом бирюзового нитро, когда камера расширяет FOV до 85°, а соперник эффектно обходится по внутренней кромке в клубах подсвеченного неоном дыма!

---

## 📁 Package Directory Map
```text
workspace/sozday_gonku_v_stile_nfs_pust_budet_3_karty_kolt/
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

---

## 🕹️ Управление (Controls)

| Действие | Клавиатура (ПК) | Сенсорный экран (Смартфон) |
| :--- | :--- | :--- |
| **Руление (Влево / Вправо)** | `A` / `D` или `←` / `→` | Экранные кнопки `ВЛЕВО` / `ВПРАВО` |
| **Газ (Ускорение)** | `W` или `↑` | Кнопка `ГАЗ` (справа) |
| **Тормоз / Задний ход** | `S` или `↓` | Кнопка `ТОРМОЗ` |
| **Ручной тормоз (Срыв в занос)** | `Пробел` (`Space`) | Кнопка `ДРИФТ` |
| **Нитро-ускорение (Форсаж)** | `Shift` или `E` | Кнопка `НИТРО` |
| **Пауза** | `Escape` | Кнопка `ПАУЗА` (сверху справа) |

---

## 🚀 Команды для запуска и проверки

- **Запуск режима разработки**: `npm run dev`
- **Продакшн сборка**: `npm run build`
- **Предпросмотр сборки**: `npm run preview`
- **Статическая валидация спецификации**: `npm run check:spec` (`node scripts/check-spec.mjs`)
- **Дымовое тестирование в браузере**: `npm run smoke` (`node scripts/smoke.mjs`)

