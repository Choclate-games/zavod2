"""Договор между workflow и мини-ПК.

Деплой — единственная часть фабрики, которую нельзя проверить запуском:
машина одна, и она же боевая. Поэтому здесь закреплено то, что ломалось
по-настоящему и каждый раз выглядело одинаково — зелёная галочка при не
обновившемся сайте.

История отказов, из которой выросли эти проверки:

* job трогал файл-триггер и на этом заканчивался — «зелёный» означал «файл
  записан», а не «фабрика обновилась»;
* `systemd .path` глух, пока запущен его сервис: пуш, пришедший во время
  сборки, терялся молча;
* хост отчитывался файлами, и стоило скрипту на машине отстать от main, как
  job ждал отчёта, которого не будет;
* коммит, снявший игры с учёта git, увёл бы папку игр с диска: merge проводит
  это как удаление файлов.

Теперь связь синхронная (ssh держит соединение до конца), а игры защищены
описью до и после. Тесты стерегут обе договорённости.
"""
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
WORKFLOW = ROOT / ".github" / "workflows" / "deploy.yml"
SCRIPT = ROOT / "docker" / "deploy.sh"
COMMAND = ROOT / "docker" / "deploy-command.sh"
SETUP = ROOT / "docker" / "setup-deploy.sh"
BOOTSTRAP = ROOT / "docker" / "bootstrap.sh"
COMPOSE = ROOT / "compose.yml"
RUNNER_DOCKERFILE = ROOT / "docker" / "runner" / "Dockerfile"

SECRET = "DEPLOY_SSH_KEY"


def _workflow() -> dict:
    return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))


def _steps() -> list:
    return _workflow()["jobs"]["deploy"]["steps"]


def _step(name: str) -> dict:
    for step in _steps():
        if name in str(step.get("name", "")):
            return step
    raise AssertionError(f"в workflow нет шага «{name}»")


def test_the_deploy_runs_over_ssh_and_the_job_waits_for_it():
    """Зелёная галочка обязана означать «фабрика обновилась».

    Раньше job только трогал файл-триггер: деплой шёл на хосте вне GitHub, и
    его падение до Actions не доходило вообще.
    """
    run = _step("Деплой на мини-ПК")["run"]
    assert "ssh " in run, "деплой должен идти по ssh, а не через файл-триггер"
    assert "deploy $GITHUB_SHA" in run, "хосту надо сказать, какой коммит от него ждут"
    assert "|| true" not in run, "провал ssh обязан валить job"
    assert not _step("Деплой на мини-ПК").get("continue-on-error")


def test_the_host_is_probed_before_the_tests():
    """Протухший ключ должен обнаруживаться за секунды, а не после тестов."""
    names = [str(s.get("name", "")) for s in _steps()]
    assert names.index("Связь с мини-ПК") < names.index("Тесты")
    assert "ping" in _step("Связь с мини-ПК")["run"]


def test_the_workflow_and_the_setup_script_agree_on_the_secret():
    """Разъехавшиеся имена ничего не ломают видимо — деплой просто не пойдёт."""
    assert SECRET in WORKFLOW.read_text(encoding="utf-8")
    assert SECRET in SETUP.read_text(encoding="utf-8")


def test_a_missing_secret_says_what_to_do():
    run = _step("Ключ до мини-ПК")["run"]
    assert "::error::" in run
    assert "setup-deploy.sh" in run, "ошибка без инструкции — сообщение ни о чём"


def test_the_key_never_stays_on_the_runner():
    step = _step("Убрать ключ")
    assert step.get("if") == "always()", "ключ должен убираться и после падения"


def test_no_pull_request_trigger():
    """Репозиторий публичный, раннер стоит дома.

    `pull_request` означал бы выполнение кода с чужого форка на этой машине.
    """
    triggers = _workflow()[True]  # yaml разбирает `on:` как булево True
    assert "pull_request" not in triggers
    assert "push" in triggers


def test_the_runner_still_has_no_docker_socket():
    """Способ подать сигнал изменился, объём прав — нет.

    Правило CI-инфраструктуры мини-ПК: код из workflow не управляет демоном
    Docker хоста. Ключ деплоя ограничен одной командой ровно поэтому.
    """
    compose = COMPOSE.read_text(encoding="utf-8")
    assert "docker.sock" not in compose
    runner = yaml.safe_load(compose)["services"]["runner"]
    assert "host.docker.internal:host-gateway" in runner["extra_hosts"], (
        "без этого имени контейнер не видит хост и деплой встаёт на связи"
    )


