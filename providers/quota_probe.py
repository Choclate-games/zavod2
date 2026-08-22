"""
Живые квоты Antigravity.

Antigravity отдаёт реальные остатки квот по моделям через Connect-RPC:

    POST http(s)://127.0.0.1:<порт>/exa.language_server_pb.LanguageServerService/GetUserStatus

Сервер поднимает **и IDE** (отдельный процесс `language_server*`, там нужен
csrf-токен из аргументов процесса), **и сам `agy.exe`** — CLI слушает пару
локальных портов и отвечает на тот же запрос без токена. Раньше искался только
процесс с именем `language_server` и только по https, поэтому при запущенном
agy фабрика считала, что живых данных нет, и рисовала вместо них локальный
счётчик запусков — то есть заведомо неверные проценты.

Поэтому: кандидатов ищем по нескольким именам процессов, csrf-токен подставляем
только если он вообще есть, и пробуем оба протокола (у agy один порт https,
другой — http). Сертификат самоподписанный, проверка TLS отключена: соединение
строго на 127.0.0.1.

Последний удачный ответ сохраняется на диск (`.agy_quota_live.json`): когда ни
IDE, ни agy не запущены, честнее показать «данные от 13:40», чем выдуманные
проценты по числу запусков.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

CSRF_RE = re.compile(r"--csrf[_-]?token[=\s]+([a-f0-9-]{8,})", re.IGNORECASE)
SERVICE = "/exa.language_server_pb.LanguageServerService"
# Тот же ответ, что печатает `/usage` в самом agy: по каждой группе моделей
# отдельно недельное и пятичасовое окно. GetUserStatus отдаёт только одно
# «актуальное» окно на модель — из-за него недельного лимита не было видно.
QUOTA_SUMMARY = f"{SERVICE}/RetrieveUserQuotaSummary"
GET_USER_STATUS = f"{SERVICE}/GetUserStatus"

# Две группы, как в терминале agy: всё, что не Gemini, считается «Claude и GPT».
GROUP_GEMINI = "gemini"
GROUP_CLAUDE = "claude"
GROUP_TITLES = {
    GROUP_GEMINI: "GEMINI MODELS",
    GROUP_CLAUDE: "CLAUDE AND GPT MODELS",
}


def model_group(name: str) -> str:
    return GROUP_GEMINI if "gemini" in (name or "").lower() else GROUP_CLAUDE


def _run(cmd: List[str], timeout: int = 10) -> str:
    flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout,
            creationflags=flags, encoding="utf-8", errors="replace",
        )
        return proc.stdout or ""
    except (OSError, subprocess.SubprocessError):
        return ""


def _find_servers() -> List[Dict[str, Any]]:
    """
    Процессы, которые могут отвечать на GetUserStatus: language server IDE и agy.

    Сначала идёт language server (он живёт дольше и знает csrf-токен), затем
    сам CLI. Токен необязателен: agy отвечает и без него.
    """
    found: List[Dict[str, Any]] = []
    if sys.platform == "win32":
        raw = _run([
            "powershell", "-NoProfile", "-Command",
            "Get-CimInstance Win32_Process | Where-Object {$_.Name -match "
            "'language_server|antigravity|^agy'} | "
            "Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress",
        ], timeout=20)
        if not raw.strip():
            return []
        try:
            data = json.loads(raw)
        except ValueError:
            return []
        for proc in (data if isinstance(data, list) else [data]):
            name = str(proc.get("Name") or "")
            match = CSRF_RE.search(str(proc.get("CommandLine") or ""))
            try:
                pid = int(proc.get("ProcessId"))
            except (TypeError, ValueError):
                continue
            found.append({"pid": pid, "name": name,
                          "token": match.group(1) if match else ""})
    else:
        raw = _run(["bash", "-lc",
                    "ps -axo pid,comm,args | grep -Ei 'language_server|antigravity|agy' "
                    "| grep -v grep"], timeout=20)
        for line in raw.splitlines():
            pid_match = re.match(r"\s*(\d+)", line)
            if not pid_match:
                continue
            match = CSRF_RE.search(line)
            found.append({"pid": int(pid_match.group(1)), "name": line[:60],
                          "token": match.group(1) if match else ""})

    found.sort(key=lambda item: 0 if "language_server" in item["name"].lower() else 1)
    return found[:8]


def _listening_ports(pid: int) -> List[int]:
    if sys.platform == "win32":
        raw = _run([
            "powershell", "-NoProfile", "-Command",
            f"Get-NetTCPConnection -OwningProcess {pid} -State Listen -ErrorAction SilentlyContinue | "
            "Select-Object -ExpandProperty LocalPort",
        ], timeout=15)
    else:
        raw = _run(["bash", "-lc", f"lsof -nP -iTCP -sTCP:LISTEN -a -p {pid} | awk '{{print $9}}'"], timeout=15)

    ports: List[int] = []
    for token in re.findall(r"\d+", raw):
        port = int(token)
        if 0 < port < 65536 and port not in ports:
            ports.append(port)
    return ports[:32]


def _post(scheme: str, port: int, headers: Dict[str, str],
          method: str = QUOTA_SUMMARY) -> Optional[Dict[str, Any]]:
    """Один запрос к серверу. Бросает SSLError — значит, порт не TLS."""
    resp = requests.post(
        f"{scheme}://127.0.0.1:{port}{method}",
        headers=headers,
        json={"metadata": {"ideName": "antigravity"}},
        verify=False,
        timeout=5,
    )
    if resp.status_code != 200:
        return None
    try:
        return resp.json()
    except ValueError:
        return None


def _query(port: int, token: str, scheme: Optional[str] = None,
           method: str = QUOTA_SUMMARY) -> Optional[Dict[str, Any]]:
    """
    Ответ GetUserStatus с этого порта.

    Начинаем с https и переходим на http **только** после ошибки TLS: это
    единственный признак того, что порт слушает открытым текстом. Слепой
    перебор «сначала https, потом http на любой отказ» бил обычным HTTP по
    TLS-порту, и agy писал в свой терминал
    «client sent an HTTP request to an HTTPS server» — прямо поверх работы
    пользователя.
    """
    headers = {"Content-Type": "application/json", "Connect-Protocol-Version": "1"}
    if token:
        headers["X-Codeium-Csrf-Token"] = token

    order = (scheme,) if scheme in ("http", "https") else ("https",)
    for attempt in order:
        try:
            payload = _post(attempt, port, headers, method)
        except requests.exceptions.SSLError:
            # Порт отвечает открытым текстом — на нём http безопасен.
            try:
                payload = _post("http", port, headers, method)
            except (requests.RequestException, ValueError):
                return None
            if payload:
                _remember_endpoint(port, "http")
            return payload
        except (requests.RequestException, ValueError):
            return None
        if payload:
            _remember_endpoint(port, attempt)
            return payload
    return None


def _parse_reset(raw: Optional[str]) -> Optional[datetime]:
    if not raw or not isinstance(raw, str):
        return None
    text = raw.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _humanize(delta_seconds: int) -> str:
    if delta_seconds <= 0:
        return "—"
    hours, minutes = divmod(delta_seconds // 60, 60)
    return f"{hours}ч {minutes:02d}м" if hours else f"{minutes}м"


def read_live_quota() -> Optional[Dict[str, Any]]:
    """
    Реальные остатки квот по группам моделей либо None, если сервер недоступен.

    Формат:
        {"source": "language-server",
         "groups": {"gemini": {...}, "claude": {...}},
         "models": [{"label", "group", "percent", "reset_in", "reset_at"}, ...]}
    """
    payload, owner = None, ""

    # Порт и протокол прошлого удачного ответа: если сервер тот же, ходим
    # сразу туда и не трогаем соседние порты вообще.
    known = _known_endpoint()
    if known:
        payload = _query(known["port"], known.get("token", ""), known.get("scheme"))
        if payload:
            owner = known.get("owner") or "language-server"

    for server in ([] if payload else _find_servers()):
        for port in _listening_ports(server["pid"]):
            payload = _query(port, server["token"])
            if payload:
                owner = server["name"] or "language-server"
                # Имя владельца и токен запоминаются вместе с портом: следующий
                # опрос идёт прямо туда, без перебора соседних портов.
                _LAST_ENDPOINT.update({"owner": owner, "token": server["token"]})
                break
        if payload:
            break

    if not payload:
        return cached_live_quota()

    groups = _parse_groups(payload)
    if not groups:
        return cached_live_quota()

    snapshot = {
        "endpoint": _LAST_ENDPOINT,
        "source": owner or "language-server",
        "fresh": True,
        "checked_at": datetime.now().strftime("%H:%M:%S"),
        "checked_ts": datetime.now().timestamp(),
        "groups": groups,
    }
    _save_snapshot(snapshot)
    return snapshot


def _parse_groups(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Группы моделей с обоими окнами лимита.

    Ответ RetrieveUserQuotaSummary — это то же, что печатает `/usage`:
    у каждой группы список корзин (`buckets`), по одной на окно. Порядок
    корзин делаем как везде в фабрике: сначала короткое окно, потом длинные.
    """
    response = payload.get("response") or payload
    now = datetime.now(timezone.utc)
    groups: Dict[str, Any] = {}

    for group in response.get("groups") or []:
        title = str(group.get("displayName") or "").strip()
        key = model_group(title)
        buckets = []
        for bucket in group.get("buckets") or []:
            fraction = bucket.get("remainingFraction")
            if not isinstance(fraction, (int, float)):
                continue
            reset_at = _parse_reset(bucket.get("resetTime"))
            reset_seconds = int((reset_at - now).total_seconds()) if reset_at else 0
            buckets.append({
                "id": str(bucket.get("bucketId") or ""),
                "window": str(bucket.get("window") or ""),
                "label": _bucket_title(bucket),
                "percent": max(0.0, min(1.0, float(fraction))) * 100,
                "reset_in": _humanize(reset_seconds),
                "reset_at": reset_at.astimezone().strftime("%d.%m %H:%M") if reset_at else "—",
                "reset_seconds": max(0, reset_seconds),
                "note": str(bucket.get("description") or ""),
            })
        if not buckets:
            continue

        buckets.sort(key=lambda b: 0 if b["window"] == "5h" else 1)
        worst = min(buckets, key=lambda b: b["percent"])
        groups[key] = {
            "title": title or GROUP_TITLES[key],
            "description": str(group.get("description") or ""),
            "buckets": buckets,
            # «Процент группы» — самое узкое место: по нему считается сводка
            # в боковой панели и красный порог.
            "percent": worst["percent"],
            "reset_in": worst["reset_in"],
            "reset_at": worst["reset_at"],
            "model_names": str(group.get("description") or "").replace(
                "Models within this group: ", ""),
        }
    return groups


