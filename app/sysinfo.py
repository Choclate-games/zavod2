"""
Состояние машины, на которой крутится фабрика: нагрузка, память, диск, нагрев.

Зачем это в интерфейсе. Фабрика переехала на мини-ПК, а мини-ПК — это четыре
ядра, семь гигабайт памяти и пассивное охлаждение в тесном корпусе. На той же
машине живут два раннера организации. Когда студия ведёт десять прогонов
разом, каждый со своим агентом и своим vite, вопрос «почему всё встало»
имеет ровно три возможных ответа: кончились ядра, кончилась память или
процессор ушёл в троттлинг от нагрева. Увидеть это надо не по ssh, а там же,
где стоит кнопка «Генерировать».

Две тонкости, из-за которых модуль сложнее, чем «спросить psutil».

Первая: фабрика работает в контейнере. `/proc/meminfo` внутри показывает
память ХОСТА, а не лимит контейнера — а лимит у неё 3 ГБ (mem_limit в
compose.yml). Поэтому память читается дважды: цифры хоста и отдельно цифры
cgroup, и в интерфейс уходят обе. «Занято 2.9 из 3 ГБ» и «занято 2.9 из 7.5»
означают совершенно разное.

Вторая: температура. Внутри контейнера `/sys/class/thermal` виден и читается —
это состояние хоста, и именно оно нужно. Никаких прав для этого не требуется,
том пробрасывать не надо.

Модуль не имеет права выбрасывать исключения: это панель состояния, а не
рабочий узел. Всё, что не прочиталось, отдаётся как None и рисуется прочерком.
"""

from __future__ import annotations

import os
import platform
import shutil
import socket
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import psutil
except ImportError:      # pragma: no cover - зависит от окружения
    psutil = None        # type: ignore[assignment]


CGROUP_ROOT = Path("/sys/fs/cgroup")
THERMAL_ROOT = Path("/sys/class/thermal")
HWMON_ROOT = Path("/sys/class/hwmon")

# Процессы в топе. Пять — столько, сколько помещается в панель, не заставляя
# её скроллиться.
TOP_PROCESSES = 5


def _read_text(path: Path) -> Optional[str]:
    try:
        return path.read_text(encoding="utf-8", errors="replace").strip()
    except (OSError, ValueError):
        return None


def _read_int(path: Path) -> Optional[int]:
    raw = _read_text(path)
    if raw is None:
        return None
    try:
        return int(raw.split()[0])
    except (ValueError, IndexError):
        return None


def in_container() -> bool:
    """Контейнер или голая машина. Влияет только на подписи в интерфейсе."""
    if Path("/.dockerenv").exists():
        return True
    cgroup = _read_text(Path("/proc/self/cgroup")) or ""
    return "docker" in cgroup or "containerd" in cgroup


# ── Процессор ───────────────────────────────────────────────────────────────

def _cpu() -> Dict[str, Any]:
    data: Dict[str, Any] = {
        "cores": os.cpu_count() or 0,
        "percent": None,
        "per_core": [],
        "load": None,
        "quota": None,
    }
    if psutil is not None:
        try:
            # interval=None — процент с момента прошлого вызова. Панель
            # опрашивается раз в несколько секунд, то есть это ровно средняя
            # нагрузка за интервал между двумя обновлениями. Блокирующий
            # вариант (interval=1) задержал бы ответ на секунду.
            data["percent"] = round(float(psutil.cpu_percent(interval=None)), 1)
            data["per_core"] = [round(float(v), 1)
                                for v in psutil.cpu_percent(interval=None, percpu=True)]
        except Exception:
            pass
    try:
        one, five, fifteen = os.getloadavg()
        data["load"] = [round(one, 2), round(five, 2), round(fifteen, 2)]
    except (OSError, AttributeError):
        pass   # Windows не умеет loadavg

    # Потолок контейнера: "макс период" либо "max период". cpus: 2.5 в
    # compose превращается в 250000/100000.
    raw = _read_text(CGROUP_ROOT / "cpu.max")
    if raw:
        parts = raw.split()
        if len(parts) == 2 and parts[0] != "max":
            try:
                data["quota"] = round(int(parts[0]) / int(parts[1]), 2)
            except (ValueError, ZeroDivisionError):
                pass
    return data


