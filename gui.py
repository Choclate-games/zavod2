"""
Desktop GUI Entrypoint for AI Game Prompt Factory (CustomTkinter).
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

    run_gui()
