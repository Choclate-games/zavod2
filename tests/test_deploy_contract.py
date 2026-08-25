"""Деплой отчитывается о себе, и job этот отчёт понимает.

Job в раннере умеет ровно одно — тронуть файл-триггер: пересобирает и
перезапускает фабрику systemd на хосте, вне GitHub. Значит и падение
происходит вне GitHub, а в Actions горит зелёная галочка. Живой случай — мерж
уехал в main, галочка зелёная, а на экране фабрики полтора часа висела
предыдущая версия.

Связка держится на двух договорённостях, и обе разъезжаются незаметно: имена
файлов, через которые скрипт и workflow разговаривают, и запись исхода на любом
выходе. Разъехавшиеся имена не ломают ничего видимого — job просто ждёт отчёта,
которого не будет.
"""
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
WORKFLOW = ROOT / ".github" / "workflows" / "deploy.yml"
SCRIPT = ROOT / "docker" / "deploy.sh"
UNIT = ROOT / "docker" / "systemd" / "zavod2-deploy.path"
COMPOSE = ROOT / "compose.yml"


def test_the_job_waits_for_the_deploy():
    """Без шага ожидания зелёная галочка означает «файл записан»."""
    steps = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))["jobs"]["deploy"]["steps"]
    assert any("Дождаться деплоя" in str(step.get("name", "")) for step in steps)


def test_silence_from_the_host_is_a_failure():
    """Снисходительность здесь — та же дыра с другой стороны.

    Хост, который не отчитался, — это либо упавший деплой, либо deploy.sh
    старее того, что в main. И то и другое надо чинить, а не переживать.
    """
    workflow = WORKFLOW.read_text(encoding="utf-8")
    assert "exit 1" in workflow
    assert "поверю на слово" not in workflow, "верить на слово тут нечему"


def test_script_and_job_agree_on_the_report_files():
    """Разъехавшиеся имена не ломают ничего видимого — job просто ждёт зря."""
    script = SCRIPT.read_text(encoding="utf-8")
    workflow = WORKFLOW.read_text(encoding="utf-8")

    assert 'STATUS="$STATE_DIR/status"' in script
    assert 'LOG_FILE="$STATE_DIR/last.log"' in script
    # Раннеру тот же каталог смонтирован как /deploy.
    assert "./.deploy:/deploy" in COMPOSE.read_text(encoding="utf-8")
    assert "/deploy/status" in workflow
    assert "/deploy/last.log" in workflow

    for field in ("sha=", "outcome=", "code=", "step=", "started="):
        assert field in script, f"скрипт не пишет поле {field}"


def test_the_outcome_is_written_on_every_exit():
    """Запись только на успешном пути — это упавший деплой, неотличимый от
    не начинавшегося: job ждал бы его до таймаута."""
    script = SCRIPT.read_text(encoding="utf-8")
    assert 'trap \'code=$?; restore_games; write_status "$code"\' EXIT' in script


def test_the_trigger_file_is_the_one_systemd_watches():
    """Юнит следит за одним файлом, а job трогает другой — деплой не начнётся."""
    watched = next(line.split("=", 1)[1].strip()
                   for line in UNIT.read_text(encoding="utf-8").splitlines()
                   if line.startswith("PathModified="))
    assert watched.endswith("/trigger"), watched
    assert "/deploy/trigger" in WORKFLOW.read_text(encoding="utf-8")


def test_the_deploy_never_deletes_games():
    """Merge стирает из рабочего дерева всё, что удалено во входящих коммитах.

    Проверено на симуляции сервера: при чистом дереве `git merge --ff-only`
    уносит папку игр молча и с кодом 0. Игру удаляют кнопкой в фабрике, а не
    пушем в main.
    """
    script = SCRIPT.read_text(encoding="utf-8")
    for piece in ("merge_would_delete_games", "stash_games", "restore_games",
                  'GAME_DIRS="workspace output"'):
        assert piece in script, piece


def test_games_are_out_of_git_but_the_registry_stays():
    """Реестр витрины — данные пользователя, а не игра.

    Без него после клона витрина теряет оценки и архив.
    """
    ignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
    assert "/workspace/*" in ignore
    assert "/output/*" in ignore
    assert "!/workspace/.factory/projects.json" in ignore
