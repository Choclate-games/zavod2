# Слияние Турелей 3D: Оборона Базы

Портретная HTML5/WebGL игра на Vite, TypeScript, Three.js, Rapier3D и Playgama Bridge. Внизу игрок покупает и объединяет турели на сетке 4x4, сверху турели автоматически защищают базу от волн цветных сфер.

## Запуск

```bash
npm install
npm run dev
```

Production-сборка:

```bash
npm run build
npm run preview
```

Обязательные npm-скрипты `dev`, `build` и `preview` находятся в `package.json`.

## Управление

Мышь и клавиатура:
- ЛКМ по сфере в верхней части экрана - выбрать приоритетную цель.
- Перетащить турель на пустой слот - переместить.
- Перетащить турель на такую же - объединить до следующего тира.
- Перетащить на другой тир - поменять местами.
- ПКМ по слоту - продать турель за часть стоимости.
- `P` / `Esc` - пауза.

Телефон:
- Управление построено на Pointer Events.
- Одним пальцем можно выбирать цели и перетаскивать турели.
- UI учитывает safe-area через `env(safe-area-inset-*)`.
- `?touch=1` принудительно показывает мобильный слой на десктопе, `?touch=0` выключает его.

## Структура

```text
src/
├── main.ts
├── core/          # Game, EventBus, fixed 60Hz GameLoop
├── game/          # Типы и балансные формулы
├── platform/      # Playgama Bridge, сохранения, viewport guards
├── physics/       # Rapier3D world
├── rendering/     # Three.js сцена и instanced pools
├── systems/       # Merge grid, combat, waves
├── ui/            # DOM HUD, drag-and-drop, touch controls
└── audio/         # Web Audio manager
```

## Реализовано

- Сетка 4x4 с покупкой, перемещением, swap и merge турелей до 15 тира.
- Изометрическая Three.js арена с процедурными турелями, дорожкой и instanced-сферами.
- Волны врагов с ростом HP, боссовыми крупными сферами, уроном базе и revive.
- Автострельба турелей, критический урон, снаряды из пула и выбор цели тапом.
- Экономика монет, апгрейды урона/дохода, оффлайн-доход до 8 часов.
- Playgama Bridge wrapper: init timeout, single `game_ready`, lifecycle, rewarded, banners, cloud save.
- Сохранение одним JSON-ключом `turrets_grid_slots` с localStorage-зеркалом и нормализацией битых данных.
