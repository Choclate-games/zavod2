"""
Живые квоты Antigravity.

Antigravity (и agy CLI, и IDE) держит локальный language server, который отдаёт
реальные остатки квот по моделям через Connect-RPC:

    POST https://127.0.0.1:<порт>/exa.language_server_pb.LanguageServerService/GetUserStatus
    X-Codeium-Csrf-Token: <токен из командной строки процесса>

Порт и csrf-токен нигде не записаны — их берут из аргументов запущенного
процесса language_server. Сертификат самоподписанный, поэтому проверка TLS
отключена: соединение строго на 127.0.0.1 и авторизуется csrf-токеном.

Если IDE/сервер не запущен, вернётся None — GUI в этом случае показывает
локальный счётчик запросов (см. AGYQuotaTracker) вместо настоящих процентов.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

CSRF_RE = re.compile(r"--csrf[_-]?token[=\s]+([a-f0-9-]{8,})", re.IGNORECASE)
GET_USER_STATUS = "/exa.language_server_pb.LanguageServerService/GetUserStatus"

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


def _find_language_server() -> Optional[Dict[str, Any]]:
    """PID и csrf-токен запущенного language server Antigravity."""
    if sys.platform == "win32":
        raw = _run([
            "powershell", "-NoProfile", "-Command",
            "Get-CimInstance Win32_Process | Where-Object {$_.Name -like '*language_server*'} | "
            "Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
        ], timeout=15)
        if not raw.strip():
            return None
        try:
            data = json.loads(raw)
        except ValueError:
            return None
        processes = data if isinstance(data, list) else [data]
        for proc in processes:
            match = CSRF_RE.search(str(proc.get("CommandLine") or ""))
            if match:
                return {"pid": int(proc.get("ProcessId")), "token": match.group(1)}
        return None

    raw = _run(["bash", "-lc", "ps -axo pid,args | grep -i language_server | grep -v grep"], timeout=15)
    for line in raw.splitlines():
        match = CSRF_RE.search(line)
        pid_match = re.match(r"\s*(\d+)", line)
        if match and pid_match:
            return {"pid": int(pid_match.group(1)), "token": match.group(1)}
    return None


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


def _query(port: int, token: str) -> Optional[Dict[str, Any]]:
    try:
        resp = requests.post(
            f"https://127.0.0.1:{port}{GET_USER_STATUS}",
            headers={
                "Content-Type": "application/json",
                "Connect-Protocol-Version": "1",
                "X-Codeium-Csrf-Token": token,
            },
            json={"metadata": {"ideName": "antigravity"}},
            verify=False,
            timeout=5,
        )
        if resp.status_code != 200:
            return None
        return resp.json()
    except (requests.RequestException, ValueError):
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
    beacon = _find_language_server()
    if not beacon:
        return None

    payload = None
    for port in _listening_ports(beacon["pid"]):
        payload = _query(port, beacon["token"])
        if payload:
            break
    if not payload:
        return None

    configs = (
        payload.get("userStatus", {})
        .get("cascadeModelConfigData", {})
        .get("clientModelConfigs", [])
    )
    now = datetime.now(timezone.utc)
    models: List[Dict[str, Any]] = []

    for cfg in configs:
        label = str(cfg.get("label") or "").strip()
        if not label:
            continue
        quota = cfg.get("quotaInfo") or {}
        fraction = quota.get("remainingFraction")
        percent = max(0.0, min(1.0, float(fraction))) * 100 if isinstance(fraction, (int, float)) else 0.0
        reset_at = _parse_reset(quota.get("resetTime"))
        reset_seconds = int((reset_at - now).total_seconds()) if reset_at else 0
        models.append({
            "label": label,
            "model": str((cfg.get("modelOrAlias") or {}).get("model") or label),
            "group": model_group(label),
            "percent": percent,
            "reset_in": _humanize(reset_seconds),
            "reset_at": reset_at.astimezone().strftime("%d.%m %H:%M") if reset_at else "—",
            "reset_seconds": max(0, reset_seconds),
        })

    if not models:
        return None

    groups: Dict[str, Any] = {}
    for key in (GROUP_GEMINI, GROUP_CLAUDE):
        items = [m for m in models if m["group"] == key]
        if not items:
            continue
        # Показываем самое «узкое место» группы — модель с наименьшим остатком.
        worst = min(items, key=lambda m: m["percent"])
        groups[key] = {
            "title": GROUP_TITLES[key],
            "percent": worst["percent"],
            "reset_in": worst["reset_in"],
            "reset_at": worst["reset_at"],
            "models": items,
            "model_names": ", ".join(sorted({m["label"] for m in items})),
        }

    return {
        "source": "language-server",
        "checked_at": datetime.now().strftime("%H:%M:%S"),
        "groups": groups,
        "models": models,
    }