def test_the_runner_image_can_speak_ssh():
    assert "openssh-client" in RUNNER_DOCKERFILE.read_text(encoding="utf-8")


def test_the_key_may_only_ask_for_a_deploy():
    """Утёкший ключ должен уметь ровно то же, что умел файл-триггер."""
    command = COMMAND.read_text(encoding="utf-8")
    assert "SSH_ORIGINAL_COMMAND" in command
    assert "exit 64" in command, "чужая команда обязана отвергаться"
    setup = SETUP.read_text(encoding="utf-8")
    assert 'command=' in setup and "restrict" in setup, (
        "ключ без форсированной команды — это доступ к машине, а не кнопка"
    )
    assert "deploy-command.sh" in setup


def test_the_deploy_script_never_wipes_the_working_tree():
    """`reset --hard` и `git clean` сносят нетрекаемое молча и на успешном пути.

    Игры на мини-ПК как раз нетрекаемые — это ровно тот случай.
    """
    for path in (SCRIPT, COMMAND, SETUP, BOOTSTRAP):
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            bare = line.strip()
            if bare.startswith("#"):
                continue
            assert not re.match(r"^git\s+reset\s+--hard", bare), f"{path.name}:{number}"
            assert not re.match(r"^git\s+clean", bare), f"{path.name}:{number}"


def test_the_games_are_counted_before_and_after():
    """Пропавшая игра обязана валить деплой, а не обнаруживаться через неделю."""
    script = SCRIPT.read_text(encoding="utf-8")
    assert "INVENTORY_BEFORE" in script
    assert "comm -23" in script, "сравнивать надо имена, а не количество"
    assert "С диска пропали игры" in script


def test_the_games_survive_a_commit_that_untracks_them():
    """Merge проводит снятие с учёта как удаление файлов — то есть с диска."""
    script = SCRIPT.read_text(encoding="utf-8")
    assert "merge_would_delete_games" in script
    assert "stash_games" in script
    assert "restore_games" in script
    assert "trap on_exit EXIT" in script, "возврат обязан случиться и при падении"


def test_every_step_shows_up_in_the_actions_log():
    """«Видно каждый шаг» — это маркеры групп из самого скрипта."""
    script = SCRIPT.read_text(encoding="utf-8")
    assert "::group::" in script and "::endgroup::" in script
    for phase in ("Очередь", "Игры на диске", "Обновление кода",
                  "Сборка образа", "Перезапуск фабрики", "Проверка"):
        assert f'step "{phase}"' in script, f"шаг «{phase}» потерялся"


def test_the_deploy_checks_that_the_factory_actually_came_up():
    """Иначе «деплой прошёл» означает лишь «docker не выругался»."""
    script = SCRIPT.read_text(encoding="utf-8")
    assert "/healthz" in script
    assert "docker inspect" in script
    assert "docker compose logs" in script, "упавший контейнер надо показать, а не описать"


def test_the_script_pins_itself_before_touching_git():
    """bash дочитывает файл по ходу выполнения, а merge его переписывает."""
    lines = SCRIPT.read_text(encoding="utf-8").splitlines()
    pin = next(n for n, line in enumerate(lines) if "ZAVOD_DEPLOY_PINNED" in line)
    merge = next(n for n, line in enumerate(lines) if line.strip().startswith("if ! git merge"))
    assert pin < merge, "закрепиться надо ДО merge"
    assert any("exec bash" in line for line in lines[:pin + 5])


def test_the_old_trigger_is_gone_for_good():
    """Файл-триггер был односторонним сигналом, о судьбе которого никто не знал."""
    assert not (ROOT / "docker" / "systemd" / "zavod2-deploy.path").exists()
    workflow = WORKFLOW.read_text(encoding="utf-8")
    assert "/deploy/trigger" not in workflow, "триггер больше не пишется"
    # Читать оттуда временная диагностика пока может — но ход деплоя от этого
    # каталога не зависит: он идёт по ssh и ждёт код возврата, а не файла.
    assert "/deploy" not in _step("Деплой на мини-ПК")["run"]
    assert not any("Дождаться" in str(s.get("name", "")) for s in _steps())
    # Ручной запуск с самой машины остаётся — им разворачивают без GitHub.
    assert (ROOT / "docker" / "systemd" / "zavod2-deploy.service").exists()
    # Выключение осиротевшего юнита — часть настройки, иначе один пуш давал бы
    # два деплоя.
    assert "zavod2-deploy.path" in SETUP.read_text(encoding="utf-8")


