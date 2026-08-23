# Architecture Document: Ледяной Экспресс: Жидкий Баланс

## 1. System Layers Overview
### Game Flow & State Layer
- **Responsibility**: Управление жизненным циклом сессии, состояниями Playgama Bridge SDK, паузой, тайм-аттаком и сохранениями.
### Physics & Simulation Layer
- **Responsibility**: Интеграция Rapier3D WASM, Raycast Vehicle для 6 колес, модель маятника гидроудара жидкого груза.
### Render & Scene Layer
- **Responsibility**: Сцена Three.js, PBR материалы льда и снега, кастомный шейдер хрома цистерны, система инстансинга деревьев и отбойников.
### VFX & Particles Layer
- **Responsibility**: GPU-партиклы для снежных шлейфов, осколков синего льда, выхлопных газов и брызг молока при разгерметизации.
### UI & Input Layer
- **Responsibility**: DOM/Canvas гибридный оверлей интерфейса, сенсорные экранные зоны, поддержка клавиатуры и геймпада.

## 2. Module Dependency Graph
```text
                    [ src/main.ts ]
                          │
                          ▼
                  [ src/core/Game.ts ]
             ┌────────────┼────────────┐
             ▼            ▼            ▼
     [ GameLoop ]   [ EventBus ]  [ PlaygamaService ]
             │            │            │
             ▼            ▼            ▼
     [ PhysicsWorld ] [ Systems ] [ UIManager ]
             │            │            │
             └────────────┼────────────┘
                          ▼
                 [ SceneManager ]
```

## 3. Detailed Source Modules
- **`TruckPhysicsController`**: Расчет сил лучевой подвески, динамического трения шин на льду/снегу и смещения центра масс жидкости.
- **`LiquidSloshSimulator`**: Численный интегратор движения массы молока с учетом поперечных ускорений и гасителей колебаний.
- **`TrackSurfaceManager`**: Быстрая выборка физических свойств поверхности (лед/снег/скала) по координатам колес.
- **`ChaseCameraController`**: Сглаженная следящая камера с боковым выносом в дрифте, инерционным креном и эффектом скорости.
- **`BridgeSDKService`**: Обертка над @playgama/bridge для рекламы, лидербордов, облачных сохранений и локализации.
