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
    renderer: str = typer.Option("auto", "--renderer", "-r", help="Rendering engine: auto, threejs, pixijs"),
    provider: str = typer.Option("local", "--provider", "-p", help="AI provider: agy, opencode, local, openai, anthropic, google"),
    image_provider: str = typer.Option("local", "--image-provider", help="Image generator: local, openai"),
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
        pref_renderer = Prompt.ask("[bold white]5. Renderer (auto / threejs / pixijs)[/bold white]", default="auto")
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
    pipeline.run(
        raw_prompt=final_prompt,
        output_dir=output_dir,
        mode=mode,
        forced_renderer=renderer if renderer != "auto" else None,
        provider_name=provider,
        image_provider_name=image_provider
    )

@app.command(name="analyze", help="Analyze game concept and estimate viability scores without generating full package.")
def analyze(
    idea: str = typer.Argument(..., help="Game concept to analyze"),
    provider: str = typer.Option("local", "--provider", "-p", help="AI provider: agy, opencode, local, openai, anthropic, google")
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

@app.command(name="test-provider", help="Test connectivity and response of an AI provider (agy, opencode, local, openai, etc.).")
def test_provider(
    provider: str = typer.Argument("agy", help="Provider name: agy, opencode, local, openai, anthropic, google")
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

@app.command(name="gui", help="Launch the native CustomTkinter Desktop GUI.")
def launch_gui():
    from app.gui.ctk_app import run_gui
    console.print("[bold green]🎮 Starting AI Game Prompt Factory (CustomTkinter GUI)...[/bold green]")
    run_gui()

if __name__ == "__main__":
    app()
