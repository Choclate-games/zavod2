"""Приёмка перестала быть только чтением исходников.

Живой случай: пакет «Черепичный Спринт» проходил `check-spec.mjs` целиком —
двадцать зелёных галочек, включая строку, где кодовый агент прямо написал в
комментарии «Mount to DOM touch layer (satisfying G4 Check)». При этом
`npm run build` падал на первой строке `main.ts`: `import './ui/theme.css'` без
объявления модуля роняет `tsc`. Собрать игру было нельзя, а вся статика была
зелёной.

Дыра здесь не в конкретной проверке, а в их природе: ни одна из них не
открывала игру. Тесты держат оба новых конца — статический (A5 ловит
необъявленный импорт) и живой (`scripts/smoke.mjs` уезжает в пакет и его
требует и промпт, и приёмка).
"""
import subprocess
from pathlib import Path

import pytest

from agents.prompt_compiler import PromptCompilerAgent
from generators.check_spec_script import CHECK_SPEC_MJS
from generators.output_generator import OutputGenerator
from generators.smoke_script import SMOKE_MJS
from tests.test_master_prompt import make_ctx, shooter_concept


# ------------------------------------------------------------------ доставка

def test_package_ships_the_smoke_script(tmp_path):
    concept = shooter_concept()
    ctx = make_ctx(concept)
    ctx.output_base_dir = tmp_path
    ctx.game_dir = tmp_path / concept.slug
    game_dir = OutputGenerator().generate_package(ctx)

    smoke = game_dir / "scripts" / "smoke.mjs"
    assert smoke.exists(), "дымовой запуск обязан уезжать в пакет так же, как check-spec"
    assert smoke.read_text(encoding="utf-8").strip()


def test_the_smoke_script_is_valid_javascript(tmp_path):
    """Скрипт живёт строкой в Python — сломать его опечаткой слишком легко."""
    path = tmp_path / "smoke.mjs"
    path.write_text(SMOKE_MJS, encoding="utf-8")
    node = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
    if node.returncode == 127:
        pytest.skip("node не установлен")
    assert node.returncode == 0, node.stderr


def test_the_smoke_script_needs_no_dependencies():
    """Пакет игры ставит зависимости не всегда и не сразу — скрипт обязан работать сам."""
    for forbidden in ("from 'playwright'", "from 'puppeteer'", "require('playwright')"):
        assert forbidden not in SMOKE_MJS
    assert "node:http" in SMOKE_MJS and "new WebSocket(" in SMOKE_MJS


# ------------------------------------------------------------------ что он проверяет

@pytest.mark.parametrize(
    "check, about",
    [
        ("S1", "сборка"),
        ("S2", "ошибки в консоли"),
        ("S3", "игровой цикл"),
        ("S4", "пустой кадр"),
        ("S5", "ввод"),
        ("S6", "телефон"),
        ("S7", "интерфейс не появился"),
    ],
)
def test_smoke_covers_every_way_a_game_fails_to_open(check, about):
    assert f"'{check}'" in SMOKE_MJS, f"нет проверки {check} ({about})"


def test_smoke_counts_draw_calls_not_just_the_absence_of_errors():
    """Чёрный экран не бросает исключений: его видно только по отрисовке."""
    assert "drawElements" in SMOKE_MJS and "drawArrays" in SMOKE_MJS


def test_smoke_opens_the_game_on_a_phone_too():
    assert "390" in SMOKE_MJS and "setTouchEmulationEnabled" in SMOKE_MJS


def test_smoke_does_not_mistake_an_empty_layer_for_an_interface():
    """Слои интерфейса были на месте и пустые — игра выглядела как сцена без меню."""
    assert "emptyLayers" in SMOKE_MJS
    assert "не вставлены в документ" in SMOKE_MJS


def test_check_spec_requires_the_bridge_config():
    """bridge.initialize() без конфига ловит 404, и площадка не отвечает."""
    assert "'C12'" in CHECK_SPEC_MJS
    assert "playgama-bridge-config.json" in CHECK_SPEC_MJS


# ------------------------------------------------------------------ A5

