from app import anticliche
from app.context import GenerationContext
from app.logging import log_agent, log_warning, log_success

class SelfCritiqueAgent:
    """
    Evaluates the concept for consistency, scope feasibility, renderer match,
    Playgama integration completeness, and mobile ergonomics. Automatically repairs anomalies.
    """

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("SelfCritique", "Running automated self-critique and consistency verification...")
        
        issues_found = []
        corrections = []

        # 1. Check Renderer Consistency
        # Фабрика собирает только Three.js: любой другой рендерер в концепте или техспеке — это
        # остаток промпта или галлюцинация модели, а не решение.
        if concept.renderer != "threejs":
            issues_found.append(f"Unsupported renderer '{concept.renderer}': the factory ships Three.js only.")
            concept.renderer = "threejs"
            corrections.append("Forced renderer to Three.js.")
        if "three" not in concept.tech_spec.renderer.lower():
            issues_found.append("Mismatch: TechSpec renderer is not Three.js.")
            concept.tech_spec.renderer = "threejs"
            concept.tech_spec.physics_engine = "Rapier3D (@dimforge/rapier3d-compat ^0.20.0)"
            corrections.append("Synchronized TechSpec renderer and physics to Three.js + Rapier3D.")

        # 2. Check Playgama completeness
        if not concept.playgama.cloud_save_keys:
            concept.playgama.cloud_save_keys = [f"{concept.slug}_save_v1"]
            corrections.append("Injected missing Playgama cloud save key.")

        # 3. Definition of Done.
        #
        # Раньше свой список фабрика подставляла только в пустое поле: стоило
        # модели вернуть шесть строк вида «Playgama Bridge полностью
        # интегрирован» — и все платформенные и интерфейсные критерии молча
        # выпадали из пакета. Проверено на «Тактике Прорыва»: до мастер-промпта
        # доехали ровно те шесть строк, ни одной проверяемой.
        #
        # Теперь пункты фабрики добавляются ВСЕГДА. Пункты модели — про эту
        # игру, пункты фабрики — про площадку и интерфейс; они не заменяют друг
        # друга и не конкурируют.
        own = [item for item in concept.definition_of_done if str(item).strip()]
        mandatory = self._definition_of_done(concept)
        if not own:
            issues_found.append("Definition of Done was empty.")
        merged = list(own)
        for item in mandatory:
            if item not in merged:
                merged.append(item)
        if len(merged) != len(own):
            corrections.append(
                f"Дописано обязательных критериев приёмки: {len(merged) - len(own)} "
                f"(платформа, интерфейс, производительность)."
            )
        concept.definition_of_done = merged

        # 4. Check Mobile ergonomics
        if not concept.mobile.safe_area_handling:
            concept.mobile.safe_area_handling = "CSS env(safe-area-inset-*) padding applied to HUD root."
            corrections.append("Added safe area inset handling to mobile specification.")

        # 4b. Визуальная часть интерфейса.
        # Спецификация может знать, ЧТО показывать, и молчать о том, КАК это
        # выглядит. Всё, о чём документ молчит, кодовый агент добирает
        # умолчаниями браузера — и добирает одинаково в каждой игре.
        missing_ui = [
            name for name in ("visual_language", "accent_roles", "typography", "components")
            if not getattr(concept.ui_ux, name, None)
        ]
        if not concept.art.menu_staging:
            missing_ui.append("menu_staging (сцена за меню)")
        if missing_ui:
            issues_found.append(
                "Визуальная часть интерфейса не описана: " + ", ".join(missing_ui)
            )
            log_warning(
                "UI_UX_SPECIFICATION.md не задаёт внешний вид интерфейса — пересоберите "
                "раздел (`rebuild ux`), иначе кодовый агент соберёт меню из умолчаний браузера."
            )

        # 5. Жанровые клише в спецификации.
        # Ловим шаблон, протёкший в текст: он попадёт в мастер-промпт как
        # требование, и кодовый агент построит чужую игру, а не эту.
        leaked = anticliche.scan(concept.model_dump_json(), ctx.raw_prompt)
        banned = [b for b in concept.direction.what_it_is_not if b]
        if leaked:
            issues_found.extend(
                f"Жанровое клише в спецификации: {name}" for name in leaked
            )
            log_warning(
                "Критик нашёл шаблоны, которых пользователь не просил: "
                + "; ".join(leaked)
                + ". Проверьте MECHANICS.md и UI_UX_SPECIFICATION.md — "
                "их стоит пересобрать (`rebuild gameplay`, `rebuild ux`)."
            )
        elif banned:
            log_success(f"Клише не найдено: соблюдены все {len(banned)} запретов направления проекта.")

        if issues_found:
            for issue in issues_found:
                log_warning(f"Critic detected: {issue}")
            for corr in corrections:
                log_success(f"Critic auto-corrected: {corr}")
        else:
            log_success("Self-critique passed: 0 critical inconsistencies detected.")

    @staticmethod
    def _definition_of_done(concept) -> list:
        """Критерии готовности этой игры.

        Прежний список требовал «Move, Attack, Parry, Waves, Upgrades» и
        награду «Revive, 2x Gold» — то есть приёмку боевого рогалика для любого
        проекта. Теперь геймплейные пункты берутся из петли и механик игры,
        а платформенные остаются общими: они и правда одинаковы для всех."""
        loop = concept.core_loop or "основная петля игры"
        mechanics = ", ".join(m.name for m in concept.mechanics[:4]) or "механики из MECHANICS.md"
        rewarded = ", ".join(
            r.name for r in concept.monetization.rewarded_placements[:3]
        ) or "rewarded-награды из MONETIZATION.md"
        return [
            "Project builds cleanly with zero TypeScript errors (`npm run build`).",
            "Playgama Bridge initializes and dispatches GAME_READY platform message.",
            f"Петля играбельна целиком: {loop}.",
            f"Реализованы механики проекта: {mechanics}.",
            f"Условие успеха ({concept.win_conditions or 'см. GAME_DESIGN_DOCUMENT.md'}) "
            f"и условие проигрыша ({concept.lose_conditions or 'см. GAME_DESIGN_DOCUMENT.md'}) работают.",
            "Тач-управление отвечает без задержки, страница под игрой не скроллится.",
            # Интерфейс раньше не проверялся вообще: единственный пункт про него
            # говорил о задержке тача. Готовая игра с интерфейсом из умолчаний
            # браузера проходила приёмку молча.
            "Интерфейс собран из токенов одного `src/ui/theme.css`: в экранах нет литералов "
            "цвета, шрифта и `z-index`.",
            "Слои интерфейса прозрачны для игрового ввода — управление работает под всеми "
            "оверлеями, слой HUD не кликается.",
            "У каждого экрана работают состояния загрузки, пустоты и ошибки; возможность, "
            "которой нет на площадке, не нарисована вовсе.",
            f"Меню и HUD помещаются в измеренный вьюпорт с учётом safe-area и баннера, а с "
            f"закрытым игровым полем меню узнаётся как «{concept.title}».",
            "За меню и экраном итога видна живая игровая сцена: полноэкранной непрозрачной "
            "заливки поверх канваса нет, подложка только под текстом и кнопками.",
            "Ни одного эмодзи в подписях интерфейса: иконки — инлайновый SVG с `currentColor`.",
            f"Rewarded-реклама выдаёт награду ровно один раз ({rewarded}); interstitial соблюдает паузу 90 с.",
            "Audio and physics automatically pause/resume on tab blur and ad display.",
            "Persistent progress saves and loads from Playgama Cloud Storage.",
            "Runs at steady 60 FPS on desktop and >= 50 FPS on mobile.",
        ]
