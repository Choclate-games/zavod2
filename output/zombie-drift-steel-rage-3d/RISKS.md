# Project Risks & Mitigation: Зомби Дрифт: Стальная Ярость 3D

### Risk: Просадка FPS при большом числе одновременных врагов на мобильных устройствах
- **Category**: TECHNICAL | **Severity**: Medium
- **Mitigation Strategy**: Использование InstancedMesh, пулинга объектов и лимита активных тел до 16.

### Risk: Блокировка рекламы или потеря интернет-соединения
- **Category**: PLATFORM | **Severity**: Low
- **Mitigation Strategy**: Graceful fallback: игра не зависает при ошибке рекламы и сохраняет данные локально.
