"""Вход в аккаунт Яндекса и настройки прогона.

Прогон на настоящей странице площадки идёт от лица человека: без входа Яндекс
отдаёт черновик гостю — игрок не авторизован, облачного хранилища нет, покупки
не начинаются. Проверить в таком прогоне можно вёрстку и ничего из того, ради
чего прогон на черновике и затевается.

Автоматизировать сам вход нельзя: капча, СМС, двухфакторка. Поэтому фабрика
делает единственное уместное — открывает окно браузера человеку, а сессию
хранит. Здесь проверяется, что она при этом не врёт о состоянии входа и что
настройки прогона доезжают до `.env`, а не остаются в форме.
"""
import os

import pytest

from app import gametest, yandex_auth


class _Cfg:
    """Настройки с подменённым каталогом тестера."""

    def __init__(self, tool_dir, profile="a"):
        self.tool_dir = tool_dir
        self.profile = profile


# --------------------------------------------------------------- состояние входа

def test_a_missing_tester_is_not_the_same_as_a_missing_login(tmp_path):
    """«Не входили» и «спросить не у кого» — разные новости.

    Показывать второе как первое значит звать человека делать то, что всё равно
    не сработает: окно откроет тестер, которого нет.
    """
    data = yandex_auth.session(_Cfg(tmp_path))
    assert data["available"] is False
    assert data["signedIn"] is False
    assert "тестер" in data["reason"]


def test_login_state_starts_empty():
    state = yandex_auth.state()
    assert state["running"] is False
    assert state["log"] == [] or isinstance(state["log"], list)


def test_a_signed_in_session_is_reported_as_such(tmp_path, monkeypatch):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "cli.ts").write_text("", encoding="utf-8")
    monkeypatch.setattr(gametest, "session_status", lambda *a, **k: {
        "saved": True, "signedIn": True, "expired": False,
        "expiresAt": "2027-01-01T00:00:00.000Z", "file": "auth/yandex-a.json",
    })
    data = yandex_auth.session(_Cfg(tmp_path))
    assert data["available"] is True
    assert data["signedIn"] is True


def test_an_expired_session_is_not_a_login(tmp_path, monkeypatch):
    """Просроченный файл выглядит рабочим — и прогон уходит гостем."""
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "cli.ts").write_text("", encoding="utf-8")
    monkeypatch.setattr(gametest, "session_status", lambda *a, **k: {
        "saved": True, "signedIn": True, "expired": True, "expiresAt": "2020-01-01T00:00:00.000Z",
    })
    data = yandex_auth.session(_Cfg(tmp_path))
    assert data["signedIn"] is False
    assert data["expired"] is True


def test_login_refuses_a_machine_without_a_screen(monkeypatch, tmp_path):
    """Окно браузера открывается там, где крутится фабрика.

    Без этой проверки человек нажимает «Войти», ждёт минуту и получает
    стектрейс Playwright про отсутствующий дисплей.
    """
    monkeypatch.setattr(yandex_auth, "_headless_host", lambda: "нет графической сессии")
    called = {"n": 0}
    monkeypatch.setattr(gametest, "ensure_tool", lambda *a, **k: called.__setitem__("n", 1) or (None, ""))
    result = yandex_auth.login(cfg=_Cfg(tmp_path))
    assert result["ok"] is False
    assert called["n"] == 0, "инструмент не ставится ради входа, который всё равно не показать"


def test_forget_removes_the_saved_session(tmp_path):
    auth_dir = tmp_path / "auth"
    auth_dir.mkdir()
    saved = auth_dir / "yandex-a.json"
    saved.write_text("{}", encoding="utf-8")
    result = yandex_auth.forget(_Cfg(tmp_path))
    assert result["ok"] is True
    assert not saved.exists()


# --------------------------------------------------------------- настройки

@pytest.fixture()
def clean_env(monkeypatch):
    for name in list(os.environ):
        if name.startswith("GAMETEST_"):
            monkeypatch.delenv(name, raising=False)
    return monkeypatch


def test_defaults_leave_the_expensive_checks_off(clean_env):
    """У свежей игры каталога в консоли площадки ещё нет.

    Проверка покупок дала бы поток находок про то, чего пока и не должно быть.
    """
    cfg = gametest.settings()
    assert cfg.checks["payments"] is False
    assert cfg.checks["ads"] is False
    assert cfg.checks["ui"] is True
    assert cfg.viewports == "smoke", "полная матрица разрешений дороже в разы"


def test_an_explicit_empty_set_is_not_the_default_set(clean_env):
    """Человек снял все галочки осознанно — это не «набор по умолчанию»."""
    clean_env.setenv("GAMETEST_CHECKS", "none")
    cfg = gametest.settings()
    assert not any(cfg.checks.values())


def test_the_settings_screen_writes_the_run_to_env(clean_env, tmp_path, monkeypatch):
    from app.web import service as web_service

    monkeypatch.setattr(web_service, "BASE_DIR", tmp_path)
    env_lines: dict = {}
    web_service.service._save_gametest({
        "enabled": True,
        "mode": "draft",
        "viewports": "default",
        "block_on": "minor",
        "jobs": 99,
        "checks": {"ui": True, "saves": True, "payments": False},
        "llm": {"enabled": True, "provider": "anthropic", "model": "claude-opus-5",
                "key_env": "LLM_API_KEY", "key": "sekret"},
    }, env_lines)

    assert env_lines["GAMETEST_YANDEX_MODE"] == "draft"
    assert env_lines["GAMETEST_VIEWPORTS"] == "default"
    assert env_lines["GAMETEST_BLOCK_ON"] == "minor"
    assert env_lines["GAMETEST_JOBS"] == "16", "число из формы обязано быть в разумных границах"
    assert env_lines["GAMETEST_CHECKS"] == "saves,ui"
    assert env_lines["GAMETEST_LLM_PROVIDER"] == "anthropic"
    assert env_lines["LLM_API_KEY"] == "sekret", "ключ уходит в переменную, названную настройкой"


def test_an_unknown_provider_does_not_reach_env(clean_env, tmp_path, monkeypatch):
    from app.web import service as web_service

    env_lines: dict = {}
    web_service.service._save_gametest(
        {"llm": {"provider": "чужой", "key_env": "LLM_API_KEY"}}, env_lines)
    assert env_lines["GAMETEST_LLM_PROVIDER"] == "opencode"
