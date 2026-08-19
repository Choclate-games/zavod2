"""
Хост-процесс для внутреннего браузера на pywebview.

pywebview умеет стартовать только из главного потока, поэтому окно предпросмотра
запускается отдельным процессом:  python -m app.webview_host <url> [title]
"""

import sys


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: webview_host.py <url> [title]", file=sys.stderr)
        return 2

    url = sys.argv[1]
    title = sys.argv[2] if len(sys.argv) > 2 else "Предпросмотр игры"

    try:
        import webview
    except ImportError:
        print("pywebview не установлен: pip install pywebview", file=sys.stderr)
        return 3

    webview.create_window(title, url, width=1180, height=760, resizable=True)
    webview.start()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
