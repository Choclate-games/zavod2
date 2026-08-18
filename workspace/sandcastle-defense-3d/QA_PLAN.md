# QA & Testing Plan: Песочный Бастион 3D: Защита Пляжа

## 1. Functional Test Matrix
- [ ] Проверка запрета возведения башни, блокирующей 100% путей к замку (валидация FlowField)
- [ ] Корректность пересчета траекторий всех мобов при мгновенном изменении сетки
- [ ] Поведение летающих врагов (чайки): игнорирование стен и прямолинейный полет к замку
- [ ] Работа сохранения и загрузки прогресса через Playgama Bridge Storage
- [ ] Корректный показ и начисление наград за Rewarded Video

## 2. Performance Benchmarks
- [ ] Стабильные 60 FPS при 150 активных крабах и 30 башнях на экране
- [ ] Время расчета FlowField матрицы 24x16 не превышает 1.5 мс
- [ ] Потребление оперативной памяти вкладкой браузера < 120 МБ

## 3. Target Browser Matrix
- Google Chrome (Desktop / Android)
- Apple Safari (iOS 15+ WebGL 2.0)
- Yandex Browser (Desktop / Mobile)
- Firefox / Edge (Latest versions)