# ── Память ──────────────────────────────────────────────────────────────────

def _meminfo() -> Dict[str, int]:
    values: Dict[str, int] = {}
    raw = _read_text(Path("/proc/meminfo"))
    if not raw:
        return values
    for line in raw.splitlines():
        key, _, rest = line.partition(":")
        try:
            values[key.strip()] = int(rest.split()[0]) * 1024
        except (ValueError, IndexError):
            continue
    return values


def _memory() -> Dict[str, Any]:
    data: Dict[str, Any] = {"total": None, "used": None, "available": None,
                            "percent": None, "swap_total": None, "swap_used": None,
                            "limit": None, "limit_used": None, "limit_percent": None}

    info = _meminfo()
    if info:
        total = info.get("MemTotal")
        available = info.get("MemAvailable")
        if total:
            data["total"] = total
            data["available"] = available
            if available is not None:
                data["used"] = total - available
                data["percent"] = round((total - available) * 100.0 / total, 1)
        swap_total = info.get("SwapTotal")
        if swap_total:
            data["swap_total"] = swap_total
            free = info.get("SwapFree") or 0
            data["swap_used"] = swap_total - free
    elif psutil is not None:                     # Windows и всё, где нет /proc
        try:
            vm = psutil.virtual_memory()
            data.update(total=vm.total, used=vm.used,
                        available=vm.available, percent=round(vm.percent, 1))
            sw = psutil.swap_memory()
            data.update(swap_total=sw.total, swap_used=sw.used)
        except Exception:
            pass

    # Лимит контейнера. Он и есть настоящий потолок для фабрики: превышение
    # означает OOM-kill процесса, а не уход хоста в swap.
    limit = _read_text(CGROUP_ROOT / "memory.max")
    used = _read_int(CGROUP_ROOT / "memory.current")
    if limit and limit != "max":
        try:
            limit_bytes = int(limit)
        except ValueError:
            limit_bytes = 0
        if limit_bytes and used is not None:
            data["limit"] = limit_bytes
            data["limit_used"] = used
            data["limit_percent"] = round(used * 100.0 / limit_bytes, 1)
    return data


# ── Диск ────────────────────────────────────────────────────────────────────

def _disk(paths: Dict[str, Path]) -> List[Dict[str, Any]]:
    seen: set = set()
    result: List[Dict[str, Any]] = []
    for label, path in paths.items():
        try:
            usage = shutil.disk_usage(str(path))
        except OSError:
            continue
        # Workspace и архивы обычно на одном разделе — второй раз тот же
        # столбик рисовать незачем.
        key = (usage.total, usage.free)
        if key in seen:
            continue
        seen.add(key)
        result.append({
            "label": label,
            "path": str(path),
            "total": usage.total,
            "used": usage.total - usage.free,
            "free": usage.free,
            "percent": round((usage.total - usage.free) * 100.0 / usage.total, 1)
            if usage.total else 0.0,
        })
    return result


# ── Температура ─────────────────────────────────────────────────────────────

def _temperatures() -> List[Dict[str, Any]]:
    """
    Датчики в градусах Цельсия.

    Сначала /sys напрямую, и только потом psutil. Порядок такой не случайно:
    внутри контейнера `psutil.sensors_temperatures()` возвращает пусто, а
    файлы `/sys/class/thermal` читаются прекрасно — там лежит температура
    хоста, ровно то, что нужно.
    """
    sensors: List[Dict[str, Any]] = []

    if THERMAL_ROOT.is_dir():
        try:
            zones = sorted(THERMAL_ROOT.glob("thermal_zone*"))
        except OSError:
            zones = []
        for zone in zones:
            milli = _read_int(zone / "temp")
            if milli is None:
                continue
            label = _read_text(zone / "type") or zone.name
            sensors.append({"label": label, "value": round(milli / 1000.0, 1)})

    if not sensors and HWMON_ROOT.is_dir():
        try:
            mons = sorted(HWMON_ROOT.glob("hwmon*"))
        except OSError:
            mons = []
        for mon in mons:
            name = _read_text(mon / "name") or mon.name
            for entry in sorted(mon.glob("temp*_input")):
                milli = _read_int(entry)
                if milli is None:
                    continue
                sub = _read_text(entry.with_name(entry.name.replace("_input", "_label")))
                sensors.append({"label": f"{name} {sub}".strip() if sub else name,
                                "value": round(milli / 1000.0, 1)})

    if not sensors and psutil is not None and hasattr(psutil, "sensors_temperatures"):
        try:
            for name, entries in (psutil.sensors_temperatures() or {}).items():
                for entry in entries:
                    if entry.current is None:
                        continue
                    sensors.append({"label": entry.label or name,
                                    "value": round(float(entry.current), 1)})
        except Exception:
            pass
    return sensors


