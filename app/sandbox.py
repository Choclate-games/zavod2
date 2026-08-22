"""
Песочница рабочего пространства.

Все проекты живут в `workspace/<slug>/`, и кодовый агент (AGY CLI) запускается
строго внутри каталога проекта. Модуль отвечает за три вещи:

1. Проверку, что любой путь, который мы отдаём агенту, лежит внутри workspace.
2. Заготовки DEVLOG.md / CHANGELOG.md, которые агент обязан вести.
3. Обёртку промпта с жёсткими границами доступа и требованием документировать
   каждое изменение.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional

from app.config import config

DEVLOG_NAME = "DEVLOG.md"
CHANGELOG_NAME = "CHANGELOG.md"
AGENTS_NAME = "AGENTS.md"


class SandboxViolation(RuntimeError):
    """Путь выходит за пределы рабочего пространства."""


def workspace_root() -> Path:
    root = config.workspace_dir
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def is_inside_workspace(path: Path) -> bool:
    try:
        Path(path).resolve().relative_to(workspace_root())
        return True
    except (ValueError, OSError):
        return False


def ensure_inside_workspace(path: Path) -> Path:
    """Возвращает разрешённый абсолютный путь либо бросает SandboxViolation."""
    resolved = Path(path).resolve()
    if not is_inside_workspace(resolved):
        raise SandboxViolation(
            f"Путь '{resolved}' вне рабочего пространства '{workspace_root()}'. "
            f"Агенту разрешено работать только внутри workspace/."
        )
    return resolved


def project_dir(slug: str) -> Path:
    """Каталог проекта по слагу, с защитой от '..' и абсолютных путей."""
    if not slug or slug in (".", ".."):
        raise SandboxViolation(f"Некорректный слаг проекта: '{slug}'")
    return ensure_inside_workspace(workspace_root() / slug)


def legacy_docs_dir(slug: str) -> Path:
    """Старое место спецификаций — output/<slug>/ (до переезда проектов в workspace)."""
    return (config.base_dir / "output" / slug).resolve()


def docs_dir(slug: str) -> Path:
    """
    Каталог с документацией проекта.

    Проекты живут в workspace/, но у игр, созданных до переезда, спецификация
    осталась в output/<slug>/. Поэтому сначала ищем документы рядом с кодом и
    только затем — в старом каталоге; без этого вкладки ТЗ выглядели пустыми.
    """
    project = project_dir(slug)
    if (project / "GAME_DATA.yaml").exists() or (project / "AI_DEVELOPER_PROMPT.md").exists():
        return project
    legacy = legacy_docs_dir(slug)
    if (legacy / "GAME_DATA.yaml").exists() or (legacy / "AI_DEVELOPER_PROMPT.md").exists():
        return legacy
    return project


def list_projects() -> list[Path]:
    """Каталоги проектов в workspace (спека и/или исходники), свежие сверху."""
    root = workspace_root()
    if not root.exists():
        return []
    projects = [
        p for p in root.iterdir()
        if p.is_dir()
        and not p.name.startswith(".")
        and ((p / "GAME_DATA.yaml").exists() or (p / "package.json").exists())
    ]
    # Игры, оставшиеся только в старом output/, тоже должны быть в списке —
    # иначе их спецификация пропадает из интерфейса.
    known = {p.name for p in projects}
    legacy_root = config.base_dir / "output"
    if legacy_root.exists():
        for p in legacy_root.iterdir():
            if (p.is_dir() and not p.name.startswith(".")
                    and p.name not in known and (p / "GAME_DATA.yaml").exists()):
                projects.append(p)
    return sorted(projects, key=lambda p: p.stat().st_mtime, reverse=True)


# ---------------------------------------------------------------------------
# Документация разработки: DEVLOG + CHANGELOG
# ---------------------------------------------------------------------------

_DEVLOG_TEMPLATE = """# Журнал разработки — {title}

Этот файл ведёт ИИ-агент. Каждая сессия работы = одна запись:
что просили, что сделано, какие файлы затронуты, что проверено, что осталось.

---

