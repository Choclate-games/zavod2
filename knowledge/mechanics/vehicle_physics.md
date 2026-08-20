# Vehicle Physics & Handling (Three.js + Rapier 3D)

> 💡 **Интерактивное демо**: `workspace/knowledge-showcase/index.html` (Режим: *«🚚 ЗиЛ-130 (Rapier 3D 1:1)»*).

## Единый стандарт фабрики для транспортных средств: Rapier 3D WASM

Во всех 3D-проектах фабрики, содержащих автомобили, грузовики или гоночные болиды, **обязательно используется физический движок Rapier 3D (`@dimforge/rapier3d-compat`) с `DynamicRayCastVehicleController`**.

Любые упрощенные самодельные аналитические реализации (Pure JS) **запрещены**, так как они приводят к неестественному поведению кузова, провалам сквозь рельеф и неестественным скачкам на кочках.

---

## Архитектура реализации

1. **Физический мир (`PhysicsWorld.ts`)**:
   * Документация и эталонный код: [`knowledge/threejs/rapier_vehicle_controller.md`](file:///c:/Users/Eduard/Desktop/zavod2/knowledge/threejs/rapier_vehicle_controller.md).
   * Инициализация `@dimforge/rapier3d-compat` (WASM).
   * TriMesh-коллайдер ландшафта (`RAPIER.ColliderDesc.trimesh(vertices, indices)`).
   * Фильтрация лучей колёс через группы `WHEEL_RAY_GROUPS` (лучи видят только землю, исключая кузов и груз).

2. **Контроллер машины (`TruckController.ts`)**:
   * Настоящая динамическая лучевая подвеска (`DynamicRayCastVehicleController`).
   * Пружинный возврат руля к нейтрали:
     ```typescript
     this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, 8.0 * dt);
     this.vehicle.setWheelSteering(0, this.steerAngle);
     this.vehicle.setWheelSteering(1, this.steerAngle);
     ```
   * Честный расчет тяги и торможения на ведущие колеса (`setWheelEngineForce`, `setWheelBrake`).
   * Боковое трение и занос (`setWheelFrictionSlip`, `setWheelSideFrictionStiffness`).

---

## Обязательный чек-лист качества:
* [x] Использование `@dimforge/rapier3d-compat` и `DynamicRayCastVehicleController`.
* [x] TriMesh-коллайдер для дорожного покрытия и холмов.
* [x] Пружинный возврат рулевого колеса в центр.
* [x] Естественный ход подвески каждого колеса на неровностях.
* [x] Дым из выхлопной трубы при нажатии на газ.
* [x] Процедурный синтез звука мотора Web Audio с оборотами RPM (`knowledge/audio/procedural_sound_synthesizer.md`).
