# QA & Testing Plan: CYBER SLICE: BULLET PROTOCOL (Кибер Срез: Протокол Времени)

## 1. Functional Test Matrix
- [ ] Тест рассечения: проверка корректности генерации двух валидных BufferGeometry при любом угле свайпа без пропадания полигонов.
- [ ] Тест Bullet Time: подтверждение замедления перемещения врагов и снарядов ровно в 10 раз при сохранении 60 FPS рендеринга шлейфа пальца.
- [ ] Тест комбо: проверка корректного сброса ранга при получении урона и сохранения комбо при своевременном рассечении следующего врага.
- [ ] Тест роглайт-перков: проверка наложения эффектов цепной молнии и корректной модификации статов урона.
- [ ] Тест Playgama Bridge: проверка корректности выдачи награды после просмотра Rewarded Video и сохранения в Cloud Storage.

## 2. Performance Benchmarks
- [ ] Стабильные 60 FPS на смартфонах уровня Xiaomi Redmi Note 10 / iPhone 11.
- [ ] Количество Draw Calls в бою не превышает 65.
- [ ] Потребление оперативной памяти вкладки браузера не превышает 180 МБ.
- [ ] Время начальной загрузки и старта игры не более 2.8 секунд на 4G соединении.

## 3. Target Browser Matrix
- Google Chrome (Desktop Windows/Mac)
- Apple Safari (iOS 15+ Mobile Safari)
- Yandex Browser (Desktop & Android Mobile App)
- VK App WebView (Android & iOS)
- Samsung Internet (Android)
