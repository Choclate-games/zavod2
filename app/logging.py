import sys
from rich.console import Console
from rich.theme import Theme

# Ensure utf-8 output on Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

custom_theme = Theme({
    "info": "cyan",
    "warning": "yellow",
    "error": "bold red",
    "success": "bold green",
    "agent": "bold magenta",
    "highlight": "bold cyan",
    "step": "bold blue",
})

console = Console(theme=custom_theme, legacy_windows=False)
error_console = Console(stderr=True, theme=custom_theme, legacy_windows=False)

_log_listeners = []

def register_log_listener(callback):
    """Registers a listener callback: fn(level: str, message: str)"""
    if callback not in _log_listeners:
        _log_listeners.append(callback)

def unregister_log_listener(callback):
    """Unregisters a listener callback."""
    if callback in _log_listeners:
        _log_listeners.remove(callback)

def _dispatch(level: str, text: str):
    for listener in list(_log_listeners):
        try:
            listener(level, text)
        except Exception:
            pass

def log_info(msg: str):
    console.print(f"[info][INFO][/info] {msg}")
    _dispatch("INFO", msg)

def log_success(msg: str):
    console.print(f"[success][OK][/success] {msg}")
    _dispatch("SUCCESS", msg)

def log_warning(msg: str):
    console.print(f"[warning][WARN][/warning] {msg}")
    _dispatch("WARN", msg)

def log_error(msg: str):
    error_console.print(f"[error][ERROR][/error] {msg}")
    _dispatch("ERROR", msg)

def log_agent(agent_name: str, msg: str):
    console.print(f"[agent]>> [{agent_name}][/agent] {msg}")
    _dispatch("AGENT", f"[{agent_name}] {msg}")

