# Skill: Mobile Touch Brawler Controls & Ergonomics

## Purpose
Стандарт реализации отзывчивого сенсорного управления для браузерных экшенов от первого лица.

## When to Use
При разработке UI HUD и адаптации ввода под смартфоны и планшеты.

## Core Rules & Constraints
- Плавающий джойстик должен появляться в точке первого касания
- Кнопка пинка должна быть на 20% больше остальных
- Свайп обзора должен иметь динамическое сглаживание

## System Architecture
TouchInputManager -> VirtualJoystick -> ActionButtons -> TouchCameraLookController

## Implementation Guidance
Использование PointerEvents с pointerCapture для предотвращения залипания тачей при выходе за границу экрана.

## Common Mistakes to Avoid
- ❌ **Mistake**: Жесткая фиксация джойстика в левом углу
- ❌ **Mistake**: Конфликт свайпа камеры с системными жестами браузера (touch-action: none)

## Validation Checklist
- [ ] Установлен touch-action: none на canvas
- [ ] Протестировано мультитач-нажатие (бег + поворот + удар)
- [ ] Safe area учтена


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/knowledge/platforms/mobile_touch.md`
