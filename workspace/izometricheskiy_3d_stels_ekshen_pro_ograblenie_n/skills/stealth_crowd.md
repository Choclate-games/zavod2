# Skill: Dynamic Crowd Stealth & Flocking

## Purpose
Алгоритмы маскировки в движущихся потоках NPC и расчет окклюзии конусов стражи

## When to Use
При разработке механики социального стелса и инстансирования толпы

## Core Rules & Constraints
- NPC не имеют тяжелых коллайдеров
- Вхождение в радиус группы танцоров снижает заметность до 0.1

## System Architecture
InstancedMesh + Spatial Hash Grid

## Implementation Guidance
Использовать Spatial Partitioning для быстрого поиска ближайших NPC вокруг вора

## Common Mistakes to Avoid
- ❌ **Mistake**: Создание отдельных Mesh для каждого жителя
- ❌ **Mistake**: Проверка лучей физическим Raycast на каждый кадр для всех NPC

## Validation Checklist
- [ ] Draw calls < 80
- [ ] Плавное вхождение в стелс-статус


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/knowledge/patterns/stealth_detection_cones.md`
