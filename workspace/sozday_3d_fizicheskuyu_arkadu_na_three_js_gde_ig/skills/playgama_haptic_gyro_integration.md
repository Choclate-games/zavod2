# Skill: Интеграция Playgama Bridge с тактильным управлением

## Purpose
Обеспечение кроссплатформенного управления, облачных сохранений и рекламных механик через Playgama SDK.

## When to Use
При интеграции с платформой Яндекс Игры / Playgama Bridge.

## Core Rules & Constraints
- Реклама никогда не должна прерывать активный перегон
- Сохранять рекордный баланс и открытые предметы в облако после каждого заезда
- Поддерживать и тач, и мышь, и клавиатуру без перезагрузки сцены

## System Architecture
PlatformBridge -> PlaygamaSDK -> StorageManager / AdsManager / InputRouter

## Implementation Guidance
Вызывать bridge.advertisement.showRewardedVideo() в отдельном модальном окне крушения с заморозкой игрового таймера.

## Common Mistakes to Avoid
- ❌ **Mistake**: Отсутствие обработки ошибки показа рекламы (ad block)
- ❌ **Mistake**: Попытка вызова рекламы без предварительной паузы аудио

## Validation Checklist
- [ ] SDK инициализирован
- [ ] Облачные сейвы синхронизируются
- [ ] Кулдаун межстраничной рекламы выдержан


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/knowledge/platform/playgama_bridge.md`
