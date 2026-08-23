# Skill: Контроллер Жеста Подсечки (Drag-to-Cut Controller)

## Purpose
Стандарт реализации интуитивного сенсорного и мышиного управления срезом опорных узлов.

## When to Use
При программировании пользовательского ввода, гизмо прицеливания и предпросмотра траектории.

## Core Rules & Constraints
- Отзывчивость в первый же кадр
- Плавное сглаживание вектора протяжки
- Наличие тактильного виброотклика

## System Architecture
State Machine жеста: Hover -> PointerDown -> Dragging -> Release -> Execute

## Implementation Guidance
Проецировать экранный луч (Raycast) на плоскость опорной колонны для вычисления 3D-точки реза

## Common Mistakes to Avoid
- ❌ **Mistake**: Слишком чувствительный порог срабатывания
- ❌ **Mistake**: Конфликт между жестом среза и вращением камеры

## Validation Checklist
- [ ] Работает ли жест одной рукой?
- [ ] Есть ли deadzone 10px?
- [ ] Отображается ли дуга падения?


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/ux/mobile_touch_feel.md`
- `docs/ref/knowledge/patterns/physics_arcade_loop.md` — Pattern: Physics Arcade Loop — Pattern Name: Physics Arcade Loop Primary Genre: Physics Destruction / Slingshot / Ragdoll Arcade
