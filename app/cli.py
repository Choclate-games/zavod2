import os
import sys
import webbrowser
from pathlib import Path
from typing import Optional

# Ensure Windows UTF-8 stdout/stderr
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import typer
from rich.table import Table
from rich.prompt import Prompt
import yaml

from app.logging import console, log_info, log_error, log_success
from app.config import config
from app.pipeline import Pipeline
from app.context import GenerationContext
from app.run_session import RunPaused, RunSession
from providers.factory import ProviderFactory
from agents.idea_analyzer import IdeaAnalyzerAgent

app = typer.Typer(
    help="AI Game Prompt Factory: Automated Game Design Specification & AI Developer Prompt Generation Pipeline",
    no_args_is_help=True
)

pipeline = Pipeline()

@app.command(name="create", help="Create a complete game design specification package and AI prompt.")
def create(
    idea: Optional[str] = typer.Argument(None, help="Game idea or description"),
    file: Optional[Path] = typer.Option(None, "--file", "-f", help="Read idea from text/markdown file"),
    interactive: bool = typer.Option(False, "--interactive", "-i", help="Run interactive prompt wizard"),
    mode: str = typer.Option("standard", "--mode", "-m", help="Generation mode: fast, standard, deep"),
    renderer: str = typer.Option("auto", "--renderer", "-r", help="Rendering engine (Three.js only): auto | threejs"),
    # Офлайн-провайдер отключён: значение 'local' здесь больше не принимается
    # (ProviderFactory отвечает на него понятной ошибкой), а дефолт берётся из
    # DEFAULT_PROVIDER. Картиночный провайдер это не затрагивает: 'local' там —
    # процедурная заглушка превью, а не подделка концепции.
    provider: str = typer.Option("default", "--provider", "-p", help="AI provider (CLI-агенты): agy, claude, codex, opencode"),
    image_provider: str = typer.Option("local", "--image-provider", help="Image generator: qwen, agy, local, none"),
    output_dir: Path = typer.Option(Path("output"), "--output-dir", "-o", help="Target output directory")
):
    final_prompt = ""
    if file and file.exists():
        with open(file, "r", encoding="utf-8") as f:
            final_prompt = f.read().strip()
    elif interactive:
        console.print("[bold cyan]🎮 AI Game Prompt Factory: Interactive Wizard[/bold cyan]")
        user_idea = Prompt.ask("[bold white]1. Название / Описание идеи[/bold white]")
        genre = Prompt.ask("[bold white]2. Жанр (или Enter для авто-определения)[/bold white]", default="")
        special = Prompt.ask("[bold white]3. Особые требования / Механики[/bold white]", default="")
        platform = Prompt.ask("[bold white]4. Платформа[/bold white]", default="Яндекс Игры / Playgama Bridge")
        pref_renderer = Prompt.ask("[bold white]5. Renderer (auto / threejs)[/bold white]", default="auto")
        if pref_renderer != "auto":
            renderer = pref_renderer
        
        parts = [user_idea]
        if genre: parts.append(f"Жанр: {genre}")
        if special: parts.append(f"Особые требования: {special}")
        if platform: parts.append(f"Платформа: {platform}")
        final_prompt = "\n".join(parts)
    elif idea:
        final_prompt = idea
    else:
        log_error("Please provide an idea string, --file <path>, or --interactive flag.")
        raise typer.Exit(code=1)

    console.print(f"[bold cyan]🚀 Initializing AI Game Prompt Factory[/bold cyan] [dim](Mode: {mode}, Provider: {provider}, Renderer: {renderer})[/dim]")
    _run_or_pause(
        raw_prompt=final_prompt,
        output_dir=output_dir,
        mode=mode,
        forced_renderer=renderer if renderer != "auto" else None,
        provider_name=provider,
        image_provider_name=image_provider,
    )


