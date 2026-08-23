# QA & Testing Plan: Вышибала: Сброс за борт

## 1. Functional Test Matrix
- [ ] Проверка перехода врага из кинематического состояния в активный Rapier3D рэгдолл при ударе ногой и выстреле
- [ ] Проверка коллизии отлетающего рэгдолла с другими противниками и начисления цепного урона
- [ ] Проверка триггера зоны падения (Kill Plane Y < -10) для фиксации ринг-аута и удаления тела
- [ ] Проверка завершения волны при обнулении счетчика врагов и открытие окна выбора улучшений
- [ ] Проверка работы Rewarded Video возрождения и возврата игрока в центр арены с неуязвимостью на 2 секунды

## 2. Performance Benchmarks
- [ ] Поддержание стабильных 60 FPS на средних десктопных браузерах (Chrome/Firefox/Edge) при 15 активных телах на сцене
- [ ] Поддержание не менее 50–60 FPS на мобильных устройствах (iOS Safari / Android Chrome)
- [ ] Холодный запуск сцены и инициализация Rapier3D Wasm менее чем за 2.0 секунды
- [ ] Потребление оперативной памяти (RAM) не более 180 МБ в пике боевой сцены

## 3. Target Browser Matrix
- Chrome Desktop / Mobile (WebGL2, V8 JIT, Wasm)
- Safari iOS 15+ / macOS (WebGL2, WebKit Web Audio)
- Firefox Desktop (Gecko WebGL2, Wasm)
- Yandex Browser Desktop / Android (Playgama SDK Bridge Integration)
