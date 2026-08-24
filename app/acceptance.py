"""
Приёмка игры глазами фабрики, а не со слов агента.

До этого модуля приёмка существовала в двух видах: скрипты `check-spec.mjs` и
`smoke.mjs` уезжали в пакет игры, а инструкция «прогоняй после каждой фазы»
лежала в тексте для кодового агента. Исполнял её агент — и он же отчитывался о
результате. Так в `DEVLOG.md` появлялись строки «статическая приёмка пройдена
полностью, все проверки зелёные» у проекта, где нужной зависимости не было
даже в `package.json`.

Здесь эти же скрипты запускает фабрика. Отчёт она читает машинно
(`.factory/spec-report.json`, `.factory/smoke-report.json`), решение о
готовности принимает по нему, а провалившиеся пункты возвращает агенту
задачей на починку. Слово агента о собственной работе перестаёт быть
основанием для чего бы то ни было.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional

from app import pkgstore
from app.sandbox import ensure_inside_workspace
from generators.check_spec_script import CHECK_SPEC_MJS
from generators.smoke_script import SMOKE_MJS

LogFn = Callable[[str], None]
StopFn = Callable[[], bool]

FACTORY_DIR = ".factory"
SPEC_REPORT = "spec-report.json"
SMOKE_REPORT = "smoke-report.json"

# Дымовой запуск сам собирает игру и держит внутри себя ограничение в четыре
# минуты на браузерную часть. Снаружи ему нужен запас на установку и сборку.
INSTALL_TIMEOUT = 900
SPEC_TIMEOUT = 180
SMOKE_TIMEOUT = 900


@dataclass
class GateCheck:
    """Один пункт приёмки: то, что игрок либо получил, либо нет."""

    id: str
    title: str
    ok: Optional[bool]
    note: str = ""

    @property
    def failed(self) -> bool:
        return self.ok is False

    def line(self) -> str:
        mark = "·" if self.ok is None else ("✅" if self.ok else "❌")
        return f"{mark} {self.id}  {self.title}" + (f" — {self.note}" if self.note else "")


@dataclass
class GateReport:
    """Итог прогона приёмки по одной игре."""

    project: str = ""
    phase: str = ""
    stages: Dict[str, int] = field(default_factory=dict)   # install/spec/smoke → код возврата
    spec: List[GateCheck] = field(default_factory=list)
    smoke: List[GateCheck] = field(default_factory=list)
    metrics: Dict[str, object] = field(default_factory=dict)
    blockers: List[str] = field(default_factory=list)      # то, что не дало прогону состояться
    log_tail: str = ""
    seconds: int = 0

    @property
    def failures(self) -> List[GateCheck]:
        return [c for c in (*self.spec, *self.smoke) if c.failed]

    @property
    def ok(self) -> bool:
        """Зелёная приёмка — это ноль провалов и ноль сорванных этапов."""
        if self.blockers:
            return False
        if any(code != 0 for code in self.stages.values()):
            return False
        return not self.failures

    @property
    def ran(self) -> bool:
        """Прогон состоялся: хоть один скрипт приёмки отработал и дал отчёт."""
        return bool(self.spec or self.smoke)

    def summary(self) -> str:
        if self.blockers:
            return "приёмка не состоялась: " + "; ".join(self.blockers)
        if self.ok:
            return f"приёмка зелёная ({len(self.spec) + len(self.smoke)} проверок)"
        broken = self.failures
        return (f"провалено {len(broken)} проверок: "
                + ", ".join(c.id for c in broken[:12])
                + ("…" if len(broken) > 12 else ""))

    def metrics_line(self) -> str:
        m = self.metrics
        if not m:
            return ""
        mb = m.get("bundleBytes")
        return " · ".join([
            f"FPS {m.get('fps', '—')}",
            f"отрисовок {m.get('draws', '—')}",
            f"вес {round(mb / 1048576, 2) if isinstance(mb, (int, float)) else '—'} МБ",
            f"первый кадр {m.get('firstFrameMs', '—')} мс",
            f"ошибок {m.get('consoleErrors', '—')}",
        ])

    def repair_task(self, phase_hint: str = "") -> str:
        """Задача кодовому агенту: что именно чинить.

        Не «поправь качество» и не «доведи до ума», а список пунктов, каждый из
        которых машина сама перепроверит следующим прогоном. Агент не может
        закрыть такую задачу словами.
        """
        lines: List[str] = [
            "Приёмка игры провалена. Ниже — то, что фабрика проверила сама, "
            "запустив твой код. Это не мнение и не пожелание: те же проверки "
            "пойдут снова, как только ты закончишь.",
            "",
        ]
        if self.blockers:
            lines += ["## Прогон не состоялся", *(f"- {b}" for b in self.blockers), ""]

        broken_spec = [c for c in self.spec if c.failed]
        broken_smoke = [c for c in self.smoke if c.failed]
        if broken_spec:
            lines.append("## Статическая приёмка (`node scripts/check-spec.mjs`)")
            lines += [f"- **{c.id}** {c.title}" + (f"\n  {c.note}" if c.note else "")
                      for c in broken_spec]
            lines.append("")
        if broken_smoke:
            lines.append("## Дымовой запуск (`node scripts/smoke.mjs`) — это видит игрок")
            lines += [f"- **{c.id}** {c.title}" + (f"\n  {c.note}" if c.note else "")
                      for c in broken_smoke]
            lines.append("")
        if self.log_tail.strip():
            lines += ["## Хвост лога", "```", self.log_tail.strip()[-3000:], "```", ""]
        if phase_hint:
            lines += [f"Текущая фаза работы: {phase_hint}.", ""]
        lines += [
            "Правь причину, а не симптом: подгонять проверку под код запрещено, "
            "скрипты приёмки принадлежат фабрике и будут перезаписаны.",
            "Закончив, коротко запиши сделанное в `DEVLOG.md`.",
        ]
        return "\n".join(lines)

    def as_dict(self) -> Dict[str, object]:
        return {
            "phase": self.phase,
            "ok": self.ok,
            "summary": self.summary(),
            "stages": self.stages,
            "metrics": self.metrics,
            "blockers": self.blockers,
            "seconds": self.seconds,
            "failed": [c.id for c in self.failures],
            "checks": [
                {"id": c.id, "title": c.title, "ok": c.ok, "note": c.note, "kind": kind}
                for kind, group in (("spec", self.spec), ("smoke", self.smoke))
                for c in group
            ],
        }


# ---------------------------------------------------------------- запуск команд


def _npm() -> str:
    for candidate in (("npm.cmd", "npm") if sys.platform == "win32" else ("npm",)):
        if shutil.which(candidate):
            return candidate
    return "npm.cmd" if sys.platform == "win32" else "npm"


def _node() -> str:
    return shutil.which("node") or "node"


def _run(cmd: List[str], cwd: Path, on_log: LogFn, stop_check: Optional[StopFn],
         timeout: int) -> tuple[int, str]:
    """Команда с потоковым логом. Возвращает код возврата и хвост вывода."""
    try:
        proc = subprocess.Popen(
            cmd, cwd=str(cwd),
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace", bufsize=1,
            # Общий стор пакетов: npm в PATH подменён на pnpm со сквозным кешем.
            env=pkgstore.env(bootstrap=False),
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
    except OSError as exc:
        on_log(f"❌ Не удалось запустить {' '.join(cmd)}: {exc}\n")
        return -1, str(exc)

    tail: List[str] = []
    deadline = time.time() + timeout
    assert proc.stdout is not None
    for line in proc.stdout:
        on_log(line)
        tail.append(line)
        if len(tail) > 200:
            del tail[:-200]
        if stop_check and stop_check():
            proc.kill()
            return -2, "".join(tail)
        if time.time() > deadline:
            proc.kill()
            on_log(f"❌ {' '.join(cmd[:2])} не уложился в {timeout} с и был прерван.\n")
            return -3, "".join(tail)
    proc.wait()
    return proc.returncode, "".join(tail)


# ---------------------------------------------------------------- оснастка


def install_scripts(project_dir: Path) -> None:
    """Кладёт в игру свежие скрипты приёмки, затирая правки агента.

    Скрипты — инструмент фабрики, а не часть игры. Когда они принадлежали
    проекту, у агента оставалась возможность привести приёмку к своему коду
    вместо обратного.
    """
    scripts = project_dir / "scripts"
    scripts.mkdir(parents=True, exist_ok=True)
    (scripts / "check-spec.mjs").write_text(CHECK_SPEC_MJS, encoding="utf-8")
    (scripts / "smoke.mjs").write_text(SMOKE_MJS, encoding="utf-8")


def _read_report(project_dir: Path, name: str) -> Optional[dict]:
    path = project_dir / FACTORY_DIR / name
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _drop_reports(project_dir: Path) -> None:
    """Отчёт прошлого прогона удаляется до нового.

    Иначе зелёный отчёт недельной давности сойдёт за результат прогона,
    который на самом деле не запустился.
    """
    for name in (SPEC_REPORT, SMOKE_REPORT):
        path = project_dir / FACTORY_DIR / name
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


def _needs_install(project_dir: Path) -> bool:
    modules = project_dir / "node_modules"
    if not modules.exists():
        return True
    package = project_dir / "package.json"
    if not package.exists():
        return False
    # Отметка о последней установке: у npm это .package-lock.json, у pnpm —
    # .modules.yaml. Берём ту, которая есть, иначе установка гонялась бы заново
    # перед каждой приёмкой.
    stamps = [p for p in (modules / ".package-lock.json", modules / ".modules.yaml")
              if p.exists()]
    if not stamps:
        return True
    try:
        return package.stat().st_mtime > max(p.stat().st_mtime for p in stamps)
    except OSError:
        return True


# ---------------------------------------------------------------- прогон


def run_gate(
    project_dir: Path,
    on_log: LogFn = lambda _line: None,
    stop_check: Optional[StopFn] = None,
    phase: str = "",
    with_smoke: bool = True,
) -> GateReport:
    """Прогоняет приёмку игры и возвращает машинный отчёт.

    Порядок обязателен: статическая приёмка дешёвая и ловит недописанное,
    дымовой запуск дорогой и ловит неработающее. Первая без второй ничего не
    значит — игра, зелёная по чтению исходников, может не открываться вовсе.
    """
    project_dir = ensure_inside_workspace(project_dir)
    started = time.time()
    report = GateReport(project=project_dir.name, phase=phase)

    if not (project_dir / "package.json").exists():
        report.blockers.append("в проекте нет package.json — игры ещё нет")
        return report

    install_scripts(project_dir)
    _drop_reports(project_dir)

    if _needs_install(project_dir):
        on_log("📦 Установка зависимостей перед приёмкой...\n")
        pnpm = pkgstore.ensure_pnpm(on_log)
        pkgstore.ensure_project_config(project_dir)
        install_cmd = [str(pnpm), "install"] if pnpm else [_npm(), "install"]
        code, tail = _run(install_cmd, project_dir, on_log, stop_check, INSTALL_TIMEOUT)
        report.stages["install"] = code
        if code != 0:
            report.blockers.append(f"установка зависимостей завершилась с кодом {code}")
            report.log_tail = tail
            report.seconds = int(time.time() - started)
            return report

    if stop_check and stop_check():
        report.blockers.append("прогон остановлен пользователем")
        return report

    on_log("🔍 Статическая приёмка: node scripts/check-spec.mjs\n")
    code, spec_tail = _run([_node(), "scripts/check-spec.mjs"], project_dir,
                           on_log, stop_check, SPEC_TIMEOUT)
    report.stages["spec"] = code
    spec_data = _read_report(project_dir, SPEC_REPORT)
    if spec_data:
        report.spec = [
            GateCheck(id=str(c.get("id", "?")), title=str(c.get("text", "")),
                      ok=c.get("ok"), note="; ".join(c.get("hits") or [])[:400])
            for c in spec_data.get("checks", [])
        ]
    else:
        # Отчёта нет — значит скрипт не дошёл до конца, чем бы ни кончился код
        # возврата. Провалившаяся проверка тоже даёт единицу, и без этой ветки
        # сорванный прогон выглядел бы как «провалено 0 проверок»: ровно тот
        # самый отчёт ни о чём, ради борьбы с которым всё и затевалось.
        report.blockers.append(f"check-spec.mjs не оставил отчёта (код {code})")

    if stop_check and stop_check():
        report.blockers.append("прогон остановлен пользователем")
        return report

    smoke_tail = ""
    if with_smoke:
        on_log("🕹️ Дымовой запуск: node scripts/smoke.mjs\n")
        code, smoke_tail = _run([_node(), "scripts/smoke.mjs"], project_dir,
                                on_log, stop_check, SMOKE_TIMEOUT)
        report.stages["smoke"] = code
        smoke_data = _read_report(project_dir, SMOKE_REPORT)
        if smoke_data:
            report.smoke = [
                GateCheck(id=str(c.get("id", "?")), title=str(c.get("title", "")),
                          ok=c.get("ok"), note=str(c.get("note", ""))[:400])
                for c in smoke_data.get("checks", [])
            ]
            report.metrics = smoke_data.get("metrics") or {}
        else:
            report.blockers.append(f"smoke.mjs не оставил отчёта (код {code})")

    report.log_tail = (spec_tail + smoke_tail)[-4000:]
    report.seconds = int(time.time() - started)
    return report


def write_gate_report(project_dir: Path, report: GateReport) -> None:
    """Складывает итог приёмки рядом с игрой — для витрины и для истории."""
    target = project_dir / FACTORY_DIR
    target.mkdir(parents=True, exist_ok=True)
    path = target / "gate.json"
    history: List[dict] = []
    if path.exists():
        try:
            previous = json.loads(path.read_text(encoding="utf-8"))
            history = previous.get("history", []) if isinstance(previous, dict) else []
        except (OSError, ValueError):
            history = []
    entry = report.as_dict()
    entry["at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    history.append(entry)
    payload = {"last": entry, "history": history[-40:]}
    try:
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass


def stamp_generation(project_dir: Path, report: GateReport) -> None:
    """Проставляет итог приёмки в generation.json игры.

    Карточка генерации до сих пор носила только оценки модели, поставленные
    ей самой себе до кодогенерации. Теперь рядом лежит то, что проверено
    запуском, и одно от другого отличимо.
    """
    path = project_dir / "generation.json"
    if not path.exists():
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    if not isinstance(data, dict):
        return
    data["gate"] = {
        "ok": report.ok,
        "summary": report.summary(),
        "phase": report.phase,
        "failed": [c.id for c in report.failures],
        "metrics": report.metrics,
        "at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    try:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass


def accepted_phases(project_dir: Path) -> List[str]:
    """Фазы, которые в этом проекте уже проходили приёмку зелёными.

    Нужно для повторного запуска: прогон мог оборваться на третьей фазе, и
    заново писать ядро, которое машина уже приняла, — это сожжённые впустую
    вызовы агента и переписанный работающий код.
    """
    path = project_dir / FACTORY_DIR / "gate.json"
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    if not isinstance(data, dict):
        return []
    done: List[str] = []
    for entry in data.get("history", []) or []:
        if entry.get("ok") and entry.get("phase") and entry["phase"] not in done:
            done.append(entry["phase"])
    return done


def read_gate(project_dir: Path) -> Optional[dict]:
    """Последний итог приёмки игры — то, чем карточка проекта отличается от обещания."""
    path = project_dir / FACTORY_DIR / "gate.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    last = data.get("last")
    return last if isinstance(last, dict) else None
