# QA & Testing Plan: Лавинный снайпер: Эхо Каньона

## 1. Functional Test Matrix
- [ ] Проверка точности попадания луча выстрела (Raycast) с учетом ветрового смещения в узел Stress Core
- [ ] Проверка перехода в рапид-камеру Bullet-Cam при валидном попадании по леднику
- [ ] Проверка срабатывания триггера физической лавины и уничтожения титана при контакте с обломками
- [ ] Проверка корректной работы задержки дыхания и расхода шкалы легких
- [ ] Проверка сохранения прогресса и разблокировки перевалов через хранилище Playgama Bridge

## 2. Performance Benchmarks
- [ ] Стабильные 60 FPS на десктопных браузерах Chrome/Firefox/Safari
- [ ] Не менее 50–60 FPS на мобильных устройствах среднего уровня (Snapdragon 778G / Apple A13 Bionic)
- [ ] Время инициализации сцены и физического мира Rapier3D не более 1.5 секунд
- [ ] Общий размер загружаемых ассетов (Bundle + 3D meshes + audio) < 4.5 MB

## 3. Target Browser Matrix
- Chrome 120+ (Desktop & Android)
- Safari 17+ (macOS & iOS)
- Firefox 120+ (Desktop)
- Yandex Browser (Desktop & Mobile)
- VK In-App Browser (Android & iOS Webview)
