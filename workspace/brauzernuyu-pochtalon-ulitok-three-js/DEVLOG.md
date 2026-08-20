# Журнал разработки — Браузерную «почтальон улиток» three.js

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## 2026-08-20 20:08 — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.

## 2026-08-20 20:42 — Рабочий прототип сада и почтовой петли
- **Задача**: создать полную запускаемую HTML5/Three.js структуру игры с игровым циклом, физикой, управлением, врагами и Playgama.
- **Сделано**:
  - добавлены Vite, strict TypeScript, Three.js, Rapier3D, Howler и @playgama/bridge;
  - реализованы fixed-step GameLoop 60 Гц и типизированная EventBus;
  - собрана 3D-сцена сада с гнездом, цветами, улитками, маршрутами и угрозами;
  - добавлены автономные курьеры, роли, письма, влажность, расход феромона, риск доставки и рост доверия;
  - добавлены спавн птиц/ос/жуков, Rapier3D-мир, save/load, game_ready, rewarded capability и platform pause/audio hooks;
  - реализованы keyboard, mouse route drawing и Pointer Events touch controls с pointer capture, мультитачем, safe-area и `?touch=1`.
- **Затронутые файлы**: `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/styles.css`, `src/core/*`, `src/game/*`, `src/input/*`, `src/physics/*`, `src/platform/*`, `src/audio/*`, `src/systems/*`, `README.md`, `CHANGELOG.md`.
- **Проверено**: `npm install` завершился успешно; `npm run build` завершился успешно; `npm run dev -- --host 127.0.0.1` поднял Vite на `http://localhost:5173/`.
- **Известные проблемы / следующий шаг**: production bundle крупнее 500 KB из-за Three.js/Rapier/Bridge; следующий шаг — ручная browser QA на desktop и телефоне, затем code-splitting или оптимизация ассетов при необходимости.

## 2026-08-20 20:15 — Генерация кода агентом OPENCODE
- **Задача**: сборка игрового каркаса по спецификации.
- **Сделано**: агент отработал этап кодогенерации (код выхода 0).
- **Следующий шаг**: запустить `npm run dev` и проверить игру в браузере.
