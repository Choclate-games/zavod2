# -*- coding: utf-8 -*-
"""
База знаний доставляется по требованию, а не копиями в каждом пакете.

Проверяется три вещи, каждая из которых уже стоила нам качества:
пакет не должен носить дословные дубли, адреса в нём обязаны существовать
после одной команды, и токен доступа не должен попадать в папку игры —
она уезжает в git вместе со всем содержимым.
"""
import json
import re
from pathlib import Path

import pytest

from app import knowledge, library
from app.context import GenerationContext
from app.models import GameConcept, MechanicSpec, SkillDoc
from generators.fetch_knowledge_script import FETCH_KNOWLEDGE_MJS
from generators.output_generator import OutputGenerator
from generators.skill_generator import SkillGenerator


def _concept() -> GameConcept:
    concept = GameConcept(title="Тактика Прорыва", slug="taktika", genre="тактический шутер",
                          hook="штурм комнаты за один вдох")
    concept.mechanics = [
        MechanicSpec(name="Конус зрения охранника", description="шкала подозрения и тревога"),
        MechanicSpec(name="Рэгдолл после попадания", description="труп падает физически"),
    ]
    concept.skills = [SkillDoc(skill_id="ui", filename="UI_SKILL.md",
                               knowledge_refs=["ux/ui_design_system.md"])]
    return concept


def _package(tmp_path: Path) -> Path:
    ctx = GenerationContext(raw_prompt="rainbow six", output_base_dir=tmp_path)
    ctx.concept = _concept()
    ctx.game_dir = tmp_path
    OutputGenerator._write_manifest(ctx, tmp_path)
    OutputGenerator._write_library(tmp_path, ctx)
    SkillGenerator().generate(ctx)
    return tmp_path


# --------------------------------------------------------------------- манифест

def test_manifest_marks_platform_documents_as_required(tmp_path):
    """Без Playgama игра на площадке не стартует — это не «желательно»."""
    manifest = json.loads((_package(tmp_path) / "knowledge.manifest.json").read_text(encoding="utf-8"))
    required = {f["path"] for f in manifest["files"] if f["required"]}

    assert f"knowledge/{knowledge.CRITICAL_RULES_FILE}" in required
    for topic in knowledge.MANDATORY_TOPICS:
        assert f"knowledge/{topic}" in required, f"{topic} обязателен, но помечен необязательным"


def test_manifest_has_no_duplicates(tmp_path):
    manifest = json.loads((_package(tmp_path) / "knowledge.manifest.json").read_text(encoding="utf-8"))
    paths = [f["path"] for f in manifest["files"]]
    assert len(paths) == len(set(paths)), "один и тот же файл в манифесте дважды"


def test_manifest_suggests_ready_code_for_the_game(tmp_path):
    """Подсказка должна быть про эту игру, а не про каталог вообще."""
    manifest = json.loads((_package(tmp_path) / "knowledge.manifest.json").read_text(encoding="utf-8"))
    code = [f["path"] for f in manifest["files"] if f["path"].endswith(".ts")]
    assert code, "готовый код не предложен вообще"
    assert any("agdoll" in path for path in code), f"рэгдолл не предложен шутеру: {code}"


# ------------------------------------------------------------------------ токен

def test_no_token_anywhere_in_the_package(tmp_path, monkeypatch):
    """Ключ живёт в окружении фабрики. В папке игры его быть не может."""
    monkeypatch.setenv("ZAVOD_KNOWLEDGE_TOKEN", "ghp_secret_value_that_must_not_leak")
    package = _package(tmp_path)
    for path in package.rglob("*"):
        if path.is_file():
            assert "ghp_secret_value_that_must_not_leak" not in path.read_text(
                encoding="utf-8", errors="ignore"), f"токен утёк в {path.name}"


def test_fetch_script_reads_token_from_environment_only():
    assert "process.env.ZAVOD_KNOWLEDGE_TOKEN" in FETCH_KNOWLEDGE_MJS
    assert "ghp_" not in FETCH_KNOWLEDGE_MJS