def _fans() -> List[Dict[str, Any]]:
    fans: List[Dict[str, Any]] = []
    if not HWMON_ROOT.is_dir():
        return fans
    try:
        mons = sorted(HWMON_ROOT.glob("hwmon*"))
    except OSError:
        return fans
    for mon in mons:
        name = _read_text(mon / "name") or mon.name
        for entry in sorted(mon.glob("fan*_input")):
            rpm = _read_int(entry)
            if rpm is None:
                continue
            fans.append({"label": name, "rpm": rpm})
    return fans


# ── Процессы ────────────────────────────────────────────────────────────────

# psutil считает загрузку процесса как разницу между двумя обращениями к
# одному и тому же объекту Process. Поэтому объекты переживают вызов: иначе
# каждый опрос честно возвращал бы ноль.
_proc_cache: Dict[int, Any] = {}


def _processes() -> List[Dict[str, Any]]:
    if psutil is None:
        return []
    rows: List[Dict[str, Any]] = []
    alive: set = set()
    try:
        for proc in psutil.process_iter(["pid", "name"]):
            pid = proc.info["pid"]
            alive.add(pid)
            cached = _proc_cache.get(pid)
            if cached is None:
                cached = proc
                _proc_cache[pid] = proc
                cached.cpu_percent(None)     # первый вызов задаёт точку отсчёта
            try:
                cpu = cached.cpu_percent(None)
                mem = cached.memory_info().rss
                name = cached.name()
            except Exception:
                continue
            rows.append({"pid": pid, "name": name,
                         "cpu": round(float(cpu), 1), "memory": int(mem)})
    except Exception:
        return []
    for pid in list(_proc_cache):
        if pid not in alive:
            _proc_cache.pop(pid, None)
    rows.sort(key=lambda row: (row["cpu"], row["memory"]), reverse=True)
    return rows[:TOP_PROCESSES]


# ── Сводка ──────────────────────────────────────────────────────────────────

def _uptime() -> Optional[int]:
    raw = _read_text(Path("/proc/uptime"))
    if raw:
        try:
            return int(float(raw.split()[0]))
        except (ValueError, IndexError):
            pass
    if psutil is not None:
        try:
            return int(time.time() - psutil.boot_time())
        except Exception:
            pass
    return None


def snapshot(paths: Optional[Dict[str, Path]] = None) -> Dict[str, Any]:
    """
    Полное состояние машины одним словарём.

    Аргумент `paths` — что именно мерить по диску: у фабрики это workspace и
    каталог упакованных игр, и оба задаются в .env, поэтому приходят снаружи.
    """
    if paths is None:
        paths = {"Диск": Path(".")}
    try:
        return {
            "ok": True,
            "host": socket.gethostname(),
            "platform": f"{platform.system()} {platform.release()}",
            "python": platform.python_version(),
            "container": in_container(),
            "uptime": _uptime(),
            "cpu": _cpu(),
            "memory": _memory(),
            "disks": _disk(paths),
            "temperatures": _temperatures(),
            "fans": _fans(),
            "processes": _processes(),
            "psutil": psutil is not None,
            "measured_at": time.time(),
        }
    except Exception as exc:      # панель состояния не имеет права падать
        return {"ok": False, "message": str(exc), "measured_at": time.time()}
