from pathlib import Path
from typing import Dict, List, Any
from rich.table import Table

from app.logging import console
from validators.document_validator import DocumentValidator
from validators.consistency_validator import ConsistencyValidator
from validators.completeness_validator import CompletenessValidator
from validators.design_os_validator import DesignOsValidator

class OutputValidator:
    """Master validator aggregating document, consistency, and completeness checks."""

    def __init__(self):
        self.doc_val = DocumentValidator()
        self.const_val = ConsistencyValidator()
        self.comp_val = CompletenessValidator()
        self.design_os_val = DesignOsValidator()

    def run_all(self, game_dir: Path) -> bool:
        doc_pass, doc_results = self.doc_val.validate(game_dir)
        const_pass, const_results = self.const_val.validate(game_dir)
        comp_pass, comp_results = self.comp_val.validate(game_dir)
        design_pass, design_results = self.design_os_val.validate(game_dir)

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

        for r in design_results:
            status_style = "green" if r["status"] == "PASS" else ("yellow" if r["status"] == "WARN" else "red")
            table.add_row("Design OS", r["item"], f"[{status_style}]{r['status']}[/{status_style}]", r["detail"])

        console.print(table)
        return doc_pass and const_pass and comp_pass and design_pass
