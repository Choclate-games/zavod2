"""Файл настроек и браузер тестера — две вещи, которые молча теряли работу.

`.env` человек ведёт руками: там шапка, разделы, комментарии над ключами. Любое
сохранение настроек из веба переписывало файл голым списком пар, и всё, кроме
значений, пропадало без следа.

Chromium на чистой машине ставится наполовину: сам браузер приезжает, системные
библиотеки — нет. Запускается он при этом ровно один раз, до первой строчки
`error while loading shared libraries`, а наверх приходило «вход не состоялся за
900 с» — про окно, которого не было ни секунды.
"""
from pathlib import Path

from app import envfile, gametest

HAND_WRITTEN = """\
# ─────────────────────────────────────────
# Настройки фабрики. Правится руками.
# ─────────────────────────────────────────

# Кодовый агент по умолчанию
DEFAULT_AGENT=agy
AGY_MODEL=gemini-3-pro

# Доступ к базе знаний
KNOWLEDGE_REPO=EdikN/zavod2
"""


# --------------------------------------------------------------------- .env

def test_saving_settings_keeps_the_file_a_human_wrote(tmp_path):
    """Комментарии, разделы и пустые строки переживают сохранение."""
    path = tmp_path / ".env"
    path.write_text(HAND_WRITTEN, encoding="utf-8")

    envfile.update(path, {"AGY_MODEL": "gemini-3-flash"})
    after = path.read_text(encoding="utf-8")

    assert "# Настройки фабрики. Правится руками." in after
    assert "# Кодовый агент по умолчанию" in after
    assert "# Доступ к базе знаний" in after
    assert "AGY_MODEL=gemini-3-flash" in after
    assert "AGY_MODEL=gemini-3-pro" not in after
    # Всё, чего не просили менять, остаётся на месте и в прежнем порядке.
    assert "DEFAULT_AGENT=agy" in after
    assert "KNOWLEDGE_REPO=EdikN/zavod2" in after


def test_an_untouched_file_stays_byte_for_byte(tmp_path):
    """Сохранение без изменений не должно шевелить файл вовсе."""
    path = tmp_path / ".env"
    path.write_text(HAND_WRITTEN, encoding="utf-8")
    envfile.update(path, {})
    assert path.read_text(encoding="utf-8") == HAND_WRITTEN


def test_a_new_key_is_appended_not_prepended(tmp_path):
    path = tmp_path / ".env"
    path.write_text(HAND_WRITTEN, encoding="utf-8")
    envfile.update(path, {"GITHUB_TOKEN": "ghp_x"})
    lines = path.read_text(encoding="utf-8").splitlines()
    assert lines[-1] == "GITHUB_TOKEN=ghp_x"
    assert lines[0].startswith("#")


def test_repeated_saves_do_not_grow_blank_lines(tmp_path):
    """Хвост из пустых строк — та же потеря формата, только медленная."""
    path = tmp_path / ".env"
    path.write_text(HAND_WRITTEN, encoding="utf-8")
    for value in ("a", "b", "c"):
        envfile.update(path, {"GITHUB_TOKEN": value})
    text = path.read_text(encoding="utf-8")
    assert "\n\n\n" not in text
    assert text.count("GITHUB_TOKEN=") == 1


def test_every_copy_of_a_duplicated_key_is_updated(tmp_path):
    """Побеждает последнее вхождение — поправив первое, мы бы записали значение,
    которое никто никогда не прочитает."""
    path = tmp_path / ".env"
    path.write_text("TOKEN=старый\nDEFAULT_AGENT=agy\nTOKEN=ещё старее\n", encoding="utf-8")
    envfile.update(path, {"TOKEN": "новый"})
    assert envfile.read(path)["TOKEN"] == "новый"
    assert "старый" not in path.read_text(encoding="utf-8")


def test_a_commented_out_key_is_left_alone(tmp_path):
    """Закомментированный ключ — заметка человека, а не настройка."""
    path = tmp_path / ".env"
    path.write_text("# OPENCODE_MODEL=было-так\nOPENCODE_MODEL=стало-так\n", encoding="utf-8")
    envfile.update(path, {"OPENCODE_MODEL": "новое"})
    text = path.read_text(encoding="utf-8")
    assert "# OPENCODE_MODEL=было-так" in text
    assert "OPENCODE_MODEL=новое" in text


