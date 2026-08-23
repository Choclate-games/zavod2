# QA & Testing Plan: Метро-Балансир: Час Пик

## 1. Functional Test Matrix
- [ ] Проверка сохранения целостности физического соединения предметов при предельных ускорениях вагона
- [ ] Корректность начисления чаевых в зависимости от количества уцелевших предметов на финише
- [ ] Срабатывание Revive-рекламы и корректный возврат упавших предметов в стопку без физического взрыва (jitter)
- [ ] Смена ориентации экрана и корректный пересчет FOV камеры и тач-координат

## 2. Performance Benchmarks
- [ ] Стабильные 60 FPS на iPhone 11 / Samsung Galaxy A52 в Chrome и Safari
- [ ] Не более 35 Draw Calls в Three.js во время движения поезда
- [ ] Время инициализации WebAssembly модуля Rapier3D менее 250 мс
- [ ] Пиковое потребление оперативной памяти менее 120 МБ

## 3. Target Browser Matrix
- Chrome Desktop / Mobile (Windows, macOS, Android)
- Safari iOS (iPhone, iPad - WebKit)
- Яндекс Браузер (Desktop & Mobile)
- VK / Playgama WebView внутри мобильных приложений
