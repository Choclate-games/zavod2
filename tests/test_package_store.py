"""
Общее хранилище node-пакетов.

Проверяем то, что легко сломать незаметно: настройки должны лежать там, где
их читает pnpm (в `.npmrc` часть из них молча игнорируется), подмена npm
должна доезжать до дочерних процессов, а чужой конфиг в проекте — оставаться
нетронутым.
"""

from pathlib import Path

import pytest

from app import pkgstore, sandbox
from app.config import config


@pytest.fixture()
def store(tmp_path: Path, monkeypatch) -> Path:
    root = tmp_path / "pkgstore"
    monkeypatch.setenv("PKG_STORE_DIR", str(root))
    return root


@pytest.fixture()
def project(tmp_path: Path) -> Path:
    proj = tmp_path / "game"
    proj.mkdir()
    (proj / "package.json").write_text('{"name":"game"}', encoding="utf-8")
    return proj


def test_store_lives_next_to_the_workspace(store: Path):
    # Жёсткая ссылка через границу тома невозможна: стор и игры обязаны быть
    # на одном диске, иначе pnpm молча скатится в копирование файлов.
    assert pkgstore.store_root() == store.resolve()
    assert pkgstore.pnpm_store_dir().is_relative_to(pkgstore.store_root())


def test_pnpm_settings_go_where_pnpm_reads_them(store: Path, project: Path):
    pkgstore.ensure_project_config(project)

    yaml = (project / "pnpm-workspace.yaml").read_text(encoding="utf-8")
    # Свежий pnpm читает эти ключи только из pnpm-workspace.yaml.
    assert "storeDir:" in yaml
    assert "nodeLinker: hoisted" in yaml
    # Без этого установка падает с ERR_PNPM_IGNORED_BUILDS и Vite остаётся
    # без бинарника esbuild.
    assert "dangerouslyAllowAllBuilds: true" in yaml

    npmrc = (project / ".npmrc").read_text(encoding="utf-8")
    assert "cache=" in npmrc


def test_foreign_config_in_a_project_is_left_alone(store: Path, project: Path):
    (project / ".npmrc").write_text("//registry.example/:_authToken=секрет\n", encoding="utf-8")
    (project / "pnpm-workspace.yaml").write_text("packages:\n  - apps/*\n", encoding="utf-8")

    pkgstore.ensure_project_config(project)

    assert "секрет" in (project / ".npmrc").read_text(encoding="utf-8")
    assert "apps/*" in (project / "pnpm-workspace.yaml").read_text(encoding="utf-8")


def test_our_own_config_is_refreshed(store: Path, project: Path):
    pkgstore.ensure_project_config(project)
    (project / "pnpm-workspace.yaml").write_text(
        pkgstore._HEADER + "storeDir: /устаревший/путь\n", encoding="utf-8")

    pkgstore.ensure_project_config(project)
    assert "устаревший" not in (project / "pnpm-workspace.yaml").read_text(encoding="utf-8")


def test_env_points_children_at_the_shared_cache(store: Path):
    env = pkgstore.env({"PATH": "/usr/bin"}, bootstrap=False)
    assert env["npm_config_cache"] == str(pkgstore.npm_cache_dir())
    assert env["npm_config_store_dir"] == str(pkgstore.pnpm_store_dir())
    # Аудит и «спасибо, поддержите проект» только засоряют лог сборки.
    assert env["npm_config_audit"] == "false"
    assert env["npm_config_fund"] == "false"


def test_shim_is_prepended_to_path_so_npm_install_is_intercepted(store: Path, monkeypatch):
    # Агент запускает `npm install` сам, посреди задачи: перехватить его можно
    # только подменой в PATH дочернего процесса.
    fake_pnpm = store / "fake" / "pnpm.cmd"
    fake_pnpm.parent.mkdir(parents=True)
    fake_pnpm.write_text("@echo off", encoding="utf-8")
    monkeypatch.setattr(pkgstore, "find_pnpm", lambda: fake_pnpm)

    env = pkgstore.env({"PATH": "/usr/bin"}, bootstrap=False)
    assert env["PATH"].startswith(str(pkgstore.shim_dir()))
    assert env["ZAVOD_PNPM"] == str(fake_pnpm)

    shim = pkgstore.shim_dir() / "npm-shim.js"
    body = shim.read_text(encoding="utf-8")
    assert "ZAVOD_SHIM_ACTIVE" in body, "без защиты подмена зациклится сама на себе"
    assert "'install', '--frozen-lockfile'" in body, "у pnpm нет команды ci"


def test_env_without_pnpm_does_not_break_the_path(store: Path, monkeypatch):
    monkeypatch.setattr(pkgstore, "find_pnpm", lambda: None)
    env = pkgstore.env({"PATH": "/usr/bin"}, bootstrap=False)
    # pnpm не поднялся — работаем обычным npm, но общий кеш загрузок остаётся.
    assert env["PATH"] == "/usr/bin"
    assert "ZAVOD_PNPM" not in env
    assert env["npm_config_cache"] == str(pkgstore.npm_cache_dir())


def test_new_project_gets_the_store_config_from_the_factory(tmp_path: Path, monkeypatch, store: Path):
    """Каркас проекта фабрика ставит сама — вместе с настройками стора."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setattr(config, "workspace_dir", workspace)

    proj = workspace / "demo"
    sandbox.ensure_project_docs(proj, "Демо")

    assert (proj / "pnpm-workspace.yaml").exists()
    assert (proj / ".npmrc").exists()
