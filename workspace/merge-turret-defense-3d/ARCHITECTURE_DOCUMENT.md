# Architecture Document: Слияние Турелей 3D: Оборона Базы

## 1. System Layers Overview
### 3D_Battlefield_Layer
- **Responsibility**: 
### 2D_MergeGrid_HUD_Layer
- **Responsibility**: 
### Modal_Popup_Layer
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
- **`App`**: Точка входа, инициализация Three.js сцены, Playgama Bridge SDK, запуск игрового цикла.
- **`SceneManager`**: Управление камерой, изометрическим освещением, тенями, туманом и материалами Three.js.
- **`MergeGridController`**: Логика Drag-and-Drop, анимации объединения (GSAP/Tween), синхронизация 16 слотов сетки.
- **`TurretFactory`**: Создание процедурных 3D-моделей 15 тиров турелей с уникальными материалами, стволами и спецэффектами.
- **`EnemyWaveManager`**: InstancedMesh пул цветных сфер врагов, перемещение по CatmullRomCurve3, расчет раскалывания.
- **`ProjectilePool`**: Высокоэффективный пул снарядов (InstancedMesh) без аллокаций памяти в render loop.
- **`SaveManager`**: Синхронизация прогресса с Playgama Bridge Cloud Storage и LocalStorage фолбэком.
- **`AudioManager`**: Управление синтезом звуков выстрелов, мерджа и фонового саундтрека.
