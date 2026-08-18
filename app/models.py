from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict

class BaseSafeModel(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

class GameScores(BaseSafeModel):
    fun: int = Field(default=8, ge=1, le=10, description="Immediate entertainment value and satisfying core game feel")
    originality: int = Field(default=8, ge=1, le=10, description="Uniqueness of mechanics, theme, and twist")
    replayability: int = Field(default=9, ge=1, le=10, description="Depth of roguelite build variance and progression")
    development_cost: int = Field(default=6, ge=1, le=10, description="Feasibility score (higher = easier to build within browser budget)")
    visual_appeal: int = Field(default=8, ge=1, le=10, description="Readability and spectacle of physics, VFX, and camera")
    mobile_fit: int = Field(default=9, ge=1, le=10, description="Ergonomics of touch controls and portrait/landscape adaptation")
    monetization: int = Field(default=8, ge=1, le=10, description="Natural fit for rewarded ads, revives, and cosmetic IAPs")
    platform_fit: int = Field(default=9, ge=1, le=10, description="Suitability for Playgama Bridge & Yandex Games ecosystems")
    overall_score: float = Field(default=8.2, description="Weighted aggregate score")
    justification: str = Field(default="", description="Summary explanation of the evaluation scores")

class ReferenceSpec(BaseSafeModel):
    name: str = Field(default="")
    genre: str = Field(default="")
    mechanics: List[str] = Field(default_factory=list)
    lessons: str = Field(default="")
    what_to_avoid: str = Field(default="")

class MechanicSpec(BaseSafeModel):
    name: str = Field(default="")
    category: str = Field(default="combat")
    priority: str = Field(default="core")
    description: str = Field(default="")
    player_interaction: str = Field(default="")
    feedback: str = Field(default="")
    technical_complexity: str = Field(default="Medium")
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)

class SystemSpec(BaseSafeModel):
    name: str = Field(default="")
    purpose: str = Field(default="")
    input: str = Field(default="")
    rules: List[str] = Field(default_factory=list)
    state: List[str] = Field(default_factory=list)
    interactions: str = Field(default="")
    feedback: str = Field(default="")
    edge_cases: List[str] = Field(default_factory=list)

class RewardedAdPlacement(BaseSafeModel):
    id: str = Field(default="revive")
    name: str = Field(default="Rewarded Video")
    benefit: str = Field(default="")
    cooldown_or_limit: str = Field(default="1 per run")
    trigger_moment: str = Field(default="")

class InterstitialAdPlacement(BaseSafeModel):
    trigger_event: str = Field(default="")
    cooldown_seconds: int = Field(default=90)
    conditions: str = Field(default="")

class InAppPurchaseItem(BaseSafeModel):
    sku: str = Field(default="")
    name: str = Field(default="")
    description: str = Field(default="")
    price_tier: str = Field(default="")
    reward: str = Field(default="")

class MonetizationSpec(BaseSafeModel):
    strategy_summary: str = Field(default="")
    rewarded_placements: List[RewardedAdPlacement] = Field(default_factory=list)
    interstitial_placements: List[InterstitialAdPlacement] = Field(default_factory=list)
    in_app_purchases: List[InAppPurchaseItem] = Field(default_factory=list)
    fairness_rules: List[str] = Field(default_factory=list)

class PlaygamaSpec(BaseSafeModel):
    sdk_version: str = Field(default="@playgama/bridge 2.x")
    supported_platforms: List[str] = Field(default_factory=lambda: ["yandex", "vk", "ok", "crazy_games", "playgama"])
    initialization_flow: List[str] = Field(default_factory=list)
    cloud_save_keys: List[str] = Field(default_factory=list)
    leaderboards: List[str] = Field(default_factory=list)
    ads_integration: Dict[str, Any] = Field(default_factory=dict)
    lifecycle_hooks: List[str] = Field(default_factory=list)

class TechArchitectureSpec(BaseSafeModel):
    language: str = Field(default="TypeScript (strict mode)")
    bundler: str = Field(default="Vite")
    renderer: str = Field(default="threejs")
    renderer_version: str = Field(default="^0.170.0")
    physics_engine: str = Field(default="Rapier3D (@dimforge/rapier3d-compat)")
    state_manager: str = Field(default="Reactive EventBus / State Store")
    # Web Audio only: an <audio>/HTML5 Audio element registers a media session and
    # trips Yandex requirements 1.6.1.6 / 1.6.2.5 (player in the notification panel).
    audio_engine: str = Field(default="Web Audio API (Howler.js with html5: false)")
    target_fps: int = Field(default=60)
    max_draw_calls: int = Field(default=80)
    max_triangles_or_sprites: int = Field(default=45000)
    bundle_size_budget_mb: float = Field(default=4.5)
    layers: List[Dict[str, Any]] = Field(default_factory=list)
    modules: List[Dict[str, str]] = Field(default_factory=list)

class ArtSpec(BaseSafeModel):
    style_name: str = Field(default="")
    camera_perspective: str = Field(default="")
    camera_fov: int = Field(default=50)
    camera_pitch_angle: int = Field(default=45)
    environment_theme: str = Field(default="")
    character_proportions: str = Field(default="")
    lighting_setup: str = Field(default="")
    color_palette: Dict[str, str] = Field(default_factory=dict)
    vfx_list: List[str] = Field(default_factory=list)
    ui_theme: str = Field(default="")