def test_check_spec_catches_an_undeclared_asset_import():
    assert "'A5'" in CHECK_SPEC_MJS
    assert "vite-env.d.ts" in CHECK_SPEC_MJS


def _run_check_spec(project: Path) -> str:
    (project / "scripts").mkdir(parents=True, exist_ok=True)
    script = project / "scripts" / "check-spec.mjs"
    script.write_text(CHECK_SPEC_MJS, encoding="utf-8")
    # Кодировку задаём явно: скрипт печатает по-русски в UTF-8, а Python на
    # Windows по умолчанию читает вывод процесса в кодировке консоли и падает
    # на первой же букве отчёта.
    done = subprocess.run(["node", str(script)], cwd=project, capture_output=True,
                          text=True, encoding="utf-8", errors="replace")
    return (done.stdout or "") + (done.stderr or "")


def _minimal_project(tmp_path: Path) -> Path:
    project = tmp_path / "game"
    (project / "src" / "ui").mkdir(parents=True)
    (project / "src" / "main.ts").write_text("import './ui/theme.css'\nexport const start = () => 1\n", encoding="utf-8")
    (project / "src" / "ui" / "theme.css").write_text(":root { --color-bg: #101014; }\n", encoding="utf-8")
    return project


def test_a5_fires_on_the_real_defect(tmp_path):
    project = _minimal_project(tmp_path)
    output = _run_check_spec(project)
    if not output.strip():
        pytest.skip("node не установлен")
    assert "❌ A5" in output, output


def test_a5_is_satisfied_by_the_vite_declaration(tmp_path):
    project = _minimal_project(tmp_path)
    (project / "src" / "vite-env.d.ts").write_text('/// <reference types="vite/client" />\n', encoding="utf-8")
    output = _run_check_spec(project)
    if not output.strip():
        pytest.skip("node не установлен")
    assert "✅ A5" in output, output


# ------------------------------------------------------------------ промпт и приёмка

def test_the_prompt_tells_the_agent_to_open_the_game():
    prompt = PromptCompilerAgent().compile(make_ctx(shooter_concept()))
    assert "scripts/smoke.mjs" in prompt, "промпт не требует ни разу открыть игру"
    assert "vite-env.d.ts" in prompt, "каркас без объявления импортов не соберётся"


def test_the_prompt_says_which_check_matters_more():
    """Зелёная статика при красном запуске — это не «почти готово»."""
    prompt = PromptCompilerAgent().compile(make_ctx(shooter_concept()))
    assert "Зелёный `check-spec` при красном `smoke`" in prompt


def test_acceptance_has_a_section_that_runs_the_game(tmp_path):
    concept = shooter_concept()
    ctx = make_ctx(concept)
    ctx.output_base_dir = tmp_path
    ctx.game_dir = tmp_path / concept.slug
    acceptance = (OutputGenerator().generate_package(ctx) / "ACCEPTANCE.md").read_text(encoding="utf-8")

    for item in ("**S1**", "**S2**", "**S3**", "**S4**", "**S5**", "**S6**", "**S7**", "**A5**", "**C12**"):
        assert item in acceptance, f"в приёмке нет пункта {item}"


# ------------------------------------------------------------------ первопричина

def test_the_knowledge_base_shows_who_puts_a_screen_into_the_document():
    """Пример роутера в базе показывал show() и умалчивал про appendChild.

    Игра повторила его дословно: слои интерфейса на месте, экраны
    зарегистрированы, роутер зовёт show() — и на странице ничего. Пример
    обязан содержать вставку, иначе он учит писать игру без меню."""
    from app import knowledge

    doc = knowledge.read("ux/ui_implementation.md")
    router = doc[doc.index("class ScreenRouter"):doc.index("### Меню не гасит сцену")]
    assert "appendChild" in router, "в примере роутера некому вставить экран в документ"

    checklist = knowledge.checklist("ux/ui_implementation.md")
    assert any("вставлен в слой" in item for item in checklist), \
        "пункт про вставку экрана обязан доехать до приёмки вместе с документом"
