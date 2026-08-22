"""UX-дизайнер: HUD, экраны, визуальный язык интерфейса и раскладка управления.

Худший источник однотипности жил именно здесь: пустой HUD добивался полосой
здоровья, счётчиком волн и золотом, а список экранов — модалкой выбора из трёх
карт апгрейда. Дальше эти элементы попадали в мастер-промпт как требование, и
кодовый агент честно строил рогалик-арену поверх любой идеи.

Вторая дыра была тише и стоила дороже: агент описывал только СОСТАВ интерфейса
— какие элементы и экраны есть, — и ни слова о том, как он выглядит. Всё, что
относилось к виду, кодовый агент добирал сам, и добирал одинаково: фиолетовый
градиент, системный шрифт, эмодзи вместо иконок, `alert()` вместо модалки. Теперь
визуальный язык, акценты, типографика, набор компонентов, переходы и состояния
экранов — такая же часть спецификации, как список кнопок.
"""
from typing import Dict, List

from pydantic import Field

from agents.model_call import RU_SYSTEM_SUFFIX, ask_model
from agents.project_director import ProjectDirectorAgent
from app import anticliche
from app.context import GenerationContext
from app.logging import log_agent
from app.models import BaseSafeModel


class UXLayout(BaseSafeModel):
    hud_elements: List[str] = Field(default_factory=list, description="Элементы HUD с позицией на экране")
    screens: List[Dict[str, str]] = Field(
        default_factory=list,
        description=(
            "Экраны. У каждого четыре ключа: id (латиницей), desc (что на экране), "
            "composition (три зоны экрана: идентичность / главное действие / второстепенный ряд), "
            "primary_action (единственное главное действие этого экрана)"
        ),
    )
    mobile_controls_layout: str = Field(default="", description="Раскладка тач-управления под этот глагол игрока")
    wireframes_ascii: str = Field(default="", description="ASCII-вайрфрейм игрового экрана")
    visual_language: str = Field(
        default="",
        description="Из какого материала мира сделан интерфейс: поверхности, рамки, фактура",
    )
    accent_roles: Dict[str, str] = Field(
        default_factory=dict,
        description="Акцентный цвет → его единственный смысл в этой игре (не больше трёх)",
    )
    typography: str = Field(
        default="",
        description="Две гарнитуры и их роли: чем набраны цифры и заголовки, чем — текст",
    )
    components: List[str] = Field(
        default_factory=list,
        description="Компоненты, из которых собран ВЕСЬ интерфейс этой игры",
    )
    hud_anchors: Dict[str, str] = Field(
        default_factory=dict,
        description="Якорь экрана (top-left/top-right/bottom-left/bottom-right/bottom-center) → что там лежит",
    )
    screen_flow: str = Field(default="", description="Переходы между экранами и путь назад")
    feedback_moments: List[str] = Field(
        default_factory=list,
        description="Действие игрока → чем интерфейс отвечает на него",
    )
    diegetic_elements: List[str] = Field(
        default_factory=list,
        description="Состояние, показанное миром или персонажем вместо элемента HUD",
    )
    state_coverage: List[str] = Field(
        default_factory=list,
        description="Экран → что он показывает в состояниях загрузки, пустоты и ошибки",
    )


