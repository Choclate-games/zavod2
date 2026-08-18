# Skill: Пайплайн Изометрического Рендера Three.js

## Purpose
Обеспечение идеального ракурса камеры, настройки освещения и материалов для стилизованной 3D изометрии без искажений.

## When to Use
При инициализации 3D сцены, настройке камеры и материалов моделей турелей и дорожки.

## Core Rules & Constraints
- Использовать фиксированный угол наклона камеры (Pitch 55°, Yaw 45°)
- Применять MeshStandardMaterial с умеренным roughness (0.4-0.6) для сочного пластикового/металлического блеска
- Все динамические объекты объединять в инстансы или переиспользовать через Object Pool

## System Architecture
SceneManager инициализирует WebGLRenderer, создает Orthographic/Isometric Perspective Camera, настраивает Ambient + Directional Light и добавляет тени.

## Implementation Guidance
Для мобильных устройств включать renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)) во избежание перегрева GPU.

## Common Mistakes to Avoid
- ❌ **Mistake**: Создание новых геометрий внутри цикла requestAnimationFrame
- ❌ **Mistake**: Использование слишком тяжелых несжатых текстур вместо процедурных цветов материалов

## Validation Checklist
- [ ] Камера зафиксирована под изометрическим углом
- [ ] Освещение подчеркивает объем моделей
- [ ] Пул объектов для снарядов настроен
