from pathlib import Path
from typing import Dict, List, Any
from rich.table import Table

from app.logging import console
from validators.document_validator import DocumentValidator
from validators.consistency_validator import ConsistencyValidator
from validators.completeness_validator import CompletenessValidator
from validators.contradiction_validator import ContradictionValidator

class OutputValidator:
    """Master validator aggregating document, consistency, and completeness checks."""

    def __init__(self):
        self.doc_val = DocumentValidator()
        self.const_val = ConsistencyValidator()
        self.comp_val = CompletenessValidator()
        self.cont_val = ContradictionValidator()

    def run_all(self, game_dir: Path, concept=None) -> bool:
        doc_pass, doc_results = self.doc_val.validate(game_dir)
        const_pass, const_results = self.const_val.validate(game_dir)
        comp_pass, comp_results = self.comp_val.validate(game_dir)

        # Промпт, который спорит сам с собой, кодовый агент не чинит — он
        # выбирает одно из двух требований, обычно то, что сформулировано
        # конкретнее. Расхождение дешевле поймать здесь.
        cont_pass, cont_results = True, []
        prompt_file = game_dir / "AI_DEVELOPER_PROMPT.md"
        if concept is not None and prompt_file.exists():
            cont_pass, cont_results = self.cont_val.validate(
                prompt_file.read_text(encoding="utf-8", errors="ignore"), concept
            )

        table = Table(title=f"Validation Suite Report: {game_dir.name}", header_style="bold magenta")
        table.add_column("Category", style="cyan")
        table.add_column("Item", style="white")
        table.add_column("Status", style="bold")
        table.add_column("Details", style="dim")

        for r in doc_results:
            status_style = "green" if r["status"] == "PASS" else "red"
            table.add_row("Document Suite", r["item"], f"[{status_style}]{r['status']}[/{status_style}]", r["detail"])

        for r in const_results:
            status_style = "green" if r["status"] == "PASS" else ("yellow" if r["status"] == "WARN" else "red")
            table.add_row("Consistency", r["item"], f"[{status_style}]{r['status']}[/{status_style}]", r["detail"])

        for r in comp_results:
            status_style = "green" if r["status"] == "PASS" else ("yellow" if r["status"] == "WARN" else "red")
            table.add_row("Completeness", r["item"], f"[{status_style}]{r['status']}[/{status_style}]", r["detail"])

        for r in cont_results:
            status_style = "green" if r["status"] == "PASS" else "yellow"
            table.add_row("Self-consistency", r["item"],
                          f"[{status_style}]{r['status']}[/{status_style}]", r["detail"])

        console.print(table)
        # Противоречие не валит пакет: формулировка запрета — живой текст
        # человека, и совпадение слов бывает случайным. Но оно обязано быть
        # видно в отчёте, а не остаться внутри промпта.
        if not cont_pass:
            console.print(
                "[yellow]В мастер-промпте есть места, где требование спорит с запретом "
                "проекта. Проверьте их: кодовый агент выберет одно из двух сам.[/yellow]"
            )
        return doc_pass and const_pass and comp_pass
