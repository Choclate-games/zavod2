# Project Risks & Mitigation: CYBER SLICE: BULLET PROTOCOL (Кибер Срез: Протокол Времени)

### Risk: Просадки производительности (GC Stutter) при частом создании новых BufferGeometry во время интенсивной нарезки десятков врагов.
- **Category**: TECHNICAL | **Severity**: High
- **Mitigation Strategy**: Использование пула предвыделенных буферов вершин/индексов (TypedArray Object Pooling) и мгновенное ограничение максимального числа активных осколков.

### Risk: Случайные ложные свайпы на мобильных экранах при попытке просто повернуть камеру или нажать на экран.
- **Category**: DESIGN | **Severity**: Medium
- **Mitigation Strategy**: Камера фиксирована в динамическом изометрическом ракурсе; любое касание трактуется как вход в Bullet Time, а свайп длиннее 25 пикселей — как удар.

### Risk: Блокировка звука браузером до первого взаимодействия с пользователем.
- **Category**: TECHNICAL | **Severity**: Low
- **Mitigation Strategy**: Запуск AudioContext строго по первому пользовательскому PointerDown на экране приветствия.