def _run_or_pause(**kwargs) -> None:
    """Запускает прогон и показывает паузу по-человечески.

    Приостановленный прогон — это не падение: всё сделанное лежит в сессии.
    Печатать сюда стектрейс незачем, нужен идентификатор и команда продолжения."""
    try:
        pipeline.run(**kwargs)
    except RunPaused as paused:
        console.print(f"\n[bold yellow]⏸ Прогон приостановлен[/bold yellow]\n{paused}")
        if paused.run_id:
            try:
                session = RunSession.load(paused.run_id, kwargs["output_dir"])
                chat_hint = f"\n[dim]Чат прогона:[/dim] {session.chat_file}"
            except FileNotFoundError:
                chat_hint = ""
            console.print(
                chat_hint
                + f"\n[bold]Продолжить:[/bold] python -m app.cli continue {paused.run_id}"
            )
        raise typer.Exit(code=2)


@app.command(name="continue", help="Продолжить приостановленный прогон с места остановки.")
def continue_run(
    run_id: str = typer.Argument(..., help="Идентификатор прогона (см. `runs`); можно часть"),
    output_dir: Path = typer.Option(Path("output"), "--output-dir", "-o", help="Каталог с прогонами"),
    provider: str = typer.Option("", "--provider", "-p", help="Сменить провайдера на продолжении"),
    image_provider: str = typer.Option("local", "--image-provider", help="Image generator: qwen, agy, local, none"),
):
    session = RunSession.load(run_id, output_dir)
    console.print(
        f"[bold cyan]▶ Продолжаю прогон[/bold cyan] [highlight]{session.run_id}[/highlight]\n"
        f"[dim]{session.raw_prompt}[/dim]"
    )
    _run_or_pause(
        raw_prompt=session.raw_prompt,
        output_dir=output_dir,
        provider_name=provider or session.provider_name,
        image_provider_name=image_provider,
        resume_run_id=session.run_id,
    )


@app.command(name="runs", help="Показать прогоны: что завершено, что можно продолжить.")
def list_runs(
    output_dir: Path = typer.Option(Path("output"), "--output-dir", "-o", help="Каталог с прогонами"),
    limit: int = typer.Option(20, "--limit", "-n", help="Сколько показать"),
):
    rows = RunSession.list_runs(output_dir)
    if not rows:
        console.print(f"[dim]Прогонов не найдено в {RunSession.runs_dir(output_dir)}[/dim]")
        return

    table = Table(title="Прогоны фабрики")
    table.add_column("Прогон", style="cyan", no_wrap=True)
    table.add_column("Проект", style="magenta")
    table.add_column("Игра")
    table.add_column("Идея")
    table.add_column("Шагов", justify="right")
    table.add_column("Статус")
    for row in rows[:limit]:
        if row["finished"]:
            status = "[green]собран[/green]"
        elif row["failed"]:
            status = f"[yellow]пауза на {row['failed'][0]}[/yellow]"
        else:
            status = "[dim]не завершён[/dim]"
        table.add_row(row["run_id"], row.get("slug", ""),
                      row.get("title", "") or "[dim]—[/dim]",
                      (row["raw_prompt"] or "")[:50], str(row["done"]), status)
    console.print(table)
    console.print("[dim]Продолжить: python -m app.cli continue <прогон>[/dim]")

