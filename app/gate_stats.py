"""
Что фабрика узнала о собственных играх, запустив их.

База знаний до сих пор текла в одну сторону: `knowledge/` → игра. Обратной
дороги не было, поэтому одна и та же ошибка воспроизводилась из проекта в
проект — сервис моста без зависимости в `package.json`, интерфейс, чьи корни
никто не вставил в документ, сборка, падающая на импорте стилей. Каждый раз это
чинили внутри одной игры, и знание оставалось в ней.

Здесь итоги приёмки (`.factory/gate.json` каждой игры) собираются в один свод:
что ломается чаще всего и в скольких играх. Свод ложится в
`knowledge/FACTORY_LESSONS.md` — обязательный документ базы, который уезжает в
каждый следующий проект. Наступать на грабли второй раз становится дороже, чем
прочитать про них.
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app import sandbox
from app.acceptance import FACTORY_DIR

LESSONS_NAME = "FACTORY_LESSONS.md"

# Строка чек-листа для документа базы: то, что проверяется взглядом на игру.
# Пункты уезжают в мастер-промпт рядом с адресом документа и работают, даже
# если сам файл так и не открыли.
LESSON_CHECKS: Dict[str, str] = {
    "S1": "`npm run build` проходит начисто — до того, как работа считается сделанной",
    "S2": "Консоль игры пуста при запуске: ни одного исключения в первые секунды",
    "S3": "Игровой цикл не встаёт после ввода — кадры идут и через минуту игры",
    "S4": "В кадре что-то есть: сцена, свет и камера сведены, отрисовка не нулевая",
    "S5": "Игра переживает клавиши, мышь и палец, а не только показ первого кадра",
    "S6": "На экране 390×844 ничего не вылезает за ширину и не требует горизонтальной прокрутки",
    "S7": "Интерфейс виден: корни экранов вставлены в документ, а не только созданы",
    "A5": "Каждый импорт объявлен: `.css` и ассеты не роняют строгую сборку",
    "O1": "Раздел 0 приёмки закрыт: игра про то, что заказал пользователь",
}

# Пояснение к пункту приёмки: почему он падает и что делать, чтобы не падал.
# Текст пишется один раз здесь, а не выдумывается моделью заново в каждой игре.
LESSON_HINTS: Dict[str, str] = {
    "S1": "Сборка падает. Чаще всего — импорт `.css` без объявления модуля, "
          "`any` при `strict: true` и импорт того, чего нет в `package.json`. "
          "Прогоняй `npm run build` до того, как считать работу сделанной.",
    "S2": "Игра открывается с ошибками в консоли. Обычно это обращение к "
          "объекту площадки до инициализации моста или загрузка ресурса по "
          "пути, которого нет в сборке.",
    "S3": "Игровой цикл встаёт. Причина почти всегда одна: исключение внутри "
          "кадра, после которого `requestAnimationFrame` больше не заказан.",
    "S4": "В кадр ничего не попадает. Сцена создана, но камера смотрит мимо, "
          "материал не получил света или объекты не добавлены в сцену.",
    "S5": "Игра не переживает ввод. Обработчик обращается к сущности, которой "
          "уже нет, — проверяй жизненный цикл перед обращением, а не после.",
    "S6": "На телефоне вёрстка разъезжается. Фиксированные размеры в пикселях "
          "вместо `dvh`/`safe-area` и отсутствие ограничения по ширине.",
    "S7": "Интерфейс не появился. Экраны созданы и зарегистрированы, но их "
          "корни не вставлены в слой интерфейса — сцена рисуется, играть нельзя.",
}


def _projects_with_gate() -> List[Tuple[str, dict]]:
    """Все игры, по которым приёмка вообще запускалась."""
    rows: List[Tuple[str, dict]] = []
    for path in sandbox.list_projects():
        gate = path / FACTORY_DIR / "gate.json"
        if not gate.exists():
            continue
        try:
            data = json.loads(gate.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if isinstance(data, dict):
            rows.append((path.name, data))
    return rows


def collect() -> Dict[str, object]:
    """Сводка по всем прогонам приёмки: что падало, у скольких игр, как часто."""
    projects = _projects_with_gate()
    # Считаем игры, а не прогоны: пять починок одной игры не делают ошибку
    # в пять раз более распространённой.
    per_check_projects: Dict[str, set] = defaultdict(set)
    per_check_runs: Counter = Counter()
    titles: Dict[str, str] = {}
    green = 0
    metrics: List[dict] = []

    for slug, data in projects:
        last = data.get("last") or {}
        history = data.get("history") or []
        if last.get("ok"):
            green += 1
        if isinstance(last.get("metrics"), dict) and last["metrics"]:
            metrics.append(last["metrics"])
        for entry in history:
            for check_id in entry.get("failed", []) or []:
                per_check_runs[check_id] += 1
                per_check_projects[check_id].add(slug)
            for check in entry.get("checks", []) or []:
                if check.get("ok") is False:
                    titles.setdefault(str(check.get("id")), str(check.get("title", "")))

    ranked = sorted(
        per_check_projects.items(),
        key=lambda item: (len(item[1]), per_check_runs[item[0]]),
        reverse=True,
    )
    return {
        "projects": len(projects),
        "green": green,
        "ranked": [
            {
                "id": check_id,
                "title": titles.get(check_id, ""),
                "projects": len(slugs),
                "runs": per_check_runs[check_id],
                "hint": LESSON_HINTS.get(check_id, ""),
                "slugs": sorted(slugs)[:6],
            }
            for check_id, slugs in ranked
        ],
        "metrics": _average(metrics),
    }


def _average(rows: List[dict]) -> Dict[str, object]:
    """Средние числа игрока по играм, где приёмка доехала до запуска."""
    if not rows:
        return {}
    out: Dict[str, object] = {}
    for key in ("fps", "draws", "bundleBytes", "firstFrameMs"):
        values = [r[key] for r in rows if isinstance(r.get(key), (int, float))]
        if values:
            out[key] = round(sum(values) / len(values), 1)
    out["games"] = len(rows)
    return out


def render(summary: Optional[Dict[str, object]] = None) -> str:
    """Свод уроков как документ базы знаний."""
    data = summary or collect()
    ranked = data.get("ranked") or []
    stamp = datetime.now().strftime("%d.%m.%Y")

    lines = [
        "# Уроки фабрики: на чём игры спотыкаются на самом деле",
        "",
        "Документ собирается автоматически из отчётов приёмки всех игр "
        "(`.factory/gate.json`). Это не теория и не советы вообще — это список "
        "того, что уже ломалось в выпущенных проектах, с указанием, у скольких "
        "игр именно эта проверка была красной.",
        "",
        f"Обновлено: {stamp}. Игр с приёмкой: {data.get('projects', 0)}, "
        f"из них зелёных: {data.get('green', 0)}.",
        "",
    ]

    metrics = data.get("metrics") or {}
    if metrics:
        bundle = metrics.get("bundleBytes")
        lines += [
            "## Средние числа по выпущенным играм",
            "",
            f"- кадров в секунду: **{metrics.get('fps', '—')}**",
            f"- вызовов отрисовки: **{metrics.get('draws', '—')}**",
            f"- вес сборки: **{round(bundle / 1048576, 2) if isinstance(bundle, (int, float)) else '—'} МБ**",
            f"- задержка первого кадра: **{metrics.get('firstFrameMs', '—')} мс**",
            "",
            "Игра, которая заметно хуже этих чисел, сделана хуже среднего по "
            "фабрике, а не «примерно как все».",
            "",
        ]

    if not ranked:
        lines += [
            "## Пока учиться не на чем",
            "",
            "Ни одна игра ещё не прошла приёмку фабрики, либо все прогоны были "
            "зелёными. Список наполнится сам, как только появятся красные.",
            "",
            "## Чек-лист",
            "",
            *(f"- [ ] {text}" for text in LESSON_CHECKS.values()),
            "",
        ]
        return "\n".join(lines)

    lines += [
        "## Чаще всего красное",
        "",
        "| Проверка | Что это | Игр | Прогонов |",
        "|---|---|---|---|",
    ]
    for row in ranked[:12]:
        lines.append(
            f"| `{row['id']}` | {row['title'] or '—'} | {row['projects']} | {row['runs']} |"
        )
    lines.append("")

    lines += ["## Что с этим делать", ""]
    for row in ranked[:8]:
        if not row.get("hint"):
            continue
        lines += [
            f"### `{row['id']}` — {row['title'] or 'проверка приёмки'}",
            "",
            row["hint"],
            "",
            f"Уже ломалось в играх: {', '.join(row['slugs'])}." if row.get("slugs") else "",
            "",
        ]

    # Чек-лист документа: сначала то, что ломалось в этой фабрике чаще всего,
    # потом остальное. Порядок здесь — порядок вероятности наступить.
    ordered = [row["id"] for row in ranked if row["id"] in LESSON_CHECKS]
    ordered += [key for key in LESSON_CHECKS if key not in ordered]
    lines += ["## Чек-лист", ""]
    lines += [f"- [ ] {LESSON_CHECKS[key]}" for key in ordered]
    lines.append("")
    return "\n".join(line for line in lines if line is not None)


def publish(summary: Optional[Dict[str, object]] = None) -> Path:
    """Кладёт свод в базу знаний, откуда его забирает куратор следующего проекта."""
    from app import knowledge

    path = knowledge.knowledge_root() / LESSONS_NAME
    path.write_text(render(summary), encoding="utf-8")
    return path
