from app import knowledge
from app.context import GenerationContext
from app.models import SkillDoc
from app.logging import log_agent

class SkillGeneratorAgent:
    """Ensures game-specific and specialized skills are prepared and attached to concept.

    Platform and renderer skills point at `knowledge/` rather than restating it:
    the knowledge base is the single source of truth, and a summary written here
    drifts from it the moment either changes."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("SkillGenerator", f"Generating game-specific skill instructions for '{concept.title}'")

        # Ensure concept.skills is a list
        if not isinstance(concept.skills, list):
            concept.skills = []

        skill_ids = [s.skill_id for s in concept.skills]
        
        # Inject core required skills if missing
        if "game_skill" not in skill_ids:
            log_agent("SkillGenerator", "Injecting core skill: game_skill")
            concept.skills.append(SkillDoc(
                skill_id="game_skill",
                name=f"{concept.title} Domain Architecture",
                filename="GAME_SKILL.md",
                purpose=f"Defines domain rules, state machine, and core gameplay loop for {concept.title}.",
                when_to_use="Use when writing or modifying core game state, loop coordination, and progression.",
                rules=[
                    "Strict TypeScript strict mode without any 'any' types.",
                    "Fixed 60Hz delta accumulator with delta clamping.",
                    "Decoupled state management via typed EventBus.",
                    "Zero runtime object allocations inside the 60Hz game loop."
                ],
                architecture="Decoupled 3-layer architecture: Application/Platform -> Engine/Systems -> Rendering/UI.",
                implementation_guidance="Instantiate Game instance from main.ts, bootstrap PlaygamaService, and start GameLoop.",
                common_mistakes=[
                    "Do not instantiate Three.js meshes or heavy objects inside tick loops.",
                    "Do not bypass the EventBus for cross-system communications."
                ],
                checklist=[
                    "Game initializes cleanly and loads within 3 seconds.",
                    "EventBus routes inputs and system events without memory leaks.",
                    "Audio auto-pauses and unpauses cleanly with browser focus changes."
                ]
            ))

        if "gameplay_skill" not in skill_ids:
            log_agent("SkillGenerator", "Injecting core skill: gameplay_skill")
            concept.skills.append(SkillDoc(
                skill_id="gameplay_skill",
                name="Combat, Physics & Movement Systems",
                filename="GAMEPLAY_SKILL.md",
                purpose="Defines standards for physics simulation, combat mechanics, and tactile player feedback.",
                when_to_use="Use when writing character controllers, weapon systems, collision listeners, and juice/VFX.",
                rules=[
                    "Clamp delta time to maximum 100ms to prevent physics tunneling.",
                    "Use continuous collision detection (CCD) for fast projectiles.",
                    "Apply hitstop (40ms time dilation) on impactful strikes.",
                    "Always synchronize physics rigid body transforms to mesh representations."
                ],
                architecture="Physics engine (Rapier3D/Matter.js) stepped on fixed 60Hz timestep, meshes interpolated.",
                implementation_guidance="Use EventBus to emit 'entity:hit', 'combat:parry', 'wave:cleared' events for sound and VFX triggers.",
                common_mistakes=[
                    "Never modify transform matrices directly on physics-controlled entities.",
                    "Do not hardcode magic numbers for damage or velocities without centralized configuration."
                ],
                checklist=[
                    "Player movement is responsive with no input lag.",
                    "Hits produce satisfying sensory feedback (VFX spark, screen shake, audio impact).",
                    "Ragdoll or death animations trigger smoothly without physics jitter."
                ]
            ))

        if "renderer_skill" not in skill_ids:
            log_agent("SkillGenerator", "Injecting core skill: renderer_skill")
            concept.skills.append(SkillDoc(
                skill_id="renderer_skill",
                name=f"{concept.renderer.upper()} WebGL Performance Guide",
                filename="RENDERER_SKILL.md",
                purpose=f"Optimization and visual standards for {concept.renderer.upper()} WebGL pipeline.",
                when_to_use="Use when configuring scenes, cameras, lighting, materials, instanced meshes, and particle systems.",
                rules=[
                    "Keep active draw calls strictly under 80.",
                    "Use InstancedMesh for debris, bullets, and crowd mobs.",
                    "Clamp pixel ratio to Math.min(window.devicePixelRatio, 1.5) on mobile.",
                    "Share material instances across identical geometry."
                ],
                architecture="Scene graph with pre-allocated sprite and mesh pools, dynamic shadow frustum optimization.",
                implementation_guidance="Initialize renderer with antialias enabled on desktop, powerPreference 'high-performance'.",
                common_mistakes=[
                    "Do not construct new Geometries, Textures, or Materials in the render loop.",
                    "Do not leave unused GPU assets without calling .dispose().",
                    "Do not tune quality from raw frame time — under vsync every frame reads as budget-length.",
                    "Do not launch in reduced quality and climb up; start optimistic and step down."
                ],
                checklist=[
                    "Maintains solid 60 FPS on desktop and >= 50 FPS on mobile.",
                    "No WebGL context loss errors on tab switches.",
                    "Shadow map renders crisp without artifact acne.",
                    "The quality auto-tuner converges and locks instead of oscillating."
                ],
                knowledge_refs=knowledge.topics_for_renderer(concept.renderer)
            ))

        if "playgama_skill" not in skill_ids:
            log_agent("SkillGenerator", "Injecting core skill: playgama_skill")
            concept.skills.append(SkillDoc(
                skill_id="playgama_skill",
                name="Playgama Bridge SDK Integration",
                filename="PLAYGAMA_SKILL.md",
                purpose="Defines implementation patterns for @playgama/bridge v2 (Ads, Cloud Storage, Auth, Leaderboards, Lifecycle).",
                when_to_use="Use when implementing advertising triggers, cloud save/load, authorization, and portal lifecycle hooks.",
                rules=[
                    "Always await bridge.initialize() (with a timeout) before any other SDK call.",
                    "Send game_ready exactly once, only after assets are loaded and the menu is interactive.",
                    "Grant a rewarded reward only on state === 'rewarded'; never when the promise resolves.",
                    "One save key holding one JSON object; storage.get/set take no storageType argument.",
                    "Call authorize() only from a player action — except the silent VK/OK path at boot.",
                    "Build UI on capability flags: an unsupported feature's control is not rendered at all.",
                    "Take pause and audio state from the platform's own events, not visibilitychange alone.",
                    "Auto-save on progress milestones and flush on pagehide."
                ],
                architecture="Singleton PlaygamaService wrapper exposing strongly-typed promises for Ads, Storage, Auth, Payments and Leaderboards, degrading to a local mock when window.bridge is absent.",
                implementation_guidance=(
                    "Subscribe to EVENT_NAME.REWARDED_STATE_CHANGED, call "
                    "bridge.advertisement.showRewarded(placement), remove the listener in cleanup, and "
                    "resolve true only for the 'rewarded' state. Full implementations for every module "
                    "are embedded below."
                ),
                common_mistakes=[
                    "Sending game_ready right after initialize() — the splash lifts over an unloaded game.",
                    "Awaiting a dialog-showing authorize() inside boot — the game hangs for every guest.",
                    "Detecting a guest via player.id/name; they are populated for guests, use player.isGuest.",
                    "Showing an interstitial in the first seconds of a session or during gameplay.",
                    "Consuming a purchase before granting it — paid goods are destroyed.",
                    "Keeping settings in localStorage — it is partitioned inside the platform iframe.",
                    "Never assume internet connection is permanent — support local offline fallback."
                ],
                checklist=[
                    "Rewarded grants exactly one reward per view, even on a double click.",
                    "Progress survives a reload as guest and as an authorized player.",
                    "A corrupted save boots on defaults instead of crashing.",
                    "Leaderboard score submits and displays correctly.",
                    "Game auto-pauses on the platform's pause event, including during ads."
                ],
                knowledge_refs=knowledge.CORE_TOPICS
            ))

        if "controls_skill" not in skill_ids:
            # Тач-управление раньше жило одной строкой в общем UX-разделе, и агент
            # регулярно ограничивался джойстиком в углу. Отдельный скилл с
            # встроенной базой знаний закрывает этот пробел.
            log_agent("SkillGenerator", "Injecting core skill: controls_skill")
            concept.skills.append(SkillDoc(
                skill_id="controls_skill",
                name="Mobile Touch & Desktop Controls",
                filename="CONTROLS_SKILL.md",
                purpose=(
                    "Задаёт обязательный контракт управления: раскладку под жанр, "
                    "реализацию на Pointer Events, отмену браузерных жестов и правила видимости."
                ),
                when_to_use=(
                    "Use when implementing any player input: virtual joystick, action buttons, "
                    "driving pedals, camera gestures, or keyboard bindings."
                ),
                rules=[
                    "Только Pointer Events + setPointerCapture; учитывать pointerId для каждой кнопки.",
                    "Движение и основное действие обязаны работать одновременно (мультитач).",
                    "В играх про вождение газ — отдельная кнопка, а не вертикаль стика руля.",
                    "touch-action: none, отмена contextmenu/dragstart и touchmove с passive:false.",
                    "Отступы через env(safe-area-inset-*); основная кнопка >= 96 px, остальные >= 64 px.",
                    "Слой управления виден только в игровом процессе и сбрасывается при скрытии.",
                    "Сброс всех осей и кнопок на blur и visibilitychange.",
                    "Флаг ?touch=1 принудительно включает мобильную раскладку на десктопе.",
                ],
                architecture=(
                    "Отдельный модуль TouchControls создаёт собственный DOM-слой поверх UI, "
                    "пишет в виртуальные оси InputManager и ничего не знает об игровой логике. "
                    "InputManager сливает клавиатуру и тач, отдавая игре единый снимок управления."
                ),
                implementation_guidance=(
                    "UIManager владеет экземпляром TouchControls и переключает его видимость "
                    "в showHud/showPause/hideAllModals. Джойстик — плавающий: база появляется "
                    "под пальцем, зона захвата — половина экрана, мёртвая зона 8%."
                ),
                common_mistakes=[
                    "Один стик на движение и газ — машина теряет ход в каждом повороте.",
                    "touchstart/touchend без pointerId: второй палец сбрасывает первый.",
                    "Слой управления оставлен видимым в меню — он перехватывает тапы по кнопкам.",
                    "Забытый passive:false — страница продолжает скроллиться под игрой.",
                    "Кнопки прижаты к краю без safe-area — их перекрывает вырез и системный жест.",
                ],
                checklist=[
                    "Газ/атака и направление работают одновременно, проверено тремя пальцами.",
                    "Свайп по игре не скроллит страницу и не вызывает pull-to-refresh.",
                    "Долгое нажатие не открывает контекстное меню.",
                    "Управление скрыто в меню и паузе, оси сброшены после сворачивания вкладки.",
                    "?touch=1 показывает мобильную раскладку на десктопе и кликается мышью.",
                ],
                knowledge_refs=["ux/touch_controls.md"]
            ))

        # Динамические скиллы под специфические механики проекта
        haystack = self._concept_haystack(ctx)

        if "vehicle_skill" not in skill_ids and self._is_driving_game(ctx):
            log_agent("SkillGenerator", "Injecting core skill: vehicle_skill")
            concept.skills.append(SkillDoc(
                skill_id="vehicle_skill",
                name="Physics Vehicle & Cargo Controller",
                filename="VEHICLE_SKILL.md",
                purpose=(
                    "Задаёт обязательную архитектуру машины на физике: raycast-подвеска, "
                    "риг колёс внутри кузова, составной коллайдер с бортами и груз, "
                    "который остаётся в кузове."
                ),
                when_to_use="Use for any drivable vehicle: truck, car, buggy, tank, mech.",
                rules=[
                    "Кузов — один RigidBody + DynamicRayCastVehicleController; колёса это лучи подвески, а не тела.",
                    "Никогда не назначать скорость кузову каждый кадр (setLinvel) — это затирает солвер.",
                    "updateVehicle(dt) вызывается ДО world.step(), лучи колёс фильтруются на группу грунта.",
                    "Визуальные колёса — дети группы кузова; ход подвески, руль и качение читаются у контроллера.",
                    "Рестарт заезда телепортирует существующие тела, а не пересобирает сцену.",
                ],
                architecture="TruckController владеет chassis RigidBody, составным коллайдером и DynamicRayCastVehicleController.",
                implementation_guidance="Тюнинг подвески: статическая просадка ≈ gravity / stiffness, restLength > просадки.",
                common_mistakes=[
                    "setLinvel каждый кадр: машина едет вдоль мировой оси, подвески нет.",
                    "Луч колеса без фильтра групп — машина встаёт на собственный груз.",
                ],
                checklist=[
                    "Все четыре колеса в контакте с грунтом, подвеска сжимается и разжимается.",
                    "Машина разгоняется, поворачивает и останавливается без переворота.",
                ],
                knowledge_refs=[
                    "threejs/rapier_vehicle_controller.md",
                    "threejs/vehicle_wheel_rig.md",
                    "threejs/physics_integration.md",
                ]
            ))

        if "stealth_skill" not in skill_ids and any(w in haystack for w in ("стелс", "stealth", "шум", "прят", "взор", "тихая")):
            log_agent("SkillGenerator", "Injecting specialized mechanic skill: stealth_skill")
            concept.skills.append(SkillDoc(
                skill_id="stealth_skill",
                name="Stealth Vision Cones & Noise Shadows",
                filename="STEALTH_SKILL.md",
                purpose="Реализация системы скрытности: секторы обзора ИИ, расчет шума шагов и шкала тревоги.",
                when_to_use="При разработке логики патрулирования, конусов зрения, укрытий и реакции ИИ на звук.",
                rules=[
                    "FOV-проверка угла (dot product) каждый кадр; физический Raycast — только при прохождении сектора (10 Гц).",
                    "Радиус шума шагов генерируется динамически от скорости перемещения (0 для крадучись, 9 м для бега).",
                    "Шкала тревоги растет плавно с буфером реакции 0.25 с (grace period).",
                ],
                architecture="StealthManager регистрирует источники шума и проверяет видимость через Raycast к позиции игрока.",
                implementation_guidance="Публикуй события 'stealth:noise_emitted', 'guard:alerted' в EventBus.",
                common_mistakes=[
                    "Raycast каждый кадр для всех мобов — просадки FPS.",
                    "Мгновенное обнаружение сквозь угол без задержки реакции.",
                ],
                checklist=[
                    "Укрытия полностью блокируют прямую видимость патрульных.",
                    "Шаг крадучись не поднимает тревогу за спиной врага.",
                ],
                knowledge_refs=["mechanics/stealth_detection.md"]
            ))

        if "grappling_skill" not in skill_ids and any(w in haystack for w in ("крюк", "grapple", "кошка", "маятник", "трос")):
            log_agent("SkillGenerator", "Injecting specialized mechanic skill: grappling_skill")
            concept.skills.append(SkillDoc(
                skill_id="grappling_skill",
                name="Elastic Grappling Hook & Pendulum Swing",
                filename="GRAPPLING_SKILL.md",
                purpose="Реализация физического крюка-кошки с маятниковым разгоном и сохранением углового момента.",
                when_to_use="При создании контроллера перемещения на тросе, раскачивания и зацепа за точки.",
                rules=[
                    "Трос моделируется как пружинно-демпферная связь (Spring-Damper) с применением импульсов к RigidBody.",
                    "Никогда не телепортировать тело игрока через setTranslation во время зацепа.",
                    "При отсоединении троса тангенциальная скорость сохраняется с катапультирующим множителем.",
                ],
                architecture="GrappleHookController управляет лучом привязки, расчетом натяжения и синхронизацией меша троса.",
                implementation_guidance="Используй raycast с угловым допуском 15 градусов для комфортного авто-прицеливания.",
                common_mistakes=[
                    "Жесткое притягивание без инерции маятника — механика ощущается деревянной.",
                ],
                checklist=[
                    "Игрок свободно раскачивается вокруг точки крепления и катапультируется в верхней точке дуги.",
                ],
                knowledge_refs=["mechanics/grappling_hook.md"]
            ))

        if "cooking_skill" not in skill_ids and any(w in haystack for w in ("кухн", "повар", "готов", "кафе", "ресторан", "пекарн", "еда", "лапш")):
            log_agent("SkillGenerator", "Injecting specialized mechanic skill: cooking_skill")
            concept.skills.append(SkillDoc(
                skill_id="cooking_skill",
                name="Multi-Step Culinary Flow & Heat Control",
                filename="COOKING_SKILL.md",
                purpose="Реализация кулинарного пайплайна: машина состояний продуктов, контроль жара и очередь заказов.",
                when_to_use="При программировании разделочных столов, жарки в воке, сборки блюд и таймеров терпения клиентов.",
                rules=[
                    "Каждый ингредиент имеет четкие состояния: RAW -> PREPPED -> COOKED -> BURNT.",
                    "Таймер терпения заказа визуализируется плавным круговым индикатором со сменой цвета.",
                    "Сдача заказа в зеленой зоне дает множитель комбо чаевых.",
                ],
                architecture="OrderManager распределяет билеты заказов, CookingStation обрабатывает таймеры жарки.",
                implementation_guidance="Используй Web Audio сэмплы шипящего масла и стука ножа для сочного ASMR-отклика.",
                common_mistakes=[
                    "Блокировка действий игрока во время анимации жарки.",
                ],
                checklist=[
                    "Блюда сгорают только при превышении лимита передержки с предупреждающим дымом.",
                ],
                knowledge_refs=["mechanics/cooking_flow.md"]
            ))

        if "rhythm_skill" not in skill_ids and any(w in haystack for w in ("ритм", "rhythm", "музык", "оркестр", "барабан", "дирижер", "нот")):
            log_agent("SkillGenerator", "Injecting specialized mechanic skill: rhythm_skill")
            concept.skills.append(SkillDoc(
                skill_id="rhythm_skill",
                name="Web Audio Beat Sync & Accuracy System",
                filename="RHYTHM_SKILL.md",
                purpose="Аппаратная синхронизация игровых действий с тактовой сеткой музыки через AudioContext.currentTime.",
                when_to_use="При реализации ритм-механик, попадания в долю, окон Perfect/Good и комбо-множителей.",
                rules=[
                    "AudioContext.currentTime — единственный источник истины времени (не Date.now() и не performance.now()).",
                    "Окна точности: Perfect <= 65 мс, Good <= 140 мс, Miss > 140 мс.",
                    "Учитывать калибровку задержки звукового тракта (audio latency offset).",
                ],
                architecture="RhythmClock отслеживает BPM и рассылает события 'rhythm:beat' через EventBus.",
                implementation_guidance="Пульсируй параметры шейдеров и масштаб элементов UI в такт музыке.",
                common_mistakes=[
                    "Синхронизация через requestAnimationFrame приводит к рассинхрону при просадках FPS.",
                ],
                checklist=[
                    "Попадание в такт регистрируется точно независимо от частоты обновления монитора.",
                ],
                knowledge_refs=["mechanics/rhythm_sync.md"]
            ))

        if "mining_skill" not in skill_ids and any(w in haystack for w in ("шахт", "бур", "копа", "бурен", "майнинг", "miner", "drill", "руда")):
            log_agent("SkillGenerator", "Injecting specialized mechanic skill: mining_skill")
            concept.skills.append(SkillDoc(
                skill_id="mining_skill",
                name="Modular Mining Drill & Geological Layers",
                filename="MINING_SKILL.md",
                purpose="Реализация системы бурения: прочность пластов пород, температура бура и сбор минералов.",
                when_to_use="При программировании разрушаемых воксельных пород, перегрева бура и физики рудных жил.",
                rules=[
                    "Прочность пород ранжируется по твердости (глина -> базальт -> гранит -> титан).",
                    "Непрерывное бурение повышает температуру; перегрев > 100°C клинит бур на 2.0 секунды.",
                    "Разрушенный блок спавнит физические лут-орбы, притягиваемые магнитным полем.",
                ],
                architecture="DrillController отслеживает контакт с блоками сетки и управляет нагревом/охлаждением.",
                implementation_guidance="Применяй вибрацию камеры пропорционально твердости разрушаемого слоя.",
                common_mistakes=[
                    "Создание новых геометрий на каждый разрушенный блок вместо деформации или скрытия инстансов.",
                ],
                checklist=[
                    "Бур плавно охлаждается в покое и клинит при достижении критической температуры.",
                ],
                knowledge_refs=["mechanics/mining_drill.md"]
            ))

        if "building_skill" not in skill_ids and any(w in haystack for w in ("строит", "базостро", "сетка", "building", "баз", "турел", "конвейер")):
            log_agent("SkillGenerator", "Injecting specialized mechanic skill: building_skill")
            concept.skills.append(SkillDoc(
                skill_id="building_skill",
                name="Grid Modular Base & Power Grid Architecture",
                filename="BUILDING_SKILL.md",
                purpose="Реализация строительства по сетке, проверки коллизий и распространения энергии по пилонам.",
                when_to_use="При создании модульных стен, турелей, генераторов и конвейерных цепочек.",
                rules=[
                    "Привязка к сетке (Snap-to-Grid) с полупрозрачным превью-призраком постройки.",
                    "Граф смежности энергосети обновляется мгновенным поиском в ширину (BFS).",
                    "Все постройки регистрируются в пространственной хеш-таблице (SpatialHash).",
                ],
                architecture="BuildingGridManager хранит матрицу занятости и валидирует условия размещения.",
                implementation_guidance="Отключай турели при разрыве связи с электрогенератором.",
                common_mistakes=[
                    "Разрешение постройки поверх спавнеров врагов или внутри геометрии игрока.",
                ],
                checklist=[
                    "Постройки мгновенно встают по сетке, энергосеть корректно питает подключенные узлы.",
                ],
                knowledge_refs=["mechanics/grid_building.md"]
            ))

        # Скилл проверяемости: плотность первой сессии и телеметрия.
        if "experience_skill" not in skill_ids:
            log_agent("SkillGenerator", "Injecting core skill: experience_skill")
            ed = concept.experience_density
            event_names = ", ".join(f"`{e.name}`" for e in ed.telemetry) or "события не заданы"
            concept.skills.append(SkillDoc(
                skill_id="experience_skill",
                name="Плотность первой сессии и телеметрия",
                filename="EXPERIENCE_SKILL.md",
                purpose=(
                    "Держит первую сессию в целевых показателях и делает её измеримой: "
                    f"{ed.formula}."
                ),
                when_to_use=(
                    "При работе над стартом игры, обучением, HUD, экраном проигрыша, "
                    "рестартом и при добавлении любого события телеметрии."
                ),
                rules=[
                    f"Первое осмысленное действие доступно не позже {ed.time_to_first_action_sec} с после загрузки.",
                    f"Первая награда или явный прогресс — не позже {ed.time_to_first_reward_sec} с.",
                    f"Целевая плотность решений — около {ed.md_per_min_target} значимых решений в минуту.",
                    "Порядок улучшений: окно стимуляции → снижение когнитивной нагрузки → качество отклика → частота решений.",
                    "Каждое действие игрока имеет три канала отклика: визуальный, звуковой и изменение состояния цели.",
                    "Экран проигрыша называет причину; рестарт занимает не больше 2 секунд.",
                    f"Обязательные события телеметрии: {event_names}.",
                    "`first_action` и `first_reward` отправляются ровно один раз за сессию.",
                ],
                architecture=(
                    "Модуль `src/telemetry/Telemetry.ts` с методами `track` и `trackOnce`; "
                    "системы публикуют события через EventBus, телеметрия подписывается на них "
                    "и никогда не вызывается из горячего цикла напрямую."
                ),
                implementation_guidance=(
                    "Реализуй контракт из TELEMETRY_SPEC.md, замерь тайминги первой сессии "
                    "локально и зафиксируй результат в DEVLOG.md. Если целевые значения "
                    "не достигаются, это не повод менять цифры в документе — это находка."
                ),
                common_mistakes=[
                    "Логотип, меню или загрузочный экран поверх геймплея в первые секунды — время до первого действия сорвано.",
                    "Полный HUD с первой секунды: игрок не понимает, на что смотреть (растёт CLP).",
                    "Обучение модальным окном с текстом вместо ограничения сцены.",
                    "Синхронная отправка телеметрии в игровом цикле — просадки кадра.",
                    "Отправка `first_reward` повторно за сессию — воронка первой сессии искажается.",
                ],
                checklist=[
                    f"Замерено: время до первого действия ≤ {ed.time_to_first_action_sec} с.",
                    f"Замерено: время до первой награды ≤ {ed.time_to_first_reward_sec} с.",
                    "Все события из TELEMETRY_SPEC.md отправляются и видны в консоли dev-сборки.",
                    "Ни один сигнал провала из PLAYER_PROMISE.md не воспроизводится на первой сессии.",
                    "Отсутствие сети не вызывает исключений в геймплейном коде.",
                ],
            ))

        log_agent("SkillGenerator", f"Compiled {len(concept.skills)} reusable skill documents.")

    @classmethod
    def _concept_haystack(cls, ctx: GenerationContext) -> str:
        """Собирает полный поисковый текст концепции для анализа механик."""
        concept = ctx.concept
        return " ".join([
            str(concept.genre or ""),
            str(concept.subgenre or ""),
            str(concept.title or ""),
            str(concept.hook or ""),
            str(concept.player_fantasy or ""),
            str(ctx.raw_prompt or ""),
            " ".join(m.name for m in concept.mechanics),
            " ".join(m.category for m in concept.mechanics),
            " ".join(d.name for d in concept.core_design.mechanics),
        ]).lower()

    _DRIVING_WORDS = (
        "гонк", "дрифт", "маш", "грузовик", "трак", "racing", "drift",
        "vehicle", "car", "truck", "derby", "driving", "rally",
    )

    @classmethod
    def _is_driving_game(cls, ctx: GenerationContext) -> bool:
        """Есть ли в игре управляемая машина — по жанру, механикам и исходной идее."""
        haystack = cls._concept_haystack(ctx)
        return any(word in haystack for word in cls._DRIVING_WORDS)
