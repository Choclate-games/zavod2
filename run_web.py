"""
Запуск веб-фабрики: python run_web.py

Поднимает локальный сервер (FastAPI + uvicorn) и открывает интерфейс в браузере.
Порт берётся из .env (GUI_PORT), при занятости выбирается следующий свободный.

Флаги:
    --no-browser     не открывать браузер автоматически
    --host / --port  переопределить адрес
"""

from __future__ import annotations

import argparse
import socket
import sys
import threading
import time
import webbrowser


def _free_port(host: str, port: int, attempts: int = 20) -> int:
    """Первый свободный порт начиная с указанного."""
    for candidate in range(port, port + attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, candidate))
                return candidate
            except OSError:
                continue
    return port


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    try:
        import uvicorn
    except ImportError:
        print("Не установлен uvicorn. Выполните: pip install -r requirements.txt")
        return 1

    from app.config import config

    parser = argparse.ArgumentParser(description="AI Game Factory — веб-интерфейс")
    parser.add_argument("--host", default=config.gui_host)
    parser.add_argument("--port", type=int, default=config.gui_port)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    host = args.host
    port = _free_port("127.0.0.1" if host in ("0.0.0.0", "") else host, args.port)
    url = f"http://{'127.0.0.1' if host in ('0.0.0.0', '') else host}:{port}"

    print("═" * 62)
    print("  🎮 AI GAME FACTORY — веб-интерфейс")
    print(f"  Адрес:      {url}")
    print(f"  Песочница:  {config.workspace_dir}")
    print("  Остановить: Ctrl+C в этом окне")
    print("═" * 62)

    if not args.no_browser:
        def open_later() -> None:
            time.sleep(1.2)
            try:
                webbrowser.open(url)
            except Exception:
                pass
        threading.Thread(target=open_later, daemon=True).start()

    uvicorn.run("app.web.api:app", host=host, port=port, log_level="warning", access_log=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
