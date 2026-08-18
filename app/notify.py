"""
Системные уведомления Windows.

Задачи агента идут долго, окно фабрики обычно свёрнуто, поэтому о завершении
чата сообщает штатный тост Windows (центр уведомлений), а не самодельное окно.
Тост показывается через WinRT из PowerShell: сторонних пакетов не требуется, а
AppUserModelID берём у самого PowerShell — иначе Windows молча отбрасывает
уведомление от незарегистрированного приложения.

Если тост показать не удалось (не Windows, отключён PowerShell, политика
запуска), вызывается ``on_fallback`` — GUI рисует своё окошко.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import threading
from pathlib import Path
from typing import Callable, Optional

ENV_KEY = "NOTIFICATIONS_ENABLED"

# AUMID ярлыка Windows PowerShell — зарегистрирован в системе по умолчанию.
POWERSHELL_AUMID = r"{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe"

_PS_TEMPLATE = """
$ErrorActionPreference = 'Stop'
[void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
[void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]

$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(
    [Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$texts = $template.GetElementsByTagName('text')
[void]$texts.Item(0).AppendChild($template.CreateTextNode({title}))
[void]$texts.Item(1).AppendChild($template.CreateTextNode({message}))

$toast = [Windows.UI.Notifications.ToastNotification]::new($template)
$toast.Tag = 'zavod2'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier({aumid}).Show($toast)
"""


def _ps_literal(text: str) -> str:
    """Строка для PowerShell в одинарных кавычках (внутри они удваиваются)."""
    return "'" + (text or "").replace("'", "''") + "'"


def notifications_enabled() -> bool:
    raw = os.getenv(ENV_KEY, "1").strip().lower()
    return raw not in ("0", "false", "no", "off", "")


def set_notifications_enabled(enabled: bool) -> None:
    os.environ[ENV_KEY] = "1" if enabled else "0"


def send(title: str, message: str, on_fallback: Optional[Callable[[], None]] = None) -> None:
    """Показывает системный тост в фоне; при неудаче зовёт ``on_fallback``."""
    if not notifications_enabled():
        return

    def run() -> None:
        if not _send_windows_toast(title, message) and on_fallback is not None:
            try:
                on_fallback()
            except Exception:
                pass

    threading.Thread(target=run, daemon=True).start()


def _send_windows_toast(title: str, message: str) -> bool:
    if sys.platform != "win32":
        return False

    script = _PS_TEMPLATE.format(
        title=_ps_literal(title),
        message=_ps_literal(message[:220]),
        aumid=_ps_literal(POWERSHELL_AUMID),
    )

    tmp_path: Optional[Path] = None
    try:
        # PowerShell -Command плохо переваривает многострочный WinRT-скрипт,
        # поэтому кладём его во временный .ps1.
        with tempfile.NamedTemporaryFile("w", suffix=".ps1", delete=False, encoding="utf-8-sig") as tmp:
            tmp.write(script)
            tmp_path = Path(tmp.name)

        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive",
             "-ExecutionPolicy", "Bypass", "-File", str(tmp_path)],
            capture_output=True, text=True, timeout=15,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        return result.returncode == 0
    except Exception:
        return False
    finally:
        if tmp_path is not None:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass
