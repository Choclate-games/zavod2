# Project Risks & Mitigation: Тактика Прорыва: CQB Штурм

### Risk: Падение FPS на бюджетных мобильных устройствах при одновременном расчете физики 24 осколков стены
- **Category**: TECHNICAL | **Severity**: High
- **Mitigation Strategy**: Использование инстансинга (InstancedMesh) для осколков, лимит 12 физических тел на мобилках и быстрое засыпание (sleep) тел через 1.5 сек

### Risk: Сложность точного прицеливания на смартфонах без мыши в динамичном шутере
- **Category**: GAMEPLAY | **Severity**: Medium
- **Mitigation Strategy**: Механика тактического замедления времени (Slow-Mo) и увеличенные зоны регистрации попаданий (hitbox magnifiers) по силуэтам

### Risk: Блокировка аудио-контекста политикой браузеров до первого клика
- **Category**: TECHNICAL | **Severity**: Medium
- **Mitigation Strategy**: Отложенная инициализация Web Audio AudioContext по первому тапу по экрану в главном меню