def test_the_lock_is_not_a_shared_name_in_tmp():
    """Общее имя в /tmp — отказ на ровном месте.

    Файл, созданный однажды другим пользователем (руками, из-под root),
    навсегда роняет деплой с «Permission denied» ещё до первой полезной
    команды. Поймано на симуляции.
    """
    script = SCRIPT.read_text(encoding="utf-8")
    assert '"/tmp/zavod2-deploy.lock"' not in script
    assert 'LOCK="${LOCK:-$STATE_DIR/deploy.lock}"' in script
    assert 'id -u' in script, "запасной путь в /tmp обязан различать пользователей"


def test_the_bootstrap_never_reaches_for_git_pull():
    """Ради этого он и существует: `git pull` здесь выносит папку игр с диска."""
    boot = BOOTSTRAP.read_text(encoding="utf-8")
    for number, line in enumerate(boot.splitlines(), 1):
        bare = line.strip()
        if bare.startswith("#"):
            continue
        assert not re.match(r"^git\s+pull", bare), f"bootstrap.sh:{number}"
    assert "git show origin/main:docker/deploy.sh" in boot, (
        "обновляться надо новым скриптом, а не тем, что лежит на машине"
    )
    assert "setup-deploy.sh" in boot


def test_the_games_guard_survives_a_real_repository(tmp_path):
    """Защита игр проверяется запуском, а не чтением.

    Написанная через `... | grep -q .`, она молчала ровно тогда, когда была
    нужна: grep закрывает трубу на первой строке, git умирает с SIGPIPE (141),
    и `set -o pipefail` делает 141 статусом всей трубы. На коротком выводе это
    не воспроизводится никогда — git успевает дописать всё в буфер, — а на
    настоящей машине с 1639 удаляемыми файлами воспроизводилось 30 раз из 30.
    Поэтому тест поднимает репозиторий, где удалений заведомо больше буфера
    трубы, и гоняет ровно ту функцию, что лежит в скрипте.
    """
    import subprocess

    repo = tmp_path / "repo"
    (repo / "workspace" / "game" / "src" / "deep" / "nested" / "dir").mkdir(parents=True)
    games = repo / "workspace" / "game" / "src" / "deep" / "nested" / "dir"
    for number in range(3000):
        (games / f"module-with-a-longish-name-{number:05d}.ts").write_text("x")

    def git(*args: str) -> str:
        return subprocess.run(
            ["git", *args], cwd=repo, check=True, capture_output=True, text=True,
        ).stdout

    git("init", "-q")
    git("config", "user.email", "t@t")
    git("config", "user.name", "t")
    git("add", "-A")
    git("commit", "-qm", "игры в git")
    was = git("rev-parse", "HEAD").strip()

    git("rm", "-r", "-q", "--cached", "workspace")
    (repo / ".gitignore").write_text("/workspace/*\n")
    git("add", "-A")
    git("commit", "-qm", "игры сняты с учёта")
    git("update-ref", "refs/remotes/origin/main", "HEAD")
    # HEAD возвращается назад, файлы остаются на диске — состояние мини-ПК.
    git("reset", "-q", "--mixed", was)

    source = SCRIPT.read_text(encoding="utf-8")
    start = source.index("merge_would_delete_games() {")
    body = source[start:source.index("\n}", start) + 2]

    probe = subprocess.run(
        ["bash", "-c", f'set -euo pipefail\nGAME_DIRS="workspace output"\n{body}\n'
                       'if merge_would_delete_games; then echo ДА; else echo НЕТ; fi'],
        cwd=repo, capture_output=True, text=True,
    )
    assert probe.stdout.strip() == "ДА", (
        "защита не увидела удалений — игры на мини-ПК уехали бы вместе с merge"
    )


def test_no_pipe_into_a_consumer_that_quits_early():
    """Ловушка, стоившая защиты игр, не должна вернуться другим местом.

    `grep -q` и `head` выходят, не дочитав, писатель получает SIGPIPE, и под
    `set -o pipefail` статусом трубы становится 141. В условии `if` это тихо
    неверный ответ, в теле — смерть скрипта по `set -e`.
    """
    for path in (SCRIPT, COMMAND, SETUP, BOOTSTRAP):
        text = path.read_text(encoding="utf-8")
        assert "set -o pipefail" in text or "set -euo pipefail" in text
        for number, line in enumerate(text.splitlines(), 1):
            bare = line.strip()
            if bare.startswith("#") or "|" not in bare:
                continue
            after = bare.split("|", 1)[1]
            assert "grep -q" not in after, f"{path.name}:{number} — труба в grep -q"
            assert not re.search(r"\bhead\s+-n?\s*\d", after), f"{path.name}:{number} — труба в head"
