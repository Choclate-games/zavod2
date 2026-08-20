# Skill: Multi-Step Culinary Flow & Heat Control

## Purpose
Реализация кулинарного пайплайна: машина состояний продуктов, контроль жара и очередь заказов.

## When to Use
При программировании разделочных столов, жарки в воке, сборки блюд и таймеров терпения клиентов.

## Core Rules & Constraints
- Каждый ингредиент имеет четкие состояния: RAW -> PREPPED -> COOKED -> BURNT.
- Таймер терпения заказа визуализируется плавным круговым индикатором со сменой цвета.
- Сдача заказа в зеленой зоне дает множитель комбо чаевых.

## System Architecture
OrderManager распределяет билеты заказов, CookingStation обрабатывает таймеры жарки.

## Implementation Guidance
Используй Web Audio сэмплы шипящего масла и стука ножа для сочного ASMR-отклика.

## Common Mistakes to Avoid
- ❌ **Mistake**: Блокировка действий игрока во время анимации жарки.

## Validation Checklist
- [ ] Блюда сгорают только при превышении лимита передержки с предупреждающим дымом.


## Reference Knowledge (verbatim, authoritative)
Sourced from the factory knowledge base — these rules override any conflicting example, including snippets from the platform docs that describe the deprecated Bridge v1 contract.

- `knowledge/mechanics/cooking_flow.md`

### Механика: Кулинарный тайм-менеджмент и комбо (Cooking & Order Flow)

#### 1. Машина состояний ингредиентов
1. **Жизненный цикл продукта**:
   `RAW` (Сырой) -> [Нарезка $3\times$] -> `PREPPED` -> [Жарка в воке $4.0\text{ с}$] -> `COOKED` (Золотистый) -> [Передержка $> 2.5\text{ с}$] -> `BURNT` (Сгорел).

2. **Очередь заказов и таймер терпения**:
   - Клиент $i$ имеет $T_{max} = 35.0\text{ с}$. Шкала терпения плавно убывает.
   - Сдача в зеленой зоне ($> 60\%$ времени): $1.5\times$ чаевые и продление серии комбо.
   - Сдача в желтой зоне ($20-60\%$): $1.0\times$ базовая награда.
   - Сдача в красной зоне ($< 20\%$): $0.5\times$ награда, комбо сбрасывается.
   - Истечение таймера: клиент уходит, штраф к репутации заведения.
