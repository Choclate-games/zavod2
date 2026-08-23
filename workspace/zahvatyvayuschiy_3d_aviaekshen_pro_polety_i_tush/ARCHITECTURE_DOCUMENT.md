# Architecture Document: Огненный Каньон: Водный Сброс

## 1. System Layers Overview
### Application Layer
- **Responsibility**: 
### Core Simulation Layer
- **Responsibility**: 
### Rendering Layer
- **Responsibility**: 
### UI / Presentation Layer
- **Responsibility**: 

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
- **`FlightPhysicsModule`**: Физическая модель гидроплана, расчет подъемной силы, сопротивления и массы
- **`WaterScoopModule`**: Глиссирование по реке, забор воды в баки и генерация кильватерного следа
- **`FireExtinguishModule`**: Управление очагами огня, расчет баллистики сброса и генерация пара
- **`CanyonSlalomModule`**: Генерация процедурного ущелья, расстановка термиков и чекпоинтов
- **`VFXParticleModule`**: Высокопроизводительный инстансинг эффектов огня, брызг и дыма
- **`UIControllerModule`**: Адаптивный сенсорный штурвал и приборный авиационный HUD
