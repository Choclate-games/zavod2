# Skill: Three.js + Rapier3D First-Person Physics Architecture

## Purpose
Руководство по связке высокопроизводительного рендеринга Three.js с физическим миром Rapier3D Wasm для динамичного экшена от первого лица.

## When to Use
При настройке рэгдолла, импульсов ударов, расчете векторов пинка и оптимизации тиков физики.

## Core Rules & Constraints
- Использовать фиксированный физический шаг 1/60 с
- Никогда не создавать новые коллайдеры в рантайме без пулинга
- Синхронизировать Three.js Mesh матрицы с Rapier RigidBody позициями в едином цикле

## System Architecture
Модульная архитектура: PhysicsWorld -> CharacterController -> WeaponSystem -> RagdollManager -> VFXPool

## Implementation Guidance
Перевод врага в рэгдолл осуществляется отключением KinematicCharacterController и включением динамических шарнирных тел с начальным импульсом applyImpulse().

## Common Mistakes to Avoid
- ❌ **Mistake**: Забывать вызывать RAPIER.init() до создания мира
- ❌ **Mistake**: Создание избыточно сложных меш-коллайдеров вместо примитивов
- ❌ **Mistake**: Слишком тяжелый hit-stop замораживающий физический мир целиком вместо паузы рендера

## Validation Checklist
- [ ] Проверена инициализация Wasm
- [ ] Настроены слои коллизий (Player, Enemy, Prop, Boundary)
- [ ] Пул рэгдоллов очищается при смене волны


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/knowledge/renderers/threejs.md`
- `docs/ref/knowledge/knowledge/mechanics/ragdoll.md`
