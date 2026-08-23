# Skill: Playgama Bridge Integration Skill

## Purpose
Обеспечение бесшовной интеграции с Playgama SDK для сохранения прогресса, монетизации и лидербордов.

## When to Use
При настройке платформенного слоя, сохранения оружия и показа рекламы между контрактами.

## Core Rules & Constraints
- Никогда не вызывать рекламу во время активного прицеливания игрока.
- Всегда обрабатывать ошибки инициализации SDK с бесшовным фоллбэком на LocalStorage.

## System Architecture
PlatformManager -> PlaygamaBridgeWrapper -> Storage & Ads Modules.

## Implementation Guidance
Инициализировать SDK до рендера 3D-сцены, синхронизировать кредиты после каждого успешного контракта.

## Common Mistakes to Avoid
- ❌ **Mistake**: Вызов рекламы без проверки cooldown
- ❌ **Mistake**: Блокировка UI при медленном ответе рекламного сервера

## Validation Checklist
- [ ] Проверены rewarded ads
- [ ] Проверено сохранение прогресса
- [ ] Проверена пауза звука


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/knowledge/platform/playgama.md`