def test_a_missing_file_is_created(tmp_path):
    path = tmp_path / ".env"
    envfile.update(path, {"DEFAULT_AGENT": "agy"})
    assert path.read_text(encoding="utf-8") == "DEFAULT_AGENT=agy\n"


def test_a_failed_write_does_not_truncate_the_file(tmp_path, monkeypatch):
    """В `.env` лежат токены: оборванная запись оставила бы их неоткуда брать."""
    path = tmp_path / ".env"
    path.write_text(HAND_WRITTEN, encoding="utf-8")

    def explode(self, *args, **kwargs):
        raise OSError("диск кончился")

    monkeypatch.setattr(Path, "write_text", explode)
    try:
        envfile.update(path, {"AGY_MODEL": "новая"})
    except OSError:
        pass
    assert path.read_text(encoding="utf-8") == HAND_WRITTEN


def test_the_settings_screen_writes_through_the_safe_writer(tmp_path, monkeypatch):
    """Сквозная проверка: сохранение настроек из веба не трогает комментарии."""
    from app.web import service as web_service

    path = tmp_path / ".env"
    path.write_text(HAND_WRITTEN, encoding="utf-8")
    monkeypatch.setattr(web_service, "BASE_DIR", tmp_path)

    web_service.service.save_settings({"github": {"token": "ghp_new"}})

    after = path.read_text(encoding="utf-8")
    assert "# Настройки фабрики. Правится руками." in after
    assert "GITHUB_TOKEN=ghp_new" in after
    assert "DEFAULT_AGENT=agy" in after


# ------------------------------------------------------------------ браузер

LINUX_FAILURE = """\
<launched> pid=501
[pid=501][err] /home/factory/.cache/ms-playwright/chromium_headless_shell-1234/\
chrome-headless-shell-linux64/chrome-headless-shell: error while loading shared \
libraries: libglib-2.0.so.0: cannot open shared object file: No such file or directory
[pid=501] <process did exit: exitCode=127, signal=null>
"""


def test_a_browser_that_cannot_start_is_named_as_such():
    """Отказ ни на что не похож: Playwright рапортует «установлен», процесс
    стартует и умирает с кодом 127."""
    message = gametest.browser_blocker(LINUX_FAILURE)
    assert "libglib-2.0.so.0" in message
    assert "install-deps" in message, "лечится одной командой — её и надо назвать"
    assert "образ" in message.lower(), (
        "в контейнере это чинится пересборкой образа, а не командой внутри него — "
        "иначе человек полезет ставить пакеты туда, где они исчезнут с деплоем"
    )


def test_an_ordinary_failure_is_not_blamed_on_the_browser():
    assert gametest.browser_blocker("") == ""
    assert gametest.browser_blocker("Вход не состоялся за 900 с") == ""


def test_a_broken_browser_is_reported_instead_of_a_timeout(monkeypatch, tmp_path):
    """Раньше это приходило как «вход не состоялся за 900 с» — про окно,
    которого не было ни секунды."""
    from app import yandex_auth

    monkeypatch.setattr(gametest, "ensure_tool", lambda *a, **k: (tmp_path, ""))
    monkeypatch.setattr(yandex_auth, "supports_remote", lambda _dir: True)
    monkeypatch.setattr(gametest, "_run", lambda *a, **k: (-3, LINUX_FAILURE))
    monkeypatch.setattr(yandex_auth, "session", lambda *a, **k: {"signedIn": False})

    class _Cfg:
        tool_dir = tmp_path
        profile = "a"

    result = yandex_auth.login(cfg=_Cfg(), mode=yandex_auth.MODE_REMOTE)
    assert result["ok"] is False
    assert "libglib-2.0.so.0" in result["message"]
    assert "900" not in result["message"]


