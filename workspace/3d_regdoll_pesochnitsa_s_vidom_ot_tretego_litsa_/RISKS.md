# Project Risks & Mitigation: Банкетный Краш: Свадебный Саботаж

### Risk: Просадка FPS на слабых мобильных устройствах при одновременном разрушении сотен бокалов и люстры
- **Category**: TECHNICAL | **Severity**: High
- **Mitigation Strategy**: Использование Three.js InstancedMesh для осколков стекла, отключение физических коллайдеров для мелких частиц (только визуальные партиклы), автосон RigidBody в Rapier3D.

### Risk: Сложность попадания в тонкий трос люстры для неопытных игроков
- **Category**: GAMEPLAY | **Severity**: Medium
- **Mitigation Strategy**: Увеличенный хитбокс захвата крепления (магнитный конус помощи 0.5м) и возможность раскачивания люстры даже при касательном ударе.

### Risk: Физические глитчи рэгдолла (выворачивание суставов при экстремальных импульсах)
- **Category**: TECHNICAL | **Severity**: Medium
- **Mitigation Strategy**: Настройка строгих пределов вращения (Joint Limits) в Rapier3D и активация Continuous Collision Detection (CCD) для туловища.

### Risk: Утомление игрока от частых рекламных пауз
- **Category**: MONETIZATION | **Severity**: Medium
- **Mitigation Strategy**: Строгий лимит кулдауна Interstitial (90 секунд), показ рекламы только после успешных раундов, фокус на добровольных Rewarded Video.
