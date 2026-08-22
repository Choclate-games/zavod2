"""
УСТАРЕВШАЯ точка входа: десктопное окно (CustomTkinter).

Основной интерфейс фабрики — веб: `start.bat` или `python run_web.py`.
Это окно оставлено только для совместимости и больше не развивается.

Usage:
    python gui.py
"""
import sys
from app.gui.ctk_app import run_gui

if __name__ == "__main__":
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    print("[!] Десктопное окно устарело и не развивается. "
          "Рабочий интерфейс фабрики — веб: start.bat / python run_web.py")
    run_gui()
