import re
from pathlib import Path
from app.context import GenerationContext
from app.logging import log_agent, log_success

class SkillGenerator:
    """Generates all game-specific and specialized Markdown skill files in skills/ directory."""

    def generate(self, ctx: GenerationContext):
        concept = ctx.concept
        skills_dir = ctx.game_dir / "skills"
        skills_dir.mkdir(parents=True, exist_ok=True)
        
        skills = concept.skills if isinstance(concept.skills, list) else []
        log_agent("SkillGenerator", f"Writing {len(skills)} skill instruction documents into {skills_dir}")
        
        for idx, skill in enumerate(skills, 1):
            raw_filename = getattr(skill, "filename", None) or f"SKILL_{idx}.md"
            safe_filename = Path(raw_filename).name
            if not safe_filename.endswith(".md"):
                safe_filename += ".md"
            safe_filename = re.sub(r"[^\w\-.]", "_", safe_filename)
            
            file_path = skills_dir / safe_filename
            
            rules = skill.rules if isinstance(skill.rules, list) else [str(skill.rules)]
            mistakes = skill.common_mistakes if isinstance(skill.common_mistakes, list) else [str(skill.common_mistakes)]
            checklist = skill.checklist if isinstance(skill.checklist, list) else [str(skill.checklist)]
            
            rules_md = "\n".join([f"- {r}" for r in rules]) if rules else "- Follow standard game rules."
            mistakes_md = "\n".join([f"- ❌ **Mistake**: {m}" for m in mistakes]) if mistakes else "- ❌ Avoid unoptimized loops."
            checklist_md = "\n".join([f"- [ ] {c}" for c in checklist]) if checklist else "- [ ] Verify functionality."
            
            name = getattr(skill, "name", f"Skill {idx}")
            purpose = getattr(skill, "purpose", "Domain guidance.")
            when_to_use = getattr(skill, "when_to_use", "During game systems implementation.")
            architecture = getattr(skill, "architecture", "Decoupled modular architecture.")
            guidance = getattr(skill, "implementation_guidance", "Follow standard project practices.")
            
            content = f"""# Skill: {name}

## Purpose
{purpose}

## When to Use
{when_to_use}

## Core Rules & Constraints
{rules_md}

## System Architecture
{architecture}

## Implementation Guidance
{guidance}

## Common Mistakes to Avoid
{mistakes_md}

## Validation Checklist
{checklist_md}
"""
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content.strip() + "\n")
            ctx.generated_files.append(file_path)
            
        log_success(f"Generated {len(skills)} skill docs in [highlight]{skills_dir.name}/[/highlight]")
