# Skill: Game UI: Design System & Overlay Implementation

## Purpose
Задаёт визуальный контракт интерфейса: токены вместо литералов, один акцент на смысл, конечный набор компонентов, состояния экранов и слои над канвасом, которые не съедают игровой ввод.

## When to Use
Use when building any menu, HUD, modal, settings screen, shop, leaderboard panel or результат сессии — то есть всё, что игрок видит поверх канваса.

## Core Rules & Constraints
- Все значения — токенами в одном src/ui/theme.css; литерал цвета в экране запрещён.
- Слои над канвасом: контейнер pointer-events: none, auto — только у листьев.
- Слой HUD не кликается никогда; пауза и настройки — кнопки слоя экранов.
- Один акцент — один смысл, не больше двух акцентов на экране одновременно.
- Одна геометрия рамки на все кнопки, карточки и модалки.
- Две гарнитуры; меняющиеся числа — tabular-nums в слоте фиксированной ширины.
- Три зоны экрана и ровно одно главное действие на экран.
- У каждого экрана есть состояния загрузки, пустоты и ошибки.
- Возможность, которой нет на площадке, не рисуется вовсе — не серой кнопкой.
- Геометрия — от измеренного вьюпорта плюс safe-area и высота баннера, не от 100vh.
- Запрещены alert/confirm/prompt, эмодзи вместо иконок, голые input[type=range] и select.
- Анимируются только transform и opacity; переход укладывается в 300 мс.

## System Architecture
src/ui/: theme.css с токенами, UiRoot создаёт слои и меряет вьюпорт, ScreenRouter держит один видимый экран и общий переход, Hud пишет в закэшированные узлы, components/ — закрытый набор примитивов, screens/ — по файлу на экран, icons.ts — один инлайновый SVG-спрайт с currentColor.

## Implementation Guidance
Компонент — функция, которая строит элемент и возвращает небольшой handle с setLoading/setDisabled. Никакого фреймворка: реконсилятор и его бандл здесь ничего не покупают. Данные игрока (имена из таблицы лидеров, сохранения) идут только через textContent, никогда через innerHTML.

## Common Mistakes to Avoid
- ❌ **Mistake**: Полноэкранный оверлей на pointer-events: auto — на телефоне «не работает управление».
- ❌ **Mistake**: innerHTML в кадре и querySelector в цикле — просадка кадров на ровном месте.
- ❌ **Mistake**: width вместо transform: scaleX() у полосы — пересчёт раскладки всего слоя.
- ❌ **Mistake**: 100vh вместо измеренного вьюпорта — нижний ряд кнопок уезжает под хром браузера.
- ❌ **Mistake**: backdrop-filter: blur() на полноэкранном слое — дороже самой сцены на мобильном GPU.
- ❌ **Mistake**: Скрытый экран на opacity: 0 вместо display: none — его кнопки продолжают ловить нажатия.
- ❌ **Mistake**: Кнопка без состояния loading на рекламе или покупке — игрок нажмёт её ещё трижды.

## Validation Checklist
- [ ] Свайп по середине канваса ведёт игру, а не проваливается в оверлей.
- [ ] grep по литералам цвета в src/ui мимо theme.css пуст.
- [ ] Каждая видимая кнопка не меньше 64 px, основная — 96 px.
- [ ] Таблица лидеров показывает загрузку, пустоту и ошибку, а не пустую рамку.
- [ ] При выключенной на площадке возможности её элемента нет в DOM.
- [ ] Скриншоты 360x640 и 1280x720 без обрезанного текста и без скроллбара.
- [ ] С закрытым игровым полем меню узнаётся как эта конкретная игра.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/ux/ui_design_system.md` — Game UI Design System — How to give a browser game a UI that reads as one deliberate product rather than a pile of screens. The palettes and numbers below are one shipped example; what transfers is the **method**…
- `docs/ref/knowledge/ux/ui_implementation.md` — UI Implementation over a Three.js Canvas — The design system (`ui_design_system.md`) says what the interface must look like. This file is how it is built: the DOM layer stack over the canvas, the screen router, HUD…
