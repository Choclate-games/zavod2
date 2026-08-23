# Skill: Rhythm Synced Parry & Ragdoll

## Purpose
Синхронизация окон парирования с Web Audio битом и расчет физического импульса рэгдолла

## When to Use
При разработке боевой системы ближнего боя и реакции врагов

## Core Rules & Constraints
- Окно парирования привязано к Web Audio time
- Удар на сильную долю дает х1.5 импульс сброса

## System Architecture
State Pattern + Rapier3D Impulses

## Implementation Guidance
Слушать Web Audio clock и сверять дельту нажатия игрока с ближайшим BeatTime

## Common Mistakes to Avoid
- ❌ **Mistake**: Использование setTimeout для таймингов ритма
- ❌ **Mistake**: Отсутствие буфера ввода для мобильных тапов

## Validation Checklist
- [ ] Hit-stop 150ms работает
- [ ] Враг корректно падает с платформы в толпу


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/knowledge/patterns/rhythm_action_sync.md`
