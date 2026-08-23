# QA & Testing Plan: Банкетный Краш: Свадебный Саботаж

## 1. Functional Test Matrix
- [ ] Проверка корректности передачи импульса катапульты рэгдоллу при всех углах от 0° до 75°
- [ ] Тестирование срабатывания Break Joint троса при пороговой скорости удара >= 15 м/с
- [ ] Проверка логики начисления очков за каждый разрушенный объект интерьера
- [ ] Тестирование функции мгновенного перезапуска (сброс позиций всех RigidBody без утечек памяти)

## 2. Performance Benchmarks
- [ ] Стабильные 60 FPS на средних смартфонах (Snapdragon 680 / Helio G99) в момент взрыва торта и люстры
- [ ] Потребление памяти JS Heap не более 120 МБ после 50 последовательных перезапусков
- [ ] Количество Draw Calls в Three.js не превышает 75 в кульминационной фазе погрома

## 3. Target Browser Matrix
- Google Chrome (Desktop / Android) — WebGL 2.0, Pointer Events
- Safari (iOS 15+) — WebKit WebGL, Safe Area Insets, Touch Events
- Yandex Browser (Desktop / Mobile) — интеграция Playgama SDK
- Firefox / Edge (Desktop) — поддержка Wasm Rapier3D