_WINDOW_TITLES_RU = {"5h": "5 часов — остаток", "weekly": "Неделя — остаток"}


def _bucket_title(bucket: Dict[str, Any]) -> str:
    """Подпись окна по-русски (английская из ответа — как запасной вариант)."""
    window = str(bucket.get("window") or "")
    return _WINDOW_TITLES_RU.get(window) or str(bucket.get("displayName") or window or "лимит")


# ---------------------------------------------------------------------------
# Снимок последнего удачного ответа
# ---------------------------------------------------------------------------

_LAST_ENDPOINT: Dict[str, Any] = {}


def _remember_endpoint(port: int, scheme: str) -> None:
    _LAST_ENDPOINT.update({"port": port, "scheme": scheme})


def _known_endpoint() -> Optional[Dict[str, Any]]:
    """Точка входа прошлого удачного ответа (из памяти процесса или снимка)."""
    if _LAST_ENDPOINT.get("port"):
        return dict(_LAST_ENDPOINT)
    if not SNAPSHOT_PATH.is_file():
        return None
    try:
        with open(SNAPSHOT_PATH, "r", encoding="utf-8") as f:
            endpoint = (json.load(f) or {}).get("endpoint")
    except (OSError, ValueError):
        return None
    return endpoint if isinstance(endpoint, dict) and endpoint.get("port") else None