SYSTEM_PROMPT = (
    "Ты UX-дизайнер мобильных браузерных игр. Спроектируй интерфейс ЭТОЙ игры — "
    "и состав, и внешний вид.\n"
    "ПРАВИЛА СОСТАВА:\n"
    "- В HUD попадает только то, что игрок читает во время действия. Каждый элемент обязан "
    "обслуживать конкретную механику — полоса здоровья в игре без урона не нужна.\n"
    "- Пять якорей экрана: четыре угла и низ-центр. Каждый постоянный элемент лежит ровно в "
    "одном якоре; посередине экрана ничего не висит. Больше пяти постоянных элементов на "
    "телефоне не помещается.\n"
    "- Состояние, которое видно на самом персонаже, машине или мире, показывай там, а не "
    "очередной полоской в углу: это и есть diegetic_elements.\n"
    "- Экраны выводятся из формы сессии: если сессия — смена в мастерской, финальный экран "
    "показывает итог смены, а не «Game Over».\n"
    "- У КАЖДОГО экрана заполнены все четыре ключа: id, desc, composition, primary_action. "
    "composition — это три зоны: чем экран себя называет, ЧТО на нём главное действие (ровно "
    "одно, самое крупное), и что лежит вторым рядом одним весом. Экран без composition "
    "кодовый агент собирает сам, и собирает всегда одинаково: карточка с колонкой кнопок "
    "по центру. Это и есть тот самый «примитивный интерфейс».\n"
    "- Раскладка тач-управления выводится из глагола игрока: газ и руль нажимаются одновременно, "
    "рисование трассы — это один палец по экрану, а не джойстик.\n"
    "- Кнопки: основная >= 96 px, остальные >= 64 px, отступы через safe-area.\n"
    "ПРАВИЛА ВНЕШНЕГО ВИДА:\n"
    "- visual_language называй материалом мира игры: из чего сделаны панели и рамки — "
    "крашеная сталь с трафаретами, поцарапанный акрил, эмалированная вывеска. Проверка: "
    "если закрыть игровое поле, меню обязано выдавать именно эту игру.\n"
    "- accent_roles: не больше трёх цветов, у каждого ровно один смысл. Разный цвет у каждой "
    "кнопки «чтобы отличались» — главная ошибка игрового интерфейса.\n"
    "- typography: две гарнитуры, не больше. Одна на цифры и заголовки, другая на текст. "
    "Меняющиеся числа — табличными цифрами в слоте фиксированной ширины.\n"
    "- components: закрытый список того, из чего собран весь интерфейс. Всё на экране обязано "
    "быть одним из этих компонентов.\n"
    "- Меню и экраны между сессиями лежат ПОВЕРХ живой игровой сцены — той же, что в игре, "
    "с медленной камерой. Непрозрачная заливка на весь экран запрещена: подложка только под "
    "текстом и кнопками, остальное поле показывает игру. Постановку сцены задаёт "
    "ART_DIRECTION.md (menu_staging); в composition экрана меню это учтено.\n"
    "- feedback_moments: интерфейс отвечает на действие в том же кадре, даже если само "
    "действие идёт долго.\n"
    "- state_coverage: у каждого экрана, который ходит в сеть (сохранение, таблица лидеров, "
    "покупки, реклама), описаны загрузка, пустота и ошибка — не только удачный путь.\n"
    "ЗАПРЕЩЕНО: alert/confirm/prompt, эмодзи вместо иконок и внутри подписей кнопок "
    "(«🚀 НАЧАТЬ» — это не иконка, а отсутствие иконки), фиолетовый градиент с системным "
    "шрифтом, чёрная плашка «GAME OVER», серая неактивная кнопка вместо отсутствующей "
    "возможности, непрозрачная заливка поверх игровой сцены, одна карточка с колонкой "
    "кнопок по центру экрана.\n"
    "- Вайрфрейм рисуй ASCII-рамкой с реальными подписями элементов этой игры."
    + RU_SYSTEM_SUFFIX
)


# Модель называет ключи экрана как ей удобнее: purpose вместо desc, name вместо
# id, layout вместо composition. Генератор документа читал только `desc` — и
# раздел «Каталог экранов» в UI_UX_SPECIFICATION.md выходил пустым: имена
# экранов есть, содержимого нет. Кодовый агент в этом месте додумывал экраны
# сам. Приводим ответ к четырём ключам, что бы модель ни прислала.
_SCREEN_ALIASES = {
    "id": ("id", "screen", "screen_id", "name", "key", "title", "экран"),
    "desc": ("desc", "description", "purpose", "content", "what", "summary",
             "описание", "назначение", "содержимое"),
    "composition": ("composition", "layout", "zones", "structure", "композиция",
                    "компоновка", "структура"),
    "primary_action": ("primary_action", "main_action", "primary", "cta", "action",
                       "главное_действие"),
}


def normalize_screens(screens) -> List[Dict[str, str]]:
    """Приводит список экранов к ключам id / desc / composition / primary_action.

    Всё, что не удалось разложить по известным ключам, склеивается в desc: терять
    описание экрана хуже, чем показать его не в той графе."""
    if not isinstance(screens, list):
        return []

    result: List[Dict[str, str]] = []
    for raw in screens:
        if isinstance(raw, str):
            result.append({"id": raw.strip(), "desc": "", "composition": "", "primary_action": ""})
            continue
        if not isinstance(raw, dict):
            continue

        lowered = {str(k).strip().lower(): ("" if v is None else str(v).strip())
                   for k, v in raw.items()}
        screen = {"id": "", "desc": "", "composition": "", "primary_action": ""}
        used = set()
        for field, aliases in _SCREEN_ALIASES.items():
            for alias in aliases:
                if lowered.get(alias):
                    screen[field] = lowered[alias]
                    used.add(alias)
                    break
        extra = [f"{key}: {value}" for key, value in lowered.items()
                 if value and key not in used]
        if extra:
            screen["desc"] = "; ".join([screen["desc"]] + extra) if screen["desc"] else "; ".join(extra)
        if screen["id"] or screen["desc"]:
            result.append(screen)
    return result


