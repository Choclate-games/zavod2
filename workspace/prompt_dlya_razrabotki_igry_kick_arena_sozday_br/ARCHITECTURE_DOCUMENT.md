# Architecture Document: Судебный Пристав: Штурм Локдауна

## 1. System Layers Overview
### PresentationLayer
- **Responsibility**: 
### PhysicsLayer
- **Responsibility**: 
### GameplayLayer
- **Responsibility**: 
### AudioLayer
- **Responsibility**: 
### BridgeLayer
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
- **`Module`**: Обработка кинетического импульса ногой, коллизий дверей и переключения врагов в рэгдолл
- **`Module`**: Расчет лучей отражения пуль от металлических поверхностей и спавн трассеров
- **`Module`**: Фрейм-дата окон парирования (180 мс), поглощение урона и оглушение противников
- **`Module`**: Контроль прогрессии 4 отсеков бункера, спавн подкреплений и таймер локдауна (120 с)
- **`Module`**: Пул предсозданных физических тел Rapier3D для предотвращения аллокаций памяти во время боя