## {date} — Инициализация проекта
- **Задача**: создан каталог проекта в workspace, подготовлена спецификация.
- **Сделано**: сгенерирован пакет документации фабрики.
- **Следующий шаг**: реализация игрового кода по AI_DEVELOPER_PROMPT.md.
"""

_CHANGELOG_TEMPLATE = """# Changelog — {title}

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версии — по [SemVer](https://semver.org/lang/ru/).

## [Unreleased]

### Added
- Каркас проекта и спецификация игры.

---
"""


def ensure_project_docs(directory: Path, title: str = "") -> None:
    """
    Создаёт AGENTS.md, DEVLOG.md и CHANGELOG.md, если их ещё нет.

    Границу workspace здесь НЕ проверяем: это запись собственных файлов фабрики
    в каталог, который она же и создала (в тестах и при кастомном OUTPUT_DIR он
    может лежать где угодно). Песочница ограничивает то, что уходит агенту, —
    см. `project_dir()` и `build_agent_prompt()`.
    """
    directory = Path(directory).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    title = title or directory.name
    date = datetime.now().strftime("%Y-%m-%d %H:%M")

    devlog = directory / DEVLOG_NAME
    if not devlog.exists():
        devlog.write_text(_DEVLOG_TEMPLATE.format(title=title, date=date), encoding="utf-8")

    changelog = directory / CHANGELOG_NAME
    if not changelog.exists():
        changelog.write_text(_CHANGELOG_TEMPLATE.format(title=title), encoding="utf-8")

    # AGENTS.md перезаписываем: это машинная инструкция от фабрики, а не рабочий
    # документ агента — она должна оставаться актуальной.
    (directory / AGENTS_NAME).write_text(
        _AGENTS_TEMPLATE.format(
            title=title,
            project=directory,
            devlog=DEVLOG_NAME,
            changelog=CHANGELOG_NAME,
        ),
        encoding="utf-8",
    )


_AGENTS_TEMPLATE = """# AGENTS.md — инструкция для ИИ-агента

Проект: **{title}**
Каталог: `{project}`

Этот файл создан фабрикой и читается автоматически. Он задаёт правила работы над
проектом. Всё, что здесь написано, обязательно к исполнению.

---

## 1. Границы работы

- Рабочий каталог — только этот проект и его подпапки.
- Не выходить выше по дереву: никаких `..`, абсолютных путей наружу, правок кода
  фабрики, соседних проектов, настроек ОС или домашнего каталога.
- Команды оболочки запускать только с рабочей директорией внутри проекта.
- `node_modules/` и `dist/` руками не трогать — только через npm.

## 2. Что читать перед работой

| Файл | Зачем |
| :--- | :--- |
| `ACCEPTANCE.md` | Приёмка проекта: пронумерованные проверки. Читать ПЕРВЫМ — дальше всё делается под них |
| `AI_DEVELOPER_PROMPT.md` | Мастер-спецификация игры: стек, архитектура, механики |
| `balance.yaml` | Числа игры. Код читает их отсюда; литералов в коде быть не должно |
| `{devlog}` | Что уже сделано, что проверено, что осталось |
| `{changelog}` | История изменений глазами игрока |
| `LIBRARY.md` | Готовый код фабрики: что уже написано и отлажено. Смотреть ДО того, как писать механику с нуля |
| `knowledge.manifest.json` | Что этой игре нужно из базы знаний |
| `DESIGN.md` | Дизайн игры. Его пишешь ты, до первой строчки кода |
| `skills/` | Правила по областям: игровой домен, рендер, Playgama, управление |
| `MOBILE_CONTROLS.md` | Обязательный контракт тач-управления |
| `GAMEPLAY_SPECIFICATION.md`, `ARCHITECTURE_DOCUMENT.md` | Механики и модули |
| `README.md` | Запуск, управление, структура каталогов |

Порядок: сперва `{devlog}` (текущее состояние), затем спецификация нужной области.

## 3. Что обновлять после КАЖДОЙ задачи

Это часть Definition of Done. Задача без этих записей считается невыполненной.

1. **`{devlog}`** — новая запись в конце файла:
   ```markdown
   ## ГГГГ-ММ-ДД ЧЧ:ММ — краткая суть
   - **Задача**: что просили
   - **Сделано**: по пунктам, по существу
   - **Затронутые файлы**: список путей
   - **Проверено**: какие команды прогнаны и с каким результатом
   - **Известные проблемы / следующий шаг**: честно, без замалчивания
   ```
2. **`{changelog}`** — строки в разделе `## [Unreleased]`, подразделы
   `Added` / `Changed` / `Fixed` / `Removed`. Формулировки на языке игрока
   («колёса больше не заваливаются в повороте»), а не описание диффа
   («изменён VehicleBuilder.ts»).
3. **`README.md`** — если менялись запуск, управление или структура каталогов.

## 4. Проверка перед отчётом

```bash
npm run build              # сборка обязана проходить
npm run dev                # игра должна открываться без ошибок в консоли
node scripts/check-spec.mjs   # статическая часть приёмки из ACCEPTANCE.md
```

Самым первым, до всего остального:

```bash
node scripts/fetch-knowledge.mjs   # база знаний → docs/ref/, дальше офлайн
```

Скрипт приёмки лежит в проекте и зависимостей не требует — пропиши его в
`package.json` как `"check:spec"`. Прогоняй после каждой фазы, а не один раз в
конце: он ловит ровно те дефекты, которые потом переделываются дороже всего —
литералы цвета мимо темы, эмодзи вместо иконок, непрозрачную заливку поверх
игровой сцены, отсутствующий `game_ready`.

Фабрика запускает игру именно так (вкладка «Играть»), поэтому рабочие скрипты
`dev` / `build` / `preview` в `package.json` — обязательны.

## 5. Вложения и озвучка

- Скриншоты и файлы, приложенные к задаче, лежат в `.factory/uploads/`. Ссылки на
  них приходят в тексте задачи — открывай их по этим путям. Папка временная:
  файлы старше недели фабрика удаляет, поэтому нужное копируй в `assets/`.
- Озвучку (Fish Audio TTS) запускает только человек, из вкладки «🔊 Озвучка».
  Не вызывай TTS-API сам и не добавляй в проект ключи Fish Audio. Готовые
  реплики появятся в `assets/audio/voice/` — используй уже существующие файлы.

## 6. Правила кода

- TypeScript strict, без `any`.
- Никаких аллокаций в игровом цикле 60 Гц — переиспользуемые векторы и пулы.
- Управление: клавиатура И полноценный тач (см. `skills/CONTROLS_SKILL.md`).
- Никаких заглушек и TODO вместо реализации: то, что заявлено, должно работать.
- Прежде чем писать механику с нуля — загляни в `LIBRARY.md`. Нашёл готовое —
  тяни `node scripts/fetch-knowledge.mjs <путь>` и подгоняй. Не нашёл или не
  подошло — пиши сам, но запиши в журнал строку «взял/не взял и почему».
- Числа берутся из `balance.yaml`, а не пишутся литералами: правка баланса не
  должна быть правкой кода.
- DOM создаётся только в `src/ui/`; значения — только в `src/ui/theme.css`.
"""


def append_devlog(directory: Path, heading: str, body: str) -> None:
    """Добавляет запись в DEVLOG.md (используется GUI для отметок о запусках)."""
    directory = Path(directory).resolve()
    ensure_project_docs(directory)
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    entry = f"\n## {stamp} — {heading}\n{body.rstrip()}\n"
    with open(directory / DEVLOG_NAME, "a", encoding="utf-8") as f:
        f.write(entry)


# ---------------------------------------------------------------------------
# Обёртка промпта для кодового агента
# ---------------------------------------------------------------------------

_RULES_TEMPLATE = """[ПЕРВЫМ ДЕЛОМ]
Прочитай `{agents}` в корне проекта — это инструкция фабрики: границы работы,
что читать перед задачей и что обязательно обновлять после неё.

[РАБОЧЕЕ ПРОСТРАНСТВО — ЖЁСТКИЕ ГРАНИЦЫ]
Твой рабочий каталог: {project}
Это каталог проекта «{title}». Правила, которые нельзя нарушать:
1. Читай, создавай и меняй файлы ТОЛЬКО внутри этого каталога и его подпапок.
2. Никогда не выходи выше по дереву (никаких `..`, абсолютных путей наружу,
   правок кода самой фабрики, конфигов ОС, домашнего каталога или других проектов).
3. Команды оболочки запускай только с рабочей директорией внутри проекта
   (npm install, npm run dev, npm run build, tsc и т.п.).
4. Не трогай node_modules/ и dist/ вручную — только через npm.

[ОБЯЗАТЕЛЬНАЯ ДОКУМЕНТАЦИЯ РАЗРАБОТКИ]
В конце КАЖДОЙ задачи, до того как отчитаешься о завершении:
1. Допиши запись в `{devlog}` — заголовок «## ГГГГ-ММ-ДД ЧЧ:ММ — <краткая суть>»
   и по пунктам: **Задача**, **Сделано**, **Затронутые файлы**, **Проверено**,
   **Известные проблемы / следующий шаг**.
2. Допиши запись в `{changelog}` в разделе `## [Unreleased]`, в подраздел
   Added / Changed / Fixed / Removed — по одной строке на осмысленное изменение,
   языком игрока, а не описанием диффа.
3. Если в проекте ещё нет README.md — создай его: как запустить (`npm install`,
   `npm run dev`), управление на клавиатуре и на телефоне, структура каталогов.
Эти файлы — часть Definition of Done. Задача без записи в DEVLOG и CHANGELOG
считается невыполненной.

[ЗАПУСК И ПРОВЕРКА]
Игра должна запускаться командой `npm run dev` (Vite) из корня проекта и
открываться в браузере без ошибок в консоли. Держи `package.json` в рабочем
состоянии: скрипты dev/build/preview обязательны.
"""


def build_agent_prompt(
    task: str,
    directory: Path,
    title: str = "",
    history: Optional[str] = None,
) -> str:
    """
    Собирает финальный промпт для кодового агента: границы песочницы,
    требования к документации, опциональный контекст прошлых сообщений и задача.
    """
    directory = ensure_inside_workspace(directory)
    ensure_project_docs(directory, title or directory.name)

    rules = _RULES_TEMPLATE.format(
        project=directory,
        title=title or directory.name,
        devlog=DEVLOG_NAME,
        changelog=CHANGELOG_NAME,
        agents=AGENTS_NAME,
    )

    parts = [rules]
    if history:
        parts.append(f"[КОНТЕКСТ ПРЕДЫДУЩЕГО ДИАЛОГА ПО ЭТОМУ ПРОЕКТУ]\n{history}")
    parts.append(f"[ЗАДАЧА]\n{task}")
    return "\n\n".join(parts)
