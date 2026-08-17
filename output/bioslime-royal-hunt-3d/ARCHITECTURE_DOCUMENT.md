# Architecture Document: Биослизь: Королевская Охота 3D

## 1. System Layers Overview
### Rendering Layer
- **Responsibility**: 
### Physics & Spatial Layer
- **Responsibility**: 
### Game Logic & ECS Layer
- **Responsibility**: 
### Platform & SDK Layer
- **Responsibility**: 
### UI Layer
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
- **`SlimeShaderModule`**: GLSL шейдер с uniform-параметрами скорости, вектора инерции, подповерхностного рассеивания (SSS) и пульсации
- **`AbsorptionPhysicsModule`**: Расчет сил притяжения, эффекта заглатывания массы и интерполяции роста коллайдера
- **`MutationTreeModule`**: Реестр мутаций, логика авто-каста снарядов, споровых облаков и контроллер ИИ миньонов
- **`DestructionManager`**: Пул физических фрагментов для разрушения телег, заборов и палаток при столкновениях
- **`BridgeAdapter`**: Обертка над @playgama/bridge для показа Interstitial/Rewarded рекламы и сохранения прогресса