SNAPSHOT_PATH = Path(__file__).resolve().parent.parent / ".agy_quota_live.json"
SNAPSHOT_TTL_HOURS = 48


def _save_snapshot(data: Dict[str, Any]) -> None:
    try:
        with open(SNAPSHOT_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except OSError:
        pass


def cached_live_quota() -> Optional[Dict[str, Any]]:
    """
    Последний удачный ответ сервера, если он не слишком старый.

    Проценты в нём настоящие, просто снятые раньше — это честнее, чем
    подставлять локальный счётчик запусков и называть его квотой. Возраст
    снимка возвращается рядом, чтобы интерфейс мог его показать.
    """
    if not SNAPSHOT_PATH.is_file():
        return None
    try:
        with open(SNAPSHOT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict) or not data.get("groups"):
        return None

    stamp = float(data.get("checked_ts") or 0)
    age = datetime.now().timestamp() - stamp if stamp else None
    if age is not None and age > SNAPSHOT_TTL_HOURS * 3600:
        return None

    data["fresh"] = False
    data["age_str"] = _age_str(age)
    return data


def _age_str(age_seconds: Optional[float]) -> str:
    if age_seconds is None:
        return "давно"
    minutes = int(age_seconds // 60)
    if minutes < 60:
        return f"{max(1, minutes)} мин назад"
    hours, minutes = divmod(minutes, 60)
    return f"{hours} ч {minutes:02d} мин назад"
