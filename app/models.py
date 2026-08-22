from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict

class BaseSafeModel(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

class GameScores(BaseSafeModel):
    fun: int = Field(default=8, ge=1, le=10, description="Immediate entertainment value and satisfying core game feel")
    originality: int = Field(default=8, ge=1, le=10, description="Uniqueness of mechanics, theme, and twist")
    replayability: int = Field(default=9, ge=1, le=10, description="Depth of variety and reasons to start again")
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

class MechanicParameter(BaseSafeModel):
    """Числовой параметр механики: без чисел спецификация превращается в лозунг."""
    name: str = Field(default="", description="Название параметра, например «окно парирования»")
    value: str = Field(default="", description="Конкретное значение с единицей: 0.18 с, 12 ед/с, 3 заряда")
    tuning_note: str = Field(default="", description="Что ломается в ощущении игры, если крутить параметр вверх/вниз")

class MechanicDeepSpec(BaseSafeModel):
    """Глубокое описание одной механики: решение, числа, отказ, мастерство."""
    name: str = Field(default="")
    role_in_loop: str = Field(default="", description="Роль в петле: двигатель, тормоз, источник риска, источник награды")
    player_decision: str = Field(default="", description="Какое именно решение игрок принимает каждый раз, применяя механику")
    input_mapping: str = Field(default="", description="Тач и клавиатура/мышь: конкретные жесты и клавиши")
    states: List[str] = Field(default_factory=list, description="Состояния механики и условия переходов")
    parameters: List[MechanicParameter] = Field(default_factory=list)
    feedback_layers: List[str] = Field(default_factory=list, description="Отклик по слоям: визуал, звук, камера, тактильность, UI")
    failure_mode: str = Field(default="", description="Как игрок ошибается и по какому сигналу он понимает причину")
    mastery_curve: str = Field(default="", description="Что умеет новичок на 30-й секунде и что умеет эксперт на 10-м забеге")
    counterplay: str = Field(default="", description="Чем игра сопротивляется механике, как растёт давление")
    synergies: List[str] = Field(default_factory=list, description="Связи с другими механиками этой игры")
    why_unique: str = Field(default="", description="Чем это отличается от стандартной реализации в жанре")
    pseudocode: str = Field(default="", description="Псевдокод одного тика механики: вход -> проверка -> эффект")

class LoopStep(BaseSafeModel):
    """Шаг игровой петли: действие игрока, ответ игры и принимаемое решение."""
    step: str = Field(default="")
    player_action: str = Field(default="")
    game_response: str = Field(default="")
    decision: str = Field(default="", description="Значимый выбор игрока на этом шаге")
    duration: str = Field(default="", description="Сколько длится шаг: 0.5 с, 45 с, забег")

class CoreDesignSpec(BaseSafeModel):
    """Уникальное ядро конкретной игры: петли, формулы и глубина механик.

    Существует ровно для того, чтобы CORE_LOOP.md и MECHANICS.md перестали быть
    одинаковым шаблоном для всех проектов фабрики.
    """
    signature_moment: str = Field(default="", description="Момент, который игрок будет пересказывать другу")
    genre_template_rejected: str = Field(default="", description="Какой шаблон жанра сознательно НЕ берём и почему")
    what_makes_it_different: str = Field(default="", description="Чем петля отличается от соседней игры того же жанра")
    micro_loop: List[LoopStep] = Field(default_factory=list, description="Посекундная петля")
    meso_loop: List[LoopStep] = Field(default_factory=list, description="Петля волны/этапа")
    macro_loop: List[LoopStep] = Field(default_factory=list, description="Петля забега и возвращения")
    loop_diagram: str = Field(default="", description="ASCII-диаграмма петли именно этой игры")
    tension_curve: str = Field(default="", description="Как нарастает и спадает напряжение внутри забега")
    core_formulas: List[str] = Field(default_factory=list, description="Формулы этой игры: урон, скорость, спавн, счёт")
    run_progression: List[str] = Field(default_factory=list, description="Рост силы внутри забега, в терминах этой игры")
    meta_progression: List[str] = Field(default_factory=list, description="Рост между забегами, в терминах этой игры")
    mechanics: List[MechanicDeepSpec] = Field(default_factory=list)

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
    # Визуальная часть интерфейса. Раньше её здесь не было вообще: спецификация
    # знала, ЧТО показывать, и ничего не говорила о том, КАК это выглядит, —
    # поэтому кодовый агент каждый раз добирал вид из умолчаний браузера.
    visual_language: str = Field(default="")
    accent_roles: Dict[str, str] = Field(default_factory=dict)
    typography: str = Field(default="")
    components: List[str] = Field(default_factory=list)
    hud_anchors: Dict[str, str] = Field(default_factory=dict)
    screen_flow: str = Field(default="")
    feedback_moments: List[str] = Field(default_factory=list)
    diegetic_elements: List[str] = Field(default_factory=list)
    state_coverage: List[str] = Field(default_factory=list)

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

# ---------------------------------------------------------------------------
# Design OS: слой проверяемых решений (обещание игроку, допущения, плотность
# впечатлений, план валидации, решения и человеческие ворота).
#
# Идея слоя: фабрика не просто «расписывает» игру, а помечает, что здесь
# проверено, что — гипотеза, и как эту гипотезу дешевле всего проверить.
# Уровни уверенности (UL, Uncertainty Ladder):
#   UL-L0 — факт платформы/правило магазина (проверяемо документацией);
#   UL-L1 — подтверждено референсом с конкретной механикой;
#   UL-L2 — обоснованное проектное суждение;
#   UL-L3 — гипотеза, влияющая на удержание/деньги, нужен прототип;
#   UL-L4 — догадка о рынке/аудитории без данных;
#   UL-L5 — неизвестно, решение отложено до эксперимента.
# ---------------------------------------------------------------------------

UL_LEVELS = ["UL-L0", "UL-L1", "UL-L2", "UL-L3", "UL-L4", "UL-L5"]

class PromiseLayer(BaseSafeModel):
    """Один слой обещания игроку: что обещаем, чем подтвердим, что считаем провалом."""
    claim: str = Field(default="")
    expected_evidence: List[str] = Field(default_factory=list)
    failure_signals: List[str] = Field(default_factory=list)

class PlayerPromiseContract(BaseSafeModel):
    """Контракт обещания игроку — три горизонта: витрина, первая сессия, долгая игра."""
    concept_title: str = Field(default="")
    store_promise: PromiseLayer = Field(default_factory=PromiseLayer)
    first_session_promise: PromiseLayer = Field(default_factory=PromiseLayer)
    long_term_promise: PromiseLayer = Field(default_factory=PromiseLayer)
    assumptions: List[str] = Field(default_factory=list)
    validation_notes: List[str] = Field(default_factory=list)

class DesignNucleusOption(BaseSafeModel):
    """Вариант «дизайн-ядра»: за что игрок платит вниманием 80% времени."""
    id: str = Field(default="")
    name: str = Field(default="")
    tradeoff: str = Field(default="", description="Какой выбор игрок делает снова и снова")
    behavior_change: str = Field(default="", description="Как меняется поведение, темп и рост")
    depends_on: List[str] = Field(default_factory=list, description="Допущения, на которых держится")
    best_fit: str = Field(default="", description="Аудитория, платформа, производственный профиль")
    biggest_risk: str = Field(default="")
    smallest_validation: str = Field(default="", description="Самая дешёвая проверка")
    selected: bool = Field(default=False)

class Assumption(BaseSafeModel):
    """Допущение проекта с уровнем уверенности и способом опровержения."""
    id: str = Field(default="")
    statement: str = Field(default="")
    category: str = Field(default="design", description="design | player | market | tech | monetization | platform")
    ul_level: str = Field(default="UL-L3")
    impact: str = Field(default="high", description="low | medium | high")
    confidence: str = Field(default="medium", description="low | medium | high")
    validation_method: str = Field(default="")
    falsifier: str = Field(default="", description="Наблюдение, которое докажет ложность допущения")
    status: str = Field(default="open", description="open | validated | refuted | deferred")

class TelemetryEvent(BaseSafeModel):
    """Событие телеметрии, которое кодовый агент обязан реализовать."""
    name: str = Field(default="")
    trigger: str = Field(default="")
    params: List[str] = Field(default_factory=list)
    purpose: str = Field(default="")
    ties_to: str = Field(default="", description="ID допущения или метрики, которую событие проверяет")

class EDVariant(BaseSafeModel):
    """Вариант эксперимента по плотности впечатлений: ровно один главный рычаг."""
    id: str = Field(default="")
    primary_lever: str = Field(default="MD/min", description="MD/min | SF | EB | AR | CLP")
    change: str = Field(default="")
    hypothesis: str = Field(default="")
    success_metric: str = Field(default="")
    guardrail_metric: str = Field(default="")
    rollback_rule: str = Field(default="")

class SessionBeat(BaseSafeModel):
    """Такт первой сессии: что происходит в конкретном окне времени."""
    window: str = Field(default="")
    player_state: str = Field(default="")
    required_event: str = Field(default="")
    failure_signal: str = Field(default="")

class ExperienceDensitySpec(BaseSafeModel):
    """Плотность впечатлений: ED = MD/min * (SF + EB + AR) / CLP."""
    formula: str = Field(default="ED = MD/min × (SF + EB + AR) / CLP")
    theory_status: str = Field(default="design_hypothesis")
    metric_model: str = Field(default="web_session", description="web_session | mobile_liveops | premium_single_player")
    evidence_level: str = Field(default="UL-L3")
    boredom_type: str = Field(default="", description="недостимуляция | перегрузка | непонимание")
    stimulation_window: str = Field(default="")
    md_per_min_target: int = Field(default=12, description="Значимых решений игрока в минуту")
    time_to_first_action_sec: float = Field(default=3.0)
    time_to_first_reward_sec: float = Field(default=12.0)
    first_session_beats: List[SessionBeat] = Field(default_factory=list)
    clp_reducers: List[str] = Field(default_factory=list)
    sf_boosters: List[str] = Field(default_factory=list)
    eb_boosters: List[str] = Field(default_factory=list)
    ar_boosters: List[str] = Field(default_factory=list)
    primary_lever: str = Field(default="MD/min")
    variants: List[EDVariant] = Field(default_factory=list)
    telemetry: List[TelemetryEvent] = Field(default_factory=list)
    dashboard_fields: List[str] = Field(default_factory=list)
    decision_rules: List[str] = Field(default_factory=list)

class HookLoopLinkSurprise(BaseSafeModel):
    """Самодиагностика «Крючок / Петля / Связь / Сюрприз»."""
    hook: str = Field(default="")
    loop: str = Field(default="")
    link: str = Field(default="")
    surprise: str = Field(default="")
    weakest_layer: str = Field(default="")
    fixes: List[str] = Field(default_factory=list)

class ValidationExperiment(BaseSafeModel):
    """Минимальный эксперимент, проверяющий самое опасное допущение."""
    id: str = Field(default="")
    targets_assumption: str = Field(default="")
    question: str = Field(default="")
    prototype_scope: str = Field(default="")
    duration: str = Field(default="1 день")
    method: str = Field(default="")
    pass_criteria: str = Field(default="")
    fail_criteria: str = Field(default="")
    next_step_if_pass: str = Field(default="")
    next_step_if_fail: str = Field(default="")

class ScopeGate(BaseSafeModel):
    """Ворота объёма: что в MVP, что позже, что вырезаем."""
    mvp_must: List[str] = Field(default_factory=list)
    vertical_slice_should: List[str] = Field(default_factory=list)
    after_launch: List[str] = Field(default_factory=list)
    marketing_only: List[str] = Field(default_factory=list)
    cut: List[str] = Field(default_factory=list)

class ValidationPlan(BaseSafeModel):
    """План проверки: самое опасное допущение, дешёвый прототип, правило остановки."""
    riskiest_assumption: str = Field(default="")
    smallest_playable_prototype: str = Field(default="")
    voi_note: str = Field(default="", description="Почему эта информация стоит своей цены")
    experiments: List[ValidationExperiment] = Field(default_factory=list)
    stop_rule: str = Field(default="")
    scope_gate: ScopeGate = Field(default_factory=ScopeGate)

class DecisionRecord(BaseSafeModel):
    """Запись проектного решения с альтернативами и путём отката."""
    id: str = Field(default="")
    title: str = Field(default="")
    context: str = Field(default="")
    decision: str = Field(default="")
    alternatives: List[str] = Field(default_factory=list)
    consequences: List[str] = Field(default_factory=list)
    reversibility: str = Field(default="medium", description="low | medium | high")
    evidence_level: str = Field(default="UL-L2")
    rollback: str = Field(default="")
    status: str = Field(default="proposed", description="proposed | accepted | superseded")

class HumanGate(BaseSafeModel):
    """Человеческие ворота: место, где фабрика останавливается и спрашивает человека."""
    id: str = Field(default="")
    name: str = Field(default="")
    question: str = Field(default="")
    blocks: str = Field(default="", description="Что нельзя начинать до прохождения ворот")
    criteria: List[str] = Field(default_factory=list)
    status: str = Field(default="pending", description="pending | accepted | rejected")
    decided_at: str = Field(default="")
    note: str = Field(default="")

# ---------------------------------------------------------------------------
# Направление проекта и план знаний.
#
# Оба артефакта решают одну болезнь: раньше «что это за игра» и «какие
# документы базы знаний нужны» решались зашитыми умолчаниями, поэтому любая
# идея сползала к одной и той же арене с волнами и тремя картами апгрейда.
# Теперь и то и другое — решение модели, записанное в спецификацию вместе с
# обоснованием и списком осознанно отвергнутых вариантов.
# ---------------------------------------------------------------------------

class DirectionOption(BaseSafeModel):
    """Один вариант того, чем проект может стать. Варианты обязаны отличаться
    глаголом игрока и формой сессии, а не декорациями."""
    id: str = Field(default="", description="Короткий идентификатор варианта, напр. D1")
    name: str = Field(default="", description="Название направления на русском")
    pitch: str = Field(default="", description="Одна фраза: во что играет игрок")
    core_verb: str = Field(default="", description="Главный глагол игрока: рулить, резать, прятаться, чинить")
    genre_family: str = Field(default="", description="Жанровое семейство направления")
    session_shape: str = Field(default="", description="Форма сессии: забег, уровень, смена, партия, бесконечный поток")
    camera: str = Field(default="", description="Камера и ракурс, вытекающие из глагола игрока")
    control_scheme: str = Field(default="", description="Схема управления на телефоне и на клавиатуре")
    world: str = Field(default="", description="Мир, материал, эпоха, палитра")
    spectacle: str = Field(default="", description="Что видно на скриншоте за 1 секунду")
    why_not_generic: str = Field(default="", description="Чем это направление не сводится к шаблону жанра")
    biggest_risk: str = Field(default="", description="Главный риск направления")
    production_cost: str = Field(default="", description="Оценка объёма работ: низкий/средний/высокий и почему")
    knowledge_hints: List[str] = Field(default_factory=list, description="Пути документов knowledge/, которые понадобятся")

class ProjectDirection(BaseSafeModel):
    """Решение о том, каким проектом станет идея, вместе с отвергнутыми вариантами."""
    options: List[DirectionOption] = Field(default_factory=list)
    selected_id: str = Field(default="")
    selected_name: str = Field(default="")
    selection_reason: str = Field(default="", description="Почему выбран именно этот вариант")
    rejected_reasons: List[str] = Field(default_factory=list, description="Почему отвергнуты остальные варианты")
    what_it_is_not: List[str] = Field(default_factory=list, description="Шаблоны и клише, запрещённые в этом проекте")
    non_negotiables: List[str] = Field(default_factory=list, description="Без чего направление перестаёт существовать")
    signature_scene: str = Field(default="", description="Сцена, по которой игру узнают")
    avoid_references: List[str] = Field(default_factory=list, description="Игры, повторять которые нельзя")

class KnowledgeSelection(BaseSafeModel):
    """Один выбранный документ базы знаний с обоснованием."""
    path: str = Field(default="", description="Путь относительно knowledge/")
    role: str = Field(default="core", description="core | supporting")
    reason: str = Field(default="", description="Зачем этот документ именно этой игре")

class KnowledgePlan(BaseSafeModel):
    """Какие документы базы знаний получает проект и почему."""
    selections: List[KnowledgeSelection] = Field(default_factory=list)
    rejected: List[str] = Field(default_factory=list, description="Документы, осознанно НЕ включённые")
    rejection_reason: str = Field(default="", description="Почему они не нужны этой игре")
    loop_pattern: str = Field(default="", description="Выбранный архетип петли из knowledge/patterns")
    summary: str = Field(default="", description="Одна фраза: на какой набор знаний опирается проект")

    def paths(self, role: str = "") -> List[str]:
        """Пути выбранных документов, при необходимости отфильтрованные по роли."""
        return [s.path for s in self.selections if not role or s.role == role]

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
    # Умолчание намеренно пустое: зашитая «5-10 минутная roguelite-арена» тянула
    # каждый проект к одному и тому же формату сессии ещё до первого решения.
    session_model: str = Field(default="", description="Форма сессии именно этой игры")
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
    core_design: CoreDesignSpec = Field(default_factory=CoreDesignSpec)
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
    # --- Решение о направлении проекта и составе базы знаний ---
    direction: ProjectDirection = Field(default_factory=ProjectDirection)
    knowledge_plan: KnowledgePlan = Field(default_factory=KnowledgePlan)
    # --- Design OS layer (проверяемые решения поверх спецификации) ---
    player_promise: PlayerPromiseContract = Field(default_factory=PlayerPromiseContract)
    design_nucleus: List[DesignNucleusOption] = Field(default_factory=list)
    selected_nucleus: str = Field(default="")
    assumptions: List[Assumption] = Field(default_factory=list)
    experience_density: ExperienceDensitySpec = Field(default_factory=ExperienceDensitySpec)
    hlls: HookLoopLinkSurprise = Field(default_factory=HookLoopLinkSurprise)
    validation: ValidationPlan = Field(default_factory=ValidationPlan)
    decisions: List[DecisionRecord] = Field(default_factory=list)
    gates: List[HumanGate] = Field(default_factory=list)

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