@app.command(name="analyze", help="Analyze game concept and estimate viability scores without generating full package.")
def analyze(
    idea: str = typer.Argument(..., help="Game concept to analyze"),
    provider: str = typer.Option("default", "--provider", "-p", help="AI provider (CLI-агенты): agy, claude, codex, opencode")
):
    console.print(f"[bold cyan]🔍 Analyzing Game Concept Viability...[/bold cyan]")
    ctx = GenerationContext(
        raw_prompt=idea,
        output_base_dir=Path("output"),
        provider_name=provider,
        ai_provider=ProviderFactory.get_ai_provider(provider)
    )
    concept = IdeaAnalyzerAgent().run(ctx)

    table = Table(title=f"Game Concept Analysis: {concept.title}", header_style="bold magenta")
    table.add_column("Property", style="cyan")
    table.add_column("Value", style="white")
    table.add_row("Genre", f"{concept.genre} ({concept.subgenre})")
    table.add_row("Recommended Renderer", f"{concept.renderer.upper()} ({concept.renderer_confidence:.0%})")
    table.add_row("Core Hook", concept.hook)
    table.add_row("Player Fantasy", concept.player_fantasy)
    table.add_row("Session Model", concept.session_model)
    table.add_row("Overall Viability Score", f"[bold green]{concept.scores.overall_score:.1f} / 10[/bold green]")
    table.add_row("Fun Score", f"{concept.scores.fun}/10")
    table.add_row("Replayability", f"{concept.scores.replayability}/10")
    table.add_row("Mobile Fit", f"{concept.scores.mobile_fit}/10")
    table.add_row("Monetization Potential", f"{concept.scores.monetization}/10")
    console.print(table)

@app.command(name="preview", help="Re-generate concept preview image for an existing project.")
def preview(
    game_id: str = typer.Argument(..., help="Game folder name or slug"),
    output_dir: Path = typer.Option(Path("output"), "--output-dir", "-o")
):
    pipeline.rebuild_preview(game_id, output_dir)

@app.command(name="rebuild-docs", help="Re-generate all markdown documentation files for an existing project.")
def rebuild_docs(
    game_id: str = typer.Argument(..., help="Game folder name or slug"),
    output_dir: Path = typer.Option(Path("output"), "--output-dir", "-o")
):
    pipeline.rebuild_docs(game_id, output_dir)

@app.command(name="rebuild-prompt", help="Recompile the master AI developer prompt (AI_DEVELOPER_PROMPT.md).")
def rebuild_prompt(
    game_id: str = typer.Argument(..., help="Game folder name or slug"),
    output_dir: Path = typer.Option(Path("output"), "--output-dir", "-o")
):
    pipeline.rebuild_prompt(game_id, output_dir)

@app.command(name="skills", help="Re-generate skills directory and markdown instruction files.")
def skills(
    game_id: str = typer.Argument(..., help="Game folder name or slug"),
    output_dir: Path = typer.Option(Path("output"), "--output-dir", "-o")
):
    pipeline.rebuild_skills(game_id, output_dir)

@app.command(name="validate", help="Run comprehensive consistency and completeness validation suite on a project.")
def validate(
    game_id: str = typer.Argument(..., help="Game folder name or slug"),
    output_dir: Path = typer.Option(Path("output"), "--output-dir", "-o")
):
    pipeline.validate_game(game_id, output_dir)

@app.command(name="rebuild", help="Incrementally rebuild a specific section (monetization, architecture, preview, skills, etc.).")
def rebuild(
    game_id: str = typer.Argument(..., help="Game folder name or slug"),
    section: str = typer.Option(..., "--section", "-s", help="Section to rebuild: monetization, architecture, preview, skills, gameplay, playgama"),
    output_dir: Path = typer.Option(Path("output"), "--output-dir", "-o")
):
    pipeline.rebuild_section(game_id, section, output_dir)

