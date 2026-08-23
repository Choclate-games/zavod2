# Skill: Pointer & Touch Slingshot Gesture Controller

## Purpose
Паттерн бескнопочного управления жестами захвата, ведения и катапультного броска на тачскринах и мыши.

## When to Use
При разработке отзывчивого управления персонажами без экранных джойстиков.

## Core Rules & Constraints
- Не использовать экранные джойстики
- Сглаживать дельту свайпа через экспоненциальное скользящее среднее (EMA)
- Ограничивать максимальную силу броска для сохранения контроля

## System Architecture
Three.js Raycaster проецирует лучи на виртуальную плоскость Y=0, вычисляя мировые координаты курсора.

## Implementation Guidance
Отрисовывать визуальный луч траектории броска через динамический Line2 меш со светящимся материалом.

## Common Mistakes to Avoid
- ❌ **Mistake**: Блокировка контекстного меню на десктопе без preventDefault()
- ❌ **Mistake**: Задержка реакции из-за ожидания mouseup

## Validation Checklist
- [ ] TouchAction: none установлен на canvas
- [ ] Указатель освобождается при выходе за пределы экрана


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/patterns/arena_combat_loop.md` — Pattern: Arena Combat Loop — Pattern Name: Arena Combat Loop Primary Genre: Action Combat / Gladiator / Brawler
- `docs/ref/knowledge/gamefeel/screen_shake.md`
