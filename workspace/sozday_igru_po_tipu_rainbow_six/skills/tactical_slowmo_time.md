# Skill: Тактический Менеджер Замедления Времени

## Purpose
Плавная модуляция шкалы времени Time.scale, синхронизация шейдеров и питча Web Audio

## When to Use
При активации фазы штурма после подрыва стены или броска светошумовой гранаты

## Core Rules & Constraints
- Интерполяция delta time через плавный lerp для устранения рывков анимации
- Синхронное изменение скорости воспроизведения звуков и частоты среза фильтра контузии
- Корректный учет независимого от slowmo таймера UI

## System Architecture
Класс TimeManager управляет timeScale глобального цикла, рассылая события в RenderingEngine, PhysicsStep и AudioManager.

## Implementation Guidance
Для физики Rapier3D передавать scaledDeltaTime в метод physicsWorld.step(dt).

## Common Mistakes to Avoid
- ❌ **Mistake**: Замедление работы систем UI и обработки тача вместе с геймплеем
- ❌ **Mistake**: Резкий скачок timeScale без сглаживания

## Validation Checklist
- [ ] Физика и анимация замедляются корректно
- [ ] Тач-управление остается отзывчивым
- [ ] Звуковой фильтр отключается по окончании slowmo
