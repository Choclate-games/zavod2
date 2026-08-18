# QA & Testing Plan: Слияние Турелей 3D: Оборона Базы

## 1. Functional Test Matrix
- [ ] Проверка корректности слияния одинаковых уровней от Tier 1 до Tier 15
- [ ] Проверка запрета слияния разноуровневых турелей (меняются местами)
- [ ] Проверка начисления оффлайн монет при изменении timestamp сохранения
- [ ] Проверка корректной работы Rewarded Video с получением награды только после успешного колбэка
- [ ] Проверка раскалывания больших сфер на две меньшие при обнулении HP
- [ ] Проверка перезапуска волны при поражении базы с сохранением всех турелей на сетке

## 2. Performance Benchmarks
- [ ] Стабильные 60 FPS на iPhone 11 / бюджетных Android (Snapdragon 680 / Helio G85)
- [ ] Время начальной загрузки игры менее 2.5 секунд при 3G соединении
- [ ] Потребление оперативной памяти WebGL вкладки менее 120 МБ
- [ ] Количество Draw Calls в Three.js не превышает 45 единиц во время спавна волны босса

## 3. Target Browser Matrix
- Yandex Browser (Desktop & Mobile Android/iOS)
- Google Chrome (Windows, macOS, Android)
- Apple Safari (iOS 15+, iPadOS, macOS)
- VK App WebView (Android & iOS)
