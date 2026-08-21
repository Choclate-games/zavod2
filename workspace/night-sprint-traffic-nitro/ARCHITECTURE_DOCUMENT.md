# Architecture Document: Ночной Спринт: Трафик и Закись

## 1. System Layers Overview
### Core Layer
- **Responsibility**: Game Loop, State Machine, EventBus, Asset Loader, Playgama Bridge SDK Adapter
### Physics & Simulation Layer
- **Responsibility**: Rapier 3D World, Raycast Vehicle Controller, Traffic Spawner, Collision Matrix
### Rendering Layer
- **Responsibility**: Three.js Scene Graph, Highway Module Instancing, Custom Shaders (Wet Road, Neon Bloom), Post-processing
### Audio Layer
- **Responsibility**: Howler.js sound pools, Dynamic Engine RPM Synthesizer, Web Audio Filter for Nitro Whoosh, Synthwave Music Track
### UI & Input Layer
- **Responsibility**: DOM/Canvas Overlay HUD, Touch Drag Controller, Responsive Safe-Area Manager, Leaderboards & Garage UI

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
- **`VehicleController`**: Raycast-физика колес, подвеска, шинное трение и расчет кренов
- **`TrafficManager`**: Пул и процедурный спавн разнотипного трафика с безопасными коридорами
- **`HighwayStreamer`**: Бесшовное перемещение модулей трассы (инстансинг асфальта, отбойников, фонарей)
- **`AdrenalineSystem`**: Детектор Near Miss, расчет комбо-множителя и управление закисью азота
- **`AudioManager`**: Позиционный звук, синтез оборотов двигателя и эффекты нитро-звучания
