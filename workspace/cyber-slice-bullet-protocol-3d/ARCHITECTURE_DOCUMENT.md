# Architecture Document: CYBER SLICE: BULLET PROTOCOL (Кибер Срез: Протокол Времени)

## 1. System Layers Overview
### Presentation Layer
- **Responsibility**: 
### Game Logic & Math Layer
- **Responsibility**: 
### Physics & Collision Layer
- **Responsibility**: 
### Platform & Storage Layer
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
- **`GeometrySlicer`**: Низкоуровневая триангуляция и генерация двух дочерних BufferGeometry при пересечении плоскостью.
- **`TimeDilationManager`**: Плавное масштабирование дельты времени, управление расходом и восстановлением хроно-энергии.
- **`BladeInputController`**: Отслеживание жестов мыши и мультитача, сглаживание траектории (Catmull-Rom) и генерация меша светового следа (Ribbon Trail).
- **`EnemyWaveDirector`**: Спавн волн кибер-дронов, ниндзя-киборгов, турелей и фазовых боссов по таймлайну арены.
- **`RogueliteTalentSystem`**: Хранение древа перков, расчет синергий и применение пассивных модификаторов к физике и атакам.
- **`BridgeIntegrationService`**: Связка с SDK Playgama: показ Rewarded/Interstitial, лидерборды, локализация и cloud save.