def test_a_broken_browser_is_reported_instead_of_a_bare_exit_code(monkeypatch, tmp_path):
    """У прогона игры отказ выглядел ещё безобиднее, чем у входа.

    Тестер, чей Chromium не стартовал, не оставляет итогового файла — и это
    неотличимо от «прогон сорвался, код 1». Человеку, который нажал кнопку и
    ждал минуты установки, приходило именно это число.
    """
    from app.config import config

    project = config.workspace_dir / "broken-browser"
    (project / "dist").mkdir(parents=True, exist_ok=True)
    (project / "dist" / "index.html").write_text("<html></html>", encoding="utf-8")
    (project / "package.json").write_text('{"name":"g"}', encoding="utf-8")

    monkeypatch.setattr(gametest, "ensure_tool", lambda *a, **k: (tmp_path, ""))
    monkeypatch.setattr(gametest, "session_status", lambda *a, **k: None)
    monkeypatch.setattr(gametest, "_run", lambda *a, **k: (1, LINUX_FAILURE))

    cfg = gametest.settings()
    cfg.tool_dir = tmp_path
    run = gametest.run(project, cfg=cfg)

    assert run.ran is False
    assert any("libglib-2.0.so.0" in blocker for blocker in run.blockers)
    assert not any("код 1" in blocker for blocker in run.blockers)


def test_the_browser_stamp_is_dropped_so_a_retry_reinstalls(tmp_path):
    """Отметка «браузеры поставлены» не даёт переустановке случиться никогда —
    а починка здесь именно переустановка, уже с зависимостями."""
    stamp = tmp_path / "node_modules" / ".gametest-browsers"
    stamp.parent.mkdir(parents=True)
    stamp.write_text("2026-01-01", encoding="utf-8")
    gametest.forget_browsers(tmp_path)
    assert not stamp.exists()


def test_system_dependencies_are_only_attempted_as_root(monkeypatch):
    """`--with-deps` зовёт apt, а apt работает только от root.

    В контейнере фабрики пользователь `factory`, и там эта попытка — просто
    гарантированно провалившийся apt перед установкой, которая и так пройдёт;
    библиотеки туда кладёт сборка образа. Ветка с root остаётся для голой
    машины, где фабрику подняли из-под администратора.
    """
    monkeypatch.setattr(gametest.os, "name", "posix")

    monkeypatch.setattr(gametest.os, "geteuid", lambda: 0, raising=False)
    assert "--with-deps" in gametest._browser_install_cmd()

    monkeypatch.setattr(gametest.os, "geteuid", lambda: 29999, raising=False)
    assert "--with-deps" not in gametest._browser_install_cmd()

    monkeypatch.setattr(gametest.os, "name", "nt")
    assert "--with-deps" not in gametest._browser_install_cmd()


# ------------------------------------------------------------ токен и окружение

def test_a_missing_token_blames_the_save_button_not_the_variable_name():
    """Зелёная проверка доступа и незаполненное окружение — разные вещи.

    «Проверить доступ» спрашивает GitHub про значения из формы и на верном
    токене отвечает зелёным по всем трём адресам. Читается это как
    «настроено», хотя в окружении фабрики токена всё ещё нет — и следующий шаг
    упирается в «токена нет». Сообщение обязано называть недостающее действие,
    а не имя переменной.
    """
    from app.config import BASE_DIR

    cfg = gametest.settings()
    cfg.tool_dir = BASE_DIR / "tests" / "нет-такого-каталога"
    cfg.repo = "Choclate-games/AI_Tester"

    saved = {name: __import__("os").environ.pop(name, None)
             for name in ("GAMETEST_TOKEN", "ZAVOD_KNOWLEDGE_TOKEN", "GITHUB_TOKEN")}
    try:
        _dir, reason = gametest.ensure_tool(cfg)
    finally:
        for name, value in saved.items():
            if value is not None:
                __import__("os").environ[name] = value

    assert "Сохранить" in reason, "не сказано главное — что настройку надо сохранить"
    assert "Общий токен" in reason, "названо не то поле, которое человек и заполняет"


def test_a_token_with_stray_characters_says_so_plainly():
    """Заголовок HTTP не бывает не-ASCII, и токен GitHub тоже.

    Без проверки такой токен доходил до отправки и валился внутри http.client
    сообщением «'latin-1' codec can't encode characters in position 11-23» —
    оно читается как отказ сети, а означает опечатку в поле ввода.
    """
    from app import github_access

    result = github_access.identity("ghp_кириллица")
    assert result["ok"] is False
    assert "codec" not in result["message"]
    assert "скопируйте его заново" in result["message"]