def test_public_base_goes_through_the_cdn_and_the_api_is_the_fallback():
    """Порядок адресов, а не их наличие: раньше он был обратным.

    Неавторизованный Contents API отдаёт шестьдесят запросов в час на IP. В
    манифесте одной игры сорок с лишним файлов, а пакет фабрики поднимает до
    десяти прогонов сразу — лимит выгорал на первой игре, остальные получали
    HTTP 403 и собирались вообще без базы знаний. У raw.githubusercontent
    такого счётчика нет, поэтому публичная база тянется через него, а
    Contents API остаётся для приватного репозитория, где нужен токен.
    """
    assert "raw.githubusercontent.com" in FETCH_KNOWLEDGE_MJS
    assert "api.github.com/repos/" in FETCH_KNOWLEDGE_MJS
    assert FETCH_KNOWLEDGE_MJS.index("let res = await requestRaw(") \
        < FETCH_KNOWLEDGE_MJS.index("res = await requestApi(")
    # Authorization уходит только на api.github.com: raw-запрос заголовка не несёт.
    assert "if (useToken) headers.Authorization" in FETCH_KNOWLEDGE_MJS
    raw_fn = FETCH_KNOWLEDGE_MJS[
        FETCH_KNOWLEDGE_MJS.index("async function requestRaw"):
        FETCH_KNOWLEDGE_MJS.index("async function requestApi")
    ]
    assert "Authorization" not in raw_fn


def test_fetch_script_counts_bytes_not_characters():
    """Кириллица занимает два байта на символ: по длине строки отчёт врал."""
    assert "Buffer.byteLength" in FETCH_KNOWLEDGE_MJS
    # Комментарии выкидываем: в них эта ошибка описана словами, и проверка
    # ловила бы собственное объяснение вместо кода.
    code = "\n".join(
        line for line in FETCH_KNOWLEDGE_MJS.splitlines()
        if not line.strip().startswith(("//", "*", "/*"))
    )
    assert "bytes += await" not in code, "составное присваивание через await затирает счётчик"


# ------------------------------------------------------------------- без дублей

def test_skills_carry_addresses_not_verbatim_copies(tmp_path):
    """Один документ лежал дословно в двух скиллах сразу — 91 КБ на пакет."""
    package = _package(tmp_path)
    ui_skill = (package / "skills" / "UI_SKILL.md").read_text(encoding="utf-8")
    source = knowledge.read("ux/ui_design_system.md")

    assert "docs/ref/knowledge/ux/ui_design_system.md" in ui_skill
    probe = [line for line in source.splitlines() if len(line) > 60 and not line.startswith("#")]
    assert probe, "документ базы пуст — проверять нечего"
    assert probe[len(probe) // 2] not in ui_skill, "текст документа снова вклеен в скилл"
    assert len(ui_skill) < 8000, f"скилл разросся до {len(ui_skill)} символов"


def test_library_file_lists_the_whole_catalog(tmp_path):
    text = (_package(tmp_path) / "LIBRARY.md").read_text(encoding="utf-8")
    for entry in library.load():
        assert entry.path in text, f"{entry.path} потерялся из LIBRARY.md"


# ── Манифест не должен обещать игре несуществующие файлы ────────────────────


def test_manifest_drops_paths_that_are_not_on_disk(tmp_path):
    """Ссылки на документы приходят от модели, и она их иногда выдумывает.

    «knowledge/math/ballistics_and_trajectories.md» — реальный случай из
    выпущенной игры. В манифесте такая строка означает гарантированный HTTP
    404, а если она помечена обязательной, загрузка базы падает целиком и
    кодовый агент садится писать игру без правил фабрики.
    """
    ctx = GenerationContext(raw_prompt="снайпер", output_base_dir=tmp_path)
    concept = _concept()
    concept.skills = [SkillDoc(
        skill_id="ui", filename="UI_SKILL.md",
        knowledge_refs=["ux/ui_design_system.md",
                        "math/ballistics_and_trajectories.md"],
    )]
    ctx.concept = concept
    ctx.game_dir = tmp_path
    OutputGenerator._write_manifest(ctx, tmp_path)

    paths = {f["path"] for f in json.loads(
        (tmp_path / "knowledge.manifest.json").read_text(encoding="utf-8"))["files"]}
    assert "knowledge/ux/ui_design_system.md" in paths
    assert "knowledge/math/ballistics_and_trajectories.md" not in paths


def test_every_path_the_factory_offers_really_exists():
    """Обязательные документы фабрики лежат на диске — иначе игра их не получит."""
    from app import knowledge
    from app.config import config

    required = [knowledge.CRITICAL_RULES_FILE, *knowledge.MANDATORY_TOPICS]
    missing = [name for name in required
               if not (config.knowledge_dir / name).exists()]
    assert not missing, f"нет в knowledge/: {missing}"