class UIUXSpec(BaseSafeModel):
    hud_elements: List[str] = Field(default_factory=list)
    screens: List[Dict[str, str]] = Field(default_factory=list)
    mobile_controls_layout: str = Field(default="")
    keyboard_controls: Dict[str, str] = Field(default_factory=dict)
    touch_controls: Dict[str, str] = Field(default_factory=dict)
    wireframes_ascii: str = Field(default="")

class MobileSpec(BaseSafeModel):
    orientation: str = Field(default="landscape")
    touch_implementation: str = Field(default="")
    safe_area_handling: str = Field(default="")
    performance_throttling: List[str] = Field(default_factory=list)

class RoadmapPhase(BaseSafeModel):
    phase_number: int = Field(default=1)
    title: str = Field(default="")
    duration_days: int = Field(default=2)
    tasks: List[str] = Field(default_factory=list)
    milestone_deliverable: str = Field(default="")

class QASpec(BaseSafeModel):
    functional_tests: List[str] = Field(default_factory=list)
    performance_benchmarks: List[str] = Field(default_factory=list)
    cross_browser_matrix: List[str] = Field(default_factory=list)
    common_bug_checklist: List[str] = Field(default_factory=list)

class RiskItem(BaseSafeModel):
    risk: str = Field(default="")
    category: str = Field(default="technical")
    severity: str = Field(default="Medium")
    mitigation: str = Field(default="")

class SkillDoc(BaseSafeModel):
    skill_id: str = Field(default="")
    name: str = Field(default="")
    filename: str = Field(default="")
    purpose: str = Field(default="")
    when_to_use: str = Field(default="")
    rules: List[str] = Field(default_factory=list)
    architecture: str = Field(default="")
    implementation_guidance: str = Field(default="")
    common_mistakes: List[str] = Field(default_factory=list)
    checklist: List[str] = Field(default_factory=list)
    # Relative paths under knowledge/ whose full text is embedded into the
    # generated skill file, so the coding agent gets the worked-out detail
    # instead of a summary that drifts from the knowledge base.
    knowledge_refs: List[str] = Field(default_factory=list)

class GameConcept(BaseSafeModel):
    raw_prompt: str = Field(default="")
    title: str = Field(default="")
    slug: str = Field(default="")
    genre: str = Field(default="")
    subgenre: str = Field(default="")
    renderer: str = Field(default="threejs")
    renderer_reason: str = Field(default="")
    renderer_confidence: float = Field(default=0.95)
    platform: str = Field(default="Playgama Bridge (Yandex Games / VK / Web)")
    orientation: str = Field(default="landscape")
    target_audience: str = Field(default="")
    core_loop: str = Field(default="")
    hook: str = Field(default="")
    player_fantasy: str = Field(default="")
    session_model: str = Field(default="5-10 minute roguelite arena runs with persistent meta-progression")
    unique_value_proposition: str = Field(default="")
    vision: str = Field(default="")
    elevator_pitch: str = Field(default="")
    win_conditions: str = Field(default="")
    lose_conditions: str = Field(default="")
    progression_summary: str = Field(default="")
    difficulty_curve: str = Field(default="")
    scores: GameScores = Field(default_factory=GameScores)
    references: List[ReferenceSpec] = Field(default_factory=list)
    mechanics: List[MechanicSpec] = Field(default_factory=list)
    gameplay_systems: List[SystemSpec] = Field(default_factory=list)
    tech_spec: TechArchitectureSpec = Field(default_factory=TechArchitectureSpec)
    monetization: MonetizationSpec = Field(default_factory=MonetizationSpec)
    playgama: PlaygamaSpec = Field(default_factory=PlaygamaSpec)
    art: ArtSpec = Field(default_factory=ArtSpec)
    ui_ux: UIUXSpec = Field(default_factory=UIUXSpec)
    mobile: MobileSpec = Field(default_factory=MobileSpec)
    audio: Dict[str, Any] = Field(default_factory=dict)
    qa: QASpec = Field(default_factory=QASpec)
    roadmap: List[RoadmapPhase] = Field(default_factory=list)
    risks: List[RiskItem] = Field(default_factory=list)
    skills: List[SkillDoc] = Field(default_factory=list)
    preview_prompt: str = Field(default="")
    preview_image_path: Optional[str] = Field(default="preview/concept_preview.png")
    preview_status: str = Field(default="pending")
    definition_of_done: List[str] = Field(default_factory=list)

class GenerationMetadata(BaseSafeModel):
    user_prompt: str = Field(default="")
    slug: str = Field(default="")
    title: str = Field(default="")
    timestamp: str = Field(default="")
    provider: str = Field(default="")
    model: str = Field(default="")
    renderer: str = Field(default="")
    mode: str = Field(default="standard")
    status: str = Field(default="completed")
    scores: Dict[str, Any] = Field(default_factory=dict)
    generated_files: List[str] = Field(default_factory=list)
    validation_status: Dict[str, Any] = Field(default_factory=dict)
