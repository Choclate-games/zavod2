# Skill: Динамическая чейз-камера, нитро-эффекты и визуализация Three.js

## Purpose
Обеспечение сочной обратной связи скорости, динамики камеры, партиклов дыма/пламени и шейдера мокрого асфальта.

## When to Use
При настройке чейз-камеры, визуальных спецэффектов нитро, дыма шин и шейдеров окружения.

## Core Rules & Constraints
- Камера не должна проваливаться сквозь отбойники и геометрию трассы
- Пул частиц дыма и огня ограничен 250 элементами
- Шейдер мокрого асфальта использует roughness map и planar/screen reflections для реализма луж

## System Architecture
Модуль NitroVFXManager синхронизирует запуск партиклов Three.js, модификацию FOV камеры и аудио-эффекты Howler.js при изменении состояния нитро-системы.

## Implementation Guidance
Чейз-камера интерполирует свою позицию позади машины с небольшим запаздыванием (spring-damper), кренится на угол roll = -driftAngle * 0.25 и расширяет FOV при включении нитро.

## Common Mistakes to Avoid
- ❌ **Mistake**: Создание новых мешей партиклов на каждый кадр дрифта, вызывающее лаги сборщика мусора (GC)
- ❌ **Mistake**: Отсутствие сброса FOV камеры при прерывании заезда или рестарте

## Validation Checklist
- [ ] FOV плавно интерполируется через lerp с коэффициентом 0.1 без резких скачков
- [ ] Партиклы дыма и искр переиспользуются из фиксированного пула без вызовов new/delete
- [ ] Шейдер мокрого асфальта компилируется один раз при старте сцены без зависаний рендера


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/performance/threejs_webgl_optimization.md`
- `docs/ref/knowledge/mechanics/drift_scoring.md` — Mechanic: Drift Scoring & Chain Multiplier — Name: Drift Scoring Category: Racing & Vehicles Description: A sustained slip angle between roughly 12° and 50° accumulates points proportional to speed and angle. Points…
