# QA & Testing Plan: Ледяной Экспресс: Жидкий Баланс

## 1. Functional Test Matrix
- [ ] Проверка инициализации Playgama Bridge на десктопе и мобильных устройствах
- [ ] Тест корректности отработки лучевой физики Raycast Vehicle при всех углах крена (0-90°)
- [ ] Проверка невозможности проваливания сквозь геометрию ледяной трассы и скал
- [ ] Тестирование сохранения и загрузки прогресса звезд и рекордов в Cloud Storage
- [ ] Проверка срабатывания Rewarded Video респауна и корректного возврата на трассу

## 2. Performance Benchmarks
- [ ] Стабильные 60 FPS на iPhone 11 / Samsung Galaxy S20 в мобильном браузере Safari/Chrome
- [ ] Не менее 55 FPS на бюджетных устройствах уровня Redmi Note 10 (Mali GPU)
- [ ] Время начальной загрузки бандла и ассетов менее 3.0 секунд при 4G соединении
- [ ] Потребление оперативной памяти вкладки браузера не более 220 МБ

## 3. Target Browser Matrix
- Chrome 120+ (Desktop Windows / Mac / Android)
- Safari 16+ (iOS 16+ iPhone / iPad)
- Firefox 120+ (Desktop Windows / Linux)
- Yandex Browser Mobile (Android / iOS)
- VK In-App Browser (Android / iOS Webview)
