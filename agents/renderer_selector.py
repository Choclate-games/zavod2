from app.context import GenerationContext
from app.logging import log_agent

# Фабрика выпускает игры только на Three.js. Двумерные проекты — это та же сцена под
# ортографической камерой (`knowledge/threejs/orthographic_2d_and_pointer_input.md`),
# а не второй рендерер: один бандл, одна система качества, один набор уже починенных
# багов. Агент остался в пайплайне, потому что он всё ещё выбирает *конфигурацию*
# стека (перспектива/ортография, нужен ли навмеш, нужна ли постобработка).
RENDERER = "threejs"

# Версии, на которых проверена база знаний (`knowledge/stack/README.md`).
THREE_VERSION = "^0.185.1"
PHYSICS_ENGINE = "Rapier3D (@dimforge/rapier3d-compat ^0.20.0)"

_3D_HINTS = (
    "3d", "ragdoll", "physics", "физик", "глубин", "spatial", "arena", "арен",
    "гонк", "racing", "drift", "шутер", "shooter", "fps", "стелс", "stealth",
    "файтинг", "fighting", "машин", "vehicle", "полёт", "flight",
)


class RendererSelectorAgent:
    """Фиксирует Three.js и подбирает конфигурацию стека под жанр."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept

        forced = (ctx.forced_renderer or "").strip().lower()
        if forced and forced not in ("auto", "threejs", "three.js", "three"):
            log_agent(
                "RendererSelector",
                f"[warn]Запрошен рендерер '{forced}', но фабрика собирает только Three.js — "
                f"использую Three.js с ортографической камерой для 2D.[/warn]",
            )

        concept.renderer = RENDERER
        concept.renderer_confidence = 1.0

        lower = (ctx.raw_prompt + " " + concept.genre).lower()
        spatial = any(w in lower for w in _3D_HINTS)
        if spatial:
            concept.renderer_reason = (
                "Three.js + Rapier3D: пространственный геймплей, физика и освещение. "
                "Перспективная камера."
            )
        else:
            concept.renderer_reason = (
                "Three.js + Rapier3D. Выпуск 2D-игр временно отключён "
                "(pipeline.enable_2d), поэтому даже плоский замысел собирается "
                "как 3D с перспективной камерой."
            )

        concept.tech_spec.renderer = RENDERER
        concept.tech_spec.renderer_version = THREE_VERSION
        concept.tech_spec.physics_engine = PHYSICS_ENGINE

        # Ортографическая ветка вернётся вместе с pipeline.enable_2d.
        camera = "perspective"
        log_agent(
            "RendererSelector",
            f"Renderer: [highlight]THREE.JS[/highlight] ({camera} camera) | {concept.renderer_reason}",
        )
