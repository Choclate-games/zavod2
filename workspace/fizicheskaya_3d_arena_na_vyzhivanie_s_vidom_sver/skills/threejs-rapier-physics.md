# Skill: Интеграция Three.js и Rapier3D Wasm

## Purpose
Обеспечение высокопроизводительной физической симуляции твердых тел и раскалывающихся мешей льда на 60 FPS в браузере.

## When to Use
При разработке 3D физических арен, симуляции столкновений масс и динамического разрушения окружения.

## Core Rules & Constraints
- Синхронизация матриц Three.js и Rapier3D строго в цикле requestAnimationFrame с фиксированным физическим dt = 1/60
- Использование Wasm сборки @dimforge/rapier3d-compat с асинхронной инициализацией перед созданием сцены
- Применение Continuous Collision Detection (CCD) для высокоскоростных объектов во избежание туннелирования

## System Architecture
Двухуровневая архитектура: физический мир Rapier3D (симуляция сил и коллизий) -> трансляция позиций и кватернионов в меши Three.js через буферные массивы.

## Implementation Guidance
Создавать пулы RigidBody для многократного переиспользования сегментов арены и ватрушек без вызовов GC во время матча.

## Common Mistakes to Avoid
- ❌ **Mistake**: Создание новых физических коллайдеров каждый кадр вместо изменения трансформаций
- ❌ **Mistake**: Прямое изменение position.y меша Three.js в обход физического RigidBody

## Validation Checklist
- [ ] Rapier3D Wasm успешно инициализирован до старта рендеринга
- [ ] Коллайдеры пола и ватрушек имеют корректные коэффициенты трения (0.08) и упругости (1.45)
- [ ] Сенсоры ватерлинии корректно регистрируют падение тюбингов на Y < -0.8 м


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/stack/rapier3d.md` — Rapier3D — физика (`@dimforge/rapier3d-compat@^0.20`) — Единственный физический движок фабрики. Cannon-es, ammo.js, Oimo и самописная «физика на скоростях» — запрещены: ниже описан весь набор, ради которого их обычно…
- `docs/ref/knowledge/mechanics/physics_destruction.md` — Mechanic: Destructible Environment & Dynamic Hazards — Name: Destructible Environment & Dynamic Hazards Category: Environment & Physics Description: Arena structures (stone pillars, wooden crates, barricades, weapon…