class UXDesignerAgent:
    """Designs the UI layout, visual language, mobile ergonomics, HUD and screen states."""

    _FILLABLE = (
        "hud_elements", "screens", "mobile_controls_layout", "wireframes_ascii",
        "visual_language", "accent_roles", "typography", "components",
        "hud_anchors", "screen_flow", "feedback_moments", "diegetic_elements",
        "state_coverage",
    )

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("UXDesigner", f"Designing mobile-first UI/UX and controls for '{concept.title}'")

        ui = concept.ui_ux
        # Раньше условие смотрело только на три поля состава: заполненный HUD
        # означал «интерфейс готов», и визуальная часть не запрашивалась никогда.
        if not all(getattr(ui, field) for field in self._FILLABLE):
            filled = ask_model(ctx, "UXDesigner", SYSTEM_PROMPT, self._brief(ctx), UXLayout)
            if filled:
                filled.screens = normalize_screens(filled.screens)
                for field in self._FILLABLE:
                    if not getattr(ui, field) and getattr(filled, field):
                        setattr(ui, field, getattr(filled, field))

        self._fill_offline_gaps(concept)
        log_agent(
            "UXDesigner",
            f"UI/UX configured with {len(ui.screens)} distinct screens, "
            f"{len(ui.components)} UI components and responsive mobile controls.",
        )

    # ------------------------------------------------------------------ helpers

    # Компоненты, без которых не обходится ни одна игра на площадке. Это не
    # жанровый набор: здесь нет ни карточек апгрейда, ни счётчика волн — только
    # то, из чего состоит любой экран.
    _BASE_COMPONENTS = [
        "Button — основная / второстепенная / призрачная / разрушающая, все состояния",
        "IconButton — служебное действие одной иконкой, подпись в aria-label",
        "Panel — рамка-поверхность, на которой лежит любая группа содержимого",
        "Modal — панель + затемнение + ловушка фокуса + один путь закрытия (замена confirm)",
        "Toast — короткое сообщение, само исчезает, не перехватывает ввод",
        "Meter — полоса ресурса: заливка через transform, а не width",
        "Stat — подпись + табличное число, единственный текстовый примитив HUD",
        "SegmentedControl — 2–4 взаимоисключающих варианта вместо <select>",
        "ListRow — строка таблицы лидеров, товара или задания",
        "ScreenShell — три зоны экрана, safe-area и общий переход",
    ]

    @staticmethod
    def _fill_offline_gaps(concept) -> None:
        """Подстраховка без сети. Даёт скелет экранов и визуальные правила,
        обязательные для любой игры на площадке, и ни одного жанрового элемента:
        ни волн, ни карт апгрейда, ни золота."""
        ui = concept.ui_ux
        ui.screens = normalize_screens(ui.screens)
        if not ui.screens:
            loop = concept.core_loop or "основная петля"
            ui.screens = [
                {"id": "main_menu",
                 "desc": "Старт, настройки, продолжение сохранённой сессии",
                 "composition": "Живая сцена игры на весь кадр; название и состояние игрока "
                                "в верхней зоне; единственная крупная кнопка запуска; "
                                "остальное — одним второстепенным рядом",
                 "primary_action": "Начать игру"},
                {"id": "gameplay_hud",
                 "desc": f"Игровой экран: {loop}",
                 "composition": "Сцена без перекрытия; показания по пяти якорям; "
                                "в середине экрана только временная обратная связь",
                 "primary_action": "Главное действие петли"},
                {"id": "session_end",
                 "desc": "Итог сессии в терминах этой игры и повторный запуск",
                 "composition": "Сцена остановленной сессии за панелью; итог одной крупной "
                                "строкой; кнопка повтора — единственная с основным акцентом",
                 "primary_action": "Повторить"},
                {"id": "settings",
                 "desc": "Звук, язык, управление",
                 "composition": "Список строк одной ширины; заголовок сверху; выход "
                                "второстепенной кнопкой",
                 "primary_action": "Закрыть настройки"},
            ]
        else:
            # У экранов от модели композиция может отсутствовать. Пустое поле в
            # спецификации читается как «делай на своё усмотрение» — а на своё
            # усмотрение получается колонка кнопок по центру.
            for screen in ui.screens:
                if not screen.get("composition"):
                    screen["composition"] = (
                        "Три зоны: чем экран себя называет, единственное главное действие, "
                        "второстепенный ряд одним весом. Меню лежит поверх живой сцены."
                    )
        if not ui.hud_elements:
            ui.hud_elements = [
                f"Индикатор главного ресурса механики «{m.name}»"
                for m in concept.mechanics[:3]
            ] or ["Индикатор состояния главной механики (задаётся в MECHANICS.md)"]
            ui.hud_elements.append("Верхний правый угол: пауза и настройки")
        if not ui.wireframes_ascii:
            elements = " | ".join(e.split(":")[-1].strip()[:18] for e in ui.hud_elements[:3])
            ui.wireframes_ascii = (
                "┌─────────────────────────────────────────────────────────────┐\n"
                f"│ {elements[:57]:<57} │\n"
                "│                                                             │\n"
                "│                     [ ИГРОВАЯ СЦЕНА ]                       │\n"
                "│                                                             │\n"
                "│  Раскладка управления — см. MOBILE_CONTROLS.md              │\n"
                "└─────────────────────────────────────────────────────────────┘"
            )

        # --- визуальная часть -------------------------------------------------
        if not ui.visual_language:
            # Материал интерфейса решает арт-директор — здесь он не переписывается
            # своими словами, иначе в промпт уезжает одна и та же мысль дважды.
            # Своя формулировка нужна только когда арт-дирекция промолчала.
            art = concept.art
            if art.ui_theme:
                ui.visual_language = art.ui_theme
            else:
                source = art.environment_theme or art.style_name
                ui.visual_language = (
                    f"Интерфейс сделан из материала мира игры: {source}. Панели, рамки и иконки "
                    "повторяют эту фактуру; проверка — если закрыть игровое поле, меню всё равно "
                    "должно выдавать именно эту игру."
                    if source else
                    "Материал интерфейса выводится из мира игры (см. ART_DIRECTION.md): панели и "
                    "рамки повторяют фактуру окружения, а не берутся из умолчаний браузера."
                )
        if not ui.accent_roles:
            ui.accent_roles = {
                "primary": f"Главное действие петли: {concept.core_loop or 'основное действие игрока'}",
                "danger": f"Потеря и риск: {concept.lose_conditions or 'проигрышное состояние'}",
                "neutral": "Служебный интерфейс в покое; акцент получает только при наведении",
            }
        if not ui.typography:
            ui.typography = (
                "Две гарнитуры: акцидентная на цифры, заголовки и HUD, текстовая на подписи и "
                "описания. Меняющиеся числа — font-variant-numeric: tabular-nums в слоте "
                "фиксированной ширины, иначе строка HUD дёргается на каждом изменении. "
                "Прописные — только для коротких подписей: кириллическая фраза капсом читается "
                "медленнее. Кегль текста не ниже 14 px после масштабирования."
            )
        if not ui.components:
            ui.components = list(UXDesignerAgent._BASE_COMPONENTS)
        if not ui.hud_anchors:
            ui.hud_anchors = UXDesignerAgent._anchors_from_hud(ui.hud_elements)
        if not ui.screen_flow:
            ids = [s.get("id", "") for s in ui.screens if isinstance(s, dict)]
            chain = " → ".join(i for i in ids if i) or "main_menu → gameplay_hud → session_end"
            ui.screen_flow = (
                f"{chain}. Виден ровно один экран; скрытый экран убирается через display: none, "
                "иначе его кнопки продолжают ловить нажатия. Пауза и любая модалка "
                "останавливают игровые часы и звуковую шину и возвращают их при закрытии. "
                "Слой тач-управления показан только в игровом процессе и сбрасывает оси при скрытии."
            )
        if not ui.feedback_moments:
            ui.feedback_moments = [
                f"{m.name}: {m.feedback}" for m in concept.mechanics[:4]
                if getattr(m, "feedback", "")
            ]
            ui.feedback_moments.append(
                "Любое нажатие отвечает в том же кадре (transform: scale(.97) на :active), "
                "даже если само действие идёт долго."
            )
            ui.feedback_moments.append(
                "Действие с ожиданием (покупка, реклама, отправка счёта) переводит кнопку в "
                "состояние loading и снимает его в finally — иначе игрок нажмёт её ещё трижды."
            )
        if not ui.diegetic_elements:
            ui.diegetic_elements = [
                "Состояние, которое видно на персонаже, машине или мире, показывается там, а не "
                "полоской в углу: список конкретных признаков задаётся в ART_DIRECTION.md.",
            ]
        if not ui.state_coverage:
            ui.state_coverage = [
                "Загрузка: рамка экрана уже нарисована, содержимое заменено скелетоном — "
                "экран не появляется целиком после ответа сети.",
                "Пустота: у пустой таблицы лидеров и пустого инвентаря своя подпись и выход, "
                "а не пустая рамка.",
                "Ошибка: неудавшееся сохранение, покупка или отправка счёта говорят об этом "
                "словами игрока и дают повтор, который действительно повторяет запрос.",
                "Недоступная возможность: элемент не рисуется вовсе — не серым и не с ошибкой "
                "по нажатию (см. CRITICAL_RULES.md, раздел Capability gating).",
            ]

    @staticmethod
    def _anchors_from_hud(hud_elements: List[str]) -> Dict[str, str]:
        """Раскладывает элементы HUD по пяти якорям.

        Если UX-агент уже назвал позицию в тексте элемента («Верх-Лево: …»),
        берём её; остальное раскладываем по порядку важности. Смысл в том, чтобы
        в спецификацию не попал HUD без позиций: без якорей кодовый агент
        расставляет элементы на глаз и получает разное на разных экранах."""
        anchors = {
            "top-left": "", "top-right": "", "bottom-left": "",
            "bottom-right": "", "bottom-center": "",
        }
        hints = {
            "top-left": ("верх-лево", "верху слева", "верхний левый", "слева сверху", "top-left"),
            "top-right": ("верх-право", "верху справа", "верхний правый", "справа сверху", "top-right"),
            "bottom-left": ("низ-лево", "внизу слева", "нижний левый", "bottom-left"),
            "bottom-right": ("низ-право", "внизу справа", "нижний правый", "bottom-right"),
            "bottom-center": ("низ-центр", "внизу по центру", "нижний центр", "bottom-center"),
        }
        leftovers: List[str] = []
        for element in hud_elements:
            low = element.lower()
            for anchor, words in hints.items():
                if not anchors[anchor] and any(w in low for w in words):
                    anchors[anchor] = element
                    break
            else:
                leftovers.append(element)

        order = ["top-left", "top-right", "bottom-left", "bottom-right", "bottom-center"]
        for element in leftovers:
            for anchor in order:
                if not anchors[anchor]:
                    anchors[anchor] = element
                    break
        anchors["top-right"] = anchors["top-right"] or "Пауза и настройки"
        return {k: v for k, v in anchors.items() if v}

    @staticmethod
    def _brief(ctx: GenerationContext) -> str:
        c = ctx.concept
        mechanics = "\n".join(
            f"- {m.name}: {m.description} | ввод: {m.player_interaction}" for m in c.mechanics[:6]
        )
        direction = ProjectDirectorAgent.brief_for_agents(c.direction) if c.direction else ""
        art = c.art
        art_brief = "\n".join(
            line for line in (
                f"Визуальный стиль: {art.style_name}" if art.style_name else "",
                f"Мир и материалы: {art.environment_theme}" if art.environment_theme else "",
                f"Свет: {art.lighting_setup}" if art.lighting_setup else "",
                f"Тема интерфейса от арт-директора: {art.ui_theme}" if art.ui_theme else "",
            ) if line
        )
        return (
            f"Игра: {c.title}\nЖанр: {c.genre} ({c.subgenre})\nФантазия игрока: {c.player_fantasy}\n"
            f"Петля: {c.core_loop}\nФорма сессии: {c.session_model}\n"
            f"Победа: {c.win_conditions}\nПоражение: {c.lose_conditions}\n"
            f"Ориентация экрана: {c.orientation}\n"
            f"Механики и ввод:\n{mechanics or '- механики ещё не заданы'}\n"
            f"{('Арт-дирекция (интерфейс обязан быть из этого же материала):' + chr(10) + art_brief + chr(10)) if art_brief else ''}"
            f"Исходная идея пользователя: {ctx.raw_prompt}\n\n{direction}\n\n"
            f"{anticliche.ban_block(ctx.raw_prompt)}"
        )
