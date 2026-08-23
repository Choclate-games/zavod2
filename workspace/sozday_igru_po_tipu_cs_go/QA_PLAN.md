# QA & Testing Plan: Ван-Тап: Дуэли на Крыше

## 1. Functional Test Matrix
- [ ] Проверка идеальной точности первого выстрела (Spread = 0) при полной остановке персонажа (Speed = 0)
- [ ] Проверка гарантированного ван-тапа при попадании в хитбокс 'HEAD' из Desert Eagle и AWP
- [ ] Проверка начисления поражения обоим игрокам при истечении 15-секундного таймера раунда
- [ ] Проверка корректной смены позиций спавна после каждого раунда в матче Best of 5
- [ ] Проверка сохранения и загрузки ELO-рейтинга через Playgama Bridge Storage

## 2. Performance Benchmarks
- [ ] 60 FPS на устройствах уровня iPhone 11 / Samsung Galaxy A52 в режиме WebGL landscape
- [ ] Количество Draw Calls не превышает 60 во всех боевых сценах на крыше
- [ ] Время полной инициализации 3D сцены и ассетов < 2.2 секунды на 4G соединении
- [ ] Размер итогового JS+Wasm+Assets бандла < 4.0 МБ

## 3. Target Browser Matrix
- Chrome 115+ (Desktop Windows/Mac, Android Chrome)
- Safari 16.4+ (iOS WebKit, macOS Safari)
- Firefox 118+ (Desktop)
- Yandex Browser (Desktop & Mobile WebView)