@app.command(name="list", help="List all generated game projects in the output directory.")
def list_projects(
    output_dir: Path = typer.Option(Path("output"), "--output-dir", "-o")
):
    if not output_dir.exists():
        console.print("[dim]No projects found. Output directory does not exist.[/dim]")
        return
    
    projects = [p for p in output_dir.iterdir() if p.is_dir() and (p / "GAME_DATA.yaml").exists()]
    if not projects:
        console.print("[dim]No valid game projects found in output directory.[/dim]")
        return

    table = Table(title="Generated Game Projects", header_style="bold magenta")
    table.add_column("Folder / Slug", style="cyan")
    table.add_column("Title", style="white")
    table.add_column("Genre", style="yellow")
    table.add_column("Renderer", style="bold")
    table.add_column("Score", style="green")

    for proj in projects:
        try:
            with open(proj / "GAME_DATA.yaml", "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            title = data.get("title", proj.name)
            genre = data.get("genre", "Unknown")
            renderer = data.get("renderer", "N/A").upper()
            score = data.get("scores", {}).get("overall_score", "N/A")
            table.add_row(proj.name, title, genre, renderer, f"{score}")
        except Exception:
            table.add_row(proj.name, "Error reading metadata", "", "", "")

    console.print(table)

@app.command(name="test-provider", help="Test connectivity and response of an AI provider (agy, claude, codex, opencode).")
def test_provider(
    provider: str = typer.Argument("agy", help="Provider name: agy, claude, codex, opencode")
):
    console.print(f"[bold cyan]Testing AI Provider: {provider}[/bold cyan]")
    prov = ProviderFactory.get_ai_provider(provider)
    if hasattr(prov, "test_connection"):
        res = prov.test_connection()
        if res.get("status") == "success":
            log_success(f"Provider '{provider}' test PASSED!\n{res}")
        else:
            log_error(f"Provider '{provider}' test FAILED!\n{res}")
    else:
        text = prov.generate_text("System", "Ping test. Respond with OK.", max_tokens=10)
        log_success(f"Provider '{provider}' responded: {text[:80]}")

# ---------------------------------------------------------------------------
# Design OS: проверяемый слой поверх спецификации.
# ---------------------------------------------------------------------------

def _project_dir(game_id: str, output_dir: Path) -> Path:
    """Находит каталог проекта по имени папки или части слага."""
    candidate = output_dir / game_id
    if candidate.exists():
        return candidate
    matches = [p for p in output_dir.glob(f"*{game_id}*") if p.is_dir()]
    if matches:
        return matches[0]
    log_error(f"Проект '{game_id}' не найден в {output_dir}")
    raise typer.Exit(code=1)


@app.command(name="catalog", help="Пересобрать каталог готового кода из стенда (knowledge/mechanics/CATALOG.yaml).")
def rebuild_catalog():
    from app import library
    entries = library.scan()
    if not entries:
        console.print("[bold red]Стенд не найден — каталог не пересобран.[/bold red]")
        raise typer.Exit(code=1)
    path = library.save(entries)
    by_kind = {}
    for entry in entries:
        by_kind[entry.kind] = by_kind.get(entry.kind, 0) + 1
    console.print(f"[bold green]Каталог пересобран:[/bold green] {len(entries)} модулей → {path}")
    for kind, count in sorted(by_kind.items()):
        console.print(f"  {library.KIND_LABELS.get(kind, kind)}: {count}")


@app.command(name="checklists",
             help="Собрать чек-листы документов базы знаний (knowledge/CHECKLISTS.yaml).")
def rebuild_checklists(
    provider: str = typer.Option("default", "--provider", "-p", help="Провайдер для генерации"),
    all_docs: bool = typer.Option(False, "--all", help="Пересобрать всё, а не только недостающее"),
    only: str = typer.Option("", "--only", help="Подстрока пути: собрать часть базы (например threejs/)"),
):
    """Чек-лист документа — то, что реально доезжает до кодового агента.

    Полный текст документа он читать не станет: разобранный шутер получил
    документ на 726 строк и не открыл его ни разу. Чек-лист едет рядом с
    адресом, стоит десяток строк и проверяется взглядом на запущенную игру.

    Писать их руками нельзя: это работа, растущая с каждым новым жанром.
    Поэтому — один проход по базе, кэш с хешем исходника и пересборка только
    того, что изменилось или чего ещё нет."""
    from app import checklists, knowledge

    entries = checklists.load()
    paths = [p for p in knowledge.list_topics() if not p.endswith(".yaml")]
    if only:
        paths = [p for p in paths if only in p]

    todo = []
    for path in paths:
        body = knowledge.read(path)
        if not body.strip():
            continue
        # Свой список в документе главнее любого сгенерированного.
        if any(line.strip().startswith(("- [ ]", "* [ ]")) for line in body.splitlines()):
            continue
        if all_docs or path not in entries or checklists.is_stale(path, body, entries):
            todo.append((path, body))

    if not todo:
        console.print("[bold green]Чек-листы на месте[/bold green] — пересобирать нечего.")
        return

    console.print(f"[cyan]Собираю чек-листы: {len(todo)} документов[/cyan]")
    ai = ProviderFactory.get_ai_provider(provider)
    done = 0
    for path, body in todo:
        try:
            entry = checklists.draft(ai, path, body)
        except Exception as exc:  # noqa: BLE001 — один упавший документ не роняет проход
            log_error(f"{path}: {exc}")
            continue
        if len(entry.items) < checklists.MIN_ITEMS:
            log_error(f"{path}: вернулось {len(entry.items)} пунктов — пропущен")
            continue
        entries[path] = entry
        done += 1
        console.print(f"  [green]✓[/green] {path} — {len(entry.items)} пунктов")

    path_out = checklists.save(entries)
    log_success(f"Готово: {done} из {len(todo)} → {path_out}")
    missing = [p for p in paths if not knowledge.checklist(p)]
    if missing:
        console.print(f"[yellow]Без чек-листа осталось: {len(missing)}[/yellow]")


@app.command(name="gate", help="Прогнать приёмку игры: сборка, статика, запуск в браузере.")
def gate(
    game_id: str = typer.Argument(..., help="Слаг проекта в workspace/"),
    fix: bool = typer.Option(False, "--fix", help="Показать задачу на починку, а не только отчёт"),
    static_only: bool = typer.Option(False, "--static", help="Без запуска браузера — только чтение исходников"),
):
    """Та же приёмка, что идёт после каждой фазы сборки, но по требованию.

    Нужна там, где игру правил человек или чат проекта: отчёт агента о
    собственной работе основанием считаться перестал, а проверить как-то надо.
    """
    from app import acceptance, sandbox

    project = sandbox.project_dir(game_id)
    if not project.exists():
        log_error(f"Проект '{game_id}' не найден в {sandbox.workspace_root()}")
        raise typer.Exit(code=2)

    report = acceptance.run_gate(project, on_log=lambda line: console.print(line, end=""),
                                 with_smoke=not static_only)
    acceptance.write_gate_report(project, report)
    acceptance.stamp_generation(project, report)

    console.print()
    for check in (*report.spec, *report.smoke):
        console.print(check.line())
    console.print(f"\n[bold]{report.summary()}[/bold]")
    if report.metrics_line():
        console.print(f"[dim]{report.metrics_line()}[/dim]")

    if report.ok:
        log_success("Игра принята: проверено запуском, а не отчётом агента.")
        return
    if fix:
        console.print("\n[bold cyan]Задача агенту:[/bold cyan]\n")
        console.print(report.repair_task())
    raise typer.Exit(code=1)


@app.command(name="lessons", help="Пересобрать свод уроков фабрики из отчётов приёмки всех игр.")
def lessons():
    from app import gate_stats

    summary = gate_stats.collect()
    path = gate_stats.publish(summary)
    log_success(f"Свод обновлён: {path}")
    console.print(f"[dim]Игр с приёмкой: {summary['projects']}, зелёных: {summary['green']}[/dim]")

    ranked = summary.get("ranked") or []
    if not ranked:
        console.print("[dim]Красных проверок пока нет — учиться не на чем.[/dim]")
        return
    table = Table(title="Чаще всего красное")
    table.add_column("Проверка", style="cyan")
    table.add_column("Что это")
    table.add_column("Игр", justify="right")
    table.add_column("Прогонов", justify="right")
    for row in ranked[:12]:
        table.add_row(row["id"], row["title"] or "—", str(row["projects"]), str(row["runs"]))
    console.print(table)


if __name__ == "__main__":
    app()
