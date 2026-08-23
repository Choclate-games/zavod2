import re

from agents.ux_designer import normalize_screens
from app import knowledge, library
from app.context import GenerationContext
from app.logging import log_agent

class PromptCompilerAgent:
    """
    Compiles structured game data, architecture specs, mechanics, and constraints
    into a self-contained, definitive master AI Developer Prompt (AI_DEVELOPER_PROMPT.md).
    """

    # Раскладка тач-управления зависит от жанра. Универсальный «джойстик слева +
    # кнопки справа» ломает вождение: газ и руль обязаны работать одновременно.
    _TOUCH_LAYOUTS = {
        "driving": (
            "- **Слева — РУЛЬ**: плавающий стик, работает только по горизонтали "
            "(поворот). Вертикаль стика не управляет газом.\n"
            "- **Справа — ПЕДАЛИ И ДЕЙСТВИЯ**: большая кнопка **ГАЗ** (≥ 104 px) под "
            "большим пальцем, рядом **НАЗАД/ТОРМОЗ**, выше — **НИТРО** и **РУЧНИК/ДРИФТ**.\n"
            "- Газ, руль и нитро должны нажиматься одновременно (мультитач на 3 пальца)."
        ),
        "platformer": (
            "- **Слева**: кнопки ВЛЕВО / ВПРАВО (или горизонтальный стик).\n"
            "- **Справа**: ПРЫЖОК (самая большая кнопка) и кнопка действия/атаки.\n"
            "- Прыжок и движение обязаны работать одновременно."
        ),
        "builder": (
            "- **Одним пальцем**: панорамирование карты, тап — выбор объекта.\n"
            "- **Двумя пальцами**: пинч-зум и поворот камеры.\n"
            "- **Справа снизу**: панель постройки/действий, кнопки ≥ 64 px."
        ),
        # Шутер получал раскладку «default» — с дэшем, блоком и спец-умением,
        # то есть мувсет ближнего боя. Готовая игра вышла без прыжка, приседа и
        # тихого шага: агенту предъявили спецификацию, где вертикали нет, и он
        # честно её не сделал. Стрельба и обзор — разные пальцы, вертикаль —
        # отдельные кнопки.
        "shooter": (
            "- **Слева — ДВИЖЕНИЕ**: плавающий стик на 2 оси, зона захвата — левая "
            "половина экрана.\n"
            "- **Справа — ОБЗОР**: свободная зона доводки прицела (не кнопка), "
            "работает одновременно со стиком и с огнём.\n"
            "- **ОГОНЬ** (≥ 96 px) — под большим пальцем правой руки, удержание "
            "даёт очередь у автоматического оружия.\n"
            "- **Вторичные (≥ 64 px)**: ПЕРЕЗАРЯДКА, СМЕНА ОРУЖИЯ, ПРИЦЕЛ и то, "
            "что игра добавила к вертикали (ПРЫЖОК / ПРИСЕД), плюс контекстное "
            "действие, если оно в игре есть.\n"
            "- Движение, обзор и огонь обязаны работать втроём одновременно."
        ),
        "default": (
            "- **Слева — ДВИЖЕНИЕ**: плавающий виртуальный джойстик на 2 оси, "
            "зона захвата — вся левая половина экрана.\n"
            "- **Справа — ДЕЙСТВИЯ**: крупная основная кнопка (атака/использование) "
            "и 2–3 второстепенные (дэш, блок, спец-умение).\n"
            "- Движение и атака должны работать одновременно."
        ),
    }

    _DESKTOP_LAYOUTS = {
        "driving": (
            "- `W` / `S` / `↑` / `↓` — газ и тормоз/задний ход\n"
            "- `A` / `D` / `←` / `→` — руль\n"
            "- `Space` / `E` — нитро\n"
            "- `Shift` / `F` — ручной тормоз (дрифт)\n"
            "- `P` / `Esc` — пауза"
        ),
        "shooter": (
            "- `WASD` / стрелки — движение\n"
            "- Мышь — обзор через `requestPointerLock` (захват просится из "
            "обработчика нажатия, иначе браузер его не даст)\n"
            "- ЛКМ — огонь: автоматическое оружие стреляет **пока кнопка "
            "удерживается**, полуавтомат — по событию нажатия\n"
            "- ПКМ — прицеливание\n"
            "- `R` — перезарядка, `Q` / колесо / `1`–`3` — смена оружия\n"
            "- `Space` — прыжок, `Ctrl` — присед, `Shift` — тихий шаг "
            "(любую из трёх можно не делать, но тогда см. правило о вертикали ниже)\n"
            "- `P` / `Esc` — пауза"
        ),
        "default": (
            "- `WASD` / стрелки — движение\n"
            "- ЛКМ / `J` — основная атака\n"
            "- ПКМ / `K` — тяжёлая атака / блок\n"
            "- `Space` / `Shift` — рывок / уклонение\n"
            "- `P` / `Esc` — пауза"
        ),
    }

    # Раскладка — шаблон, а не спецификация игры. Печатается всегда, под любым
    # профилем: разбор готового шутера показал, что агент берёт список клавиш
    # буквально и глаголов, которых в списке нет, в игре не появляется. Прыжка
    # не было ни в раскладке, ни в игре — при том что уровень собран из ящиков,
    # на которые задумано забираться.
    _CONTROL_VERBS_RULE = (
        "**Раскладка выше — отправная точка под похожие игры, а не список того, "
        "что умеет ЭТА игра.** Профилей в фабрике меньше, чем жанров, и любой "
        "шаблон заведомо описывает не вашу игру: в нём есть лишние клавиши и нет "
        "нужных. Источник истины — глаголы игрока, перечисленные ниже.\n\n"
        "**Контракт: каждый глагол получает и клавишу, и кнопку.** Таблицу "
        "«глагол → клавиша → тач-кнопка → что происходит на экране и в звуке» "
        "положи в `DESIGN.md` до первой строчки кода по управлению. Глагол без "
        "строки в таблице не реализован; клавиша из шаблона, которой в таблице "
        "нет, — удаляется.\n\n"
        "**Отдельно решается то, чего в списке механик обычно нет, но игрок "
        "ждёт по виду уровня.** Вертикаль (прыжок, присед, тихий шаг), "
        "взаимодействие с предметом, отмена действия. Каждое — либо сделано "
        "(вертикаль — это гравитация, опора лучом по геометрии и высота глаз от "
        "ступней, а не константа пола), либо осознанно не сделано, и тогда в "
        "`DESIGN.md` стоит строка почему, **а уровень не обещает того, чего "
        "игрок не может**: без прыжка на карте нет ящиков, выступов и укрытий по "
        "пояс, к которым тянет забраться."
    )

    @staticmethod
    def _control_verbs_block(concept) -> str:
        """Глаголы игрока из механик — то, из чего собирается раскладка.

        Профилей управления пять, жанров — бесконечно, и всё, что не попало в
        таблицу, получало мили-раскладку: дэш, блок, спец-умение. Тактический
        шутер так и вышел без прыжка, приседа и тихого шага — их не было в
        шаблоне, а спецификация шаблоном и ограничивалась.

        Список ниже собран из самой игры, поэтому работает под любым жанром:
        шаблон остаётся подсказкой, а обязательным становится то, что игра
        действительно просит уметь."""
        verbs = []
        for m in concept.mechanics:
            action = (getattr(m, "player_interaction", "") or "").strip()
            if not action:
                continue
            verbs.append(f"- **{m.name}** — игрок делает это так: {action}")
        for deep in getattr(concept.core_design, "mechanics", []) or []:
            action = (getattr(deep, "input_mapping", "") or "").strip()
            if action and not any(deep.name in v for v in verbs):
                verbs.append(f"- **{deep.name}** — {action}")
        if not verbs:
            return (
                "**Глаголы игрока в спецификации не перечислены.** Выпиши их сам "
                "из `MECHANICS.md` и `CORE_LOOP.md` до того, как раскладывать "
                "клавиши: раскладка — следствие списка действий, а не наоборот."
            )
        return "**Глаголы игрока этой игры** (каждому нужна строка в таблице управления):\n" \
            + "\n".join(verbs)

    _SHOOTER_WORDS = ("шутер", "shooter", "fps", "стрельб", "перестрелк", "тир",
                      "от первого лица", "оружи", "снайпер", "штурм",
                      "cs:go", "cs go", "counter-strike", "контр-страйк")
    _DRIVING_WORDS = ("гонк", "дрифт", "маш", "racing", "drift", "vehicle", "car", "derby", "трак")
    _PLATFORMER_WORDS = ("платформер", "platformer", "runner", "раннер")
    _BUILDER_WORDS = ("строит", "builder", "base building", "tower defense", "башен", "стратег")

    @classmethod
    def _control_profile(cls, ctx: GenerationContext) -> str:
        """Определяет профиль управления по жанру, механикам и исходной идее."""
        concept = ctx.concept
        haystack = " ".join([
            str(concept.genre or ""),
            str(concept.subgenre or ""),
            str(concept.title or ""),
            str(ctx.raw_prompt or ""),
            " ".join(m.name for m in concept.mechanics),
        ]).lower()

        # Порядок консервативный: шутер забирает только то, что не забрал
        # никто другой. Гонка с оружием остаётся гонкой, раннер со стрельбой —
        # раннером: там управление держит не ствол.
        for profile, words in (
            ("driving", cls._DRIVING_WORDS),
            ("platformer", cls._PLATFORMER_WORDS),
            ("builder", cls._BUILDER_WORDS),
            ("shooter", cls._SHOOTER_WORDS),
        ):
            if any(word in haystack for word in words):
                return profile
        return "default"

    @classmethod
    def _touch_layout(cls, concept, profile: str) -> str:
        """Раскладка тача: сначала спроектированная, потом жанровый шаблон.

        Раньше здесь безусловно печатался шаблон профиля, и заголовок над ним
        читался как «обязательный контракт». Для игры, где направление проекта
        прямым текстом запрещало виртуальный джойстик, промпт всё равно требовал
        джойстик слева — кодовый агент получал одновременно запрет и требование
        и строил управление, которого никто не проектировал. Раскладку решает
        UX-дизайнер; шаблон профиля остаётся запасным вариантом для случая,
        когда её не задали."""
        # Запасной шаблон профиля не должен спорить с рамкой проекта: в
        # тактическом штурме, где джойстик запрещён прямым текстом, шаблон по
        # умолчанию требовал именно джойстик. Проверяем это до того, как
        # промпт попадёт к агенту.
        bans = " ".join(concept.direction.what_it_is_not).lower()
        designed = (concept.ui_ux.mobile_controls_layout or "").strip()
        if designed:
            return (
                f"- **Раскладка этой игры** (спроектирована в MOBILE_CONTROLS.md, "
                f"переносить сюда раскладку из другой игры нельзя): {designed}\n"
                "- Раскладка выводится из главного действия игрока. Виртуальный джойстик "
                "уместен там, где игрок непрерывно ведёт персонажа; там, где действие "
                "точечное (тап по цели, свайп, удержание), джойстик — лишний элемент, "
                "который занимает половину экрана и ничего не делает."
            )
        template = cls._TOUCH_LAYOUTS[profile]
        conflicts = [word for word in ("джойстик", "стик") if word in bans and word in template.lower()]
        if conflicts:
            return (
                "- **Раскладку этой игры спроектируй сам**: MOBILE_CONTROLS.md её не задал, а "
                f"шаблон жанра предлагает то, что рамка проекта запрещает ({', '.join(conflicts)}).\n"
                "- Отталкивайся от главного действия игрока: чем он его дозирует, тем и "
                "управляет. Точечное действие — тап или удержание по цели; непрерывное "
                "ведение — стик; траектория — палец по экрану.\n"
                "- Решение запиши в `DEVLOG.md`: раскладка, которой нет в спецификации, "
                "должна быть хотя бы объяснена."
            )
        return template

    # ------------------------------------------------------------------
    # Блоки слоя Design OS для мастер-промпта.
    # ------------------------------------------------------------------

    # Разделы правил площадки, которые пакет везёт ещё и скиллом. Ключ —
    # заголовок раздела в CRITICAL_RULES.md, значение — файл скилла, где тот же
    # текст лежит целиком. Раздел выкидывается из промпта ТОЛЬКО если этот файл
    # в пакете действительно есть: правило, которого нет нигде, потерять нельзя.
    # Разделы CRITICAL_RULES, которые остаются адресом, а не текстом.
    #
    # Отбор не по теме, а по моменту: правила загрузки, сохранений, рекламы и
    # модерации нужны в первый час работы и решают, запустится ли игра вообще —
    # они остаются здесь целиком. Стек, рендерер и физика транспорта нужны
    # тогда, когда до них дошли, и до тех пор занимают место.
    #
    # Интерфейс и тач-управление намеренно НЕ вынесены: именно на них фабрика
    # уже обжигалась, и шестая секция ссылается на них напрямую.
    _RULES_BY_ADDRESS = {
        "Stack": "выбор библиотек стека — перед подключением любой из них",
        "Renderer": "настройки рендерера — когда собираешь сцену",
        "Physics vehicles": "физика транспорта — только если в игре есть машины",
    }

    @classmethod
    def _platform_rules_block(cls, concept) -> str:
        """Правила площадки — целиком, и это единственное место, где они лежат.

        Раньше часть разделов отсюда выбрасывалась: их дословный текст всё
        равно был вклеен в `skills/*.md`, и третья копия одного правила только
        вытесняла то, что уникально для этой игры.

        Теперь скиллы держат ссылку, а не текст, и выбрасывать стало нечего:
        этот раздел — офлайн-минимум. Он должен работать даже тогда, когда
        `fetch-knowledge.mjs` не смог достучаться до сети, потому что без него
        игра на Яндекс Играх не запускается, и это не вопрос качества.
        """
        sections = knowledge.critical_rules_sections(heading_offset=1)
        if not sections:
            return ""
        kept, pointers = [], []
        for title, body in sections.items():
            if title in cls._RULES_BY_ADDRESS:
                pointers.append(f"- **{title}** — {cls._RULES_BY_ADDRESS[title]}")
                continue
            kept.append(body)
        block = "\n\n".join(kept)
        if pointers:
            block += (
                "\n\n### Разделы, которые открываются по месту\n"
                "Эти правила нужны не с первой строки, а когда доберёшься до "
                "соответствующей области. Полный текст — в "
                "`docs/ref/knowledge/CRITICAL_RULES.md` (файл обязательный, "
                "приезжает шагом 0). Обязательность от переноса не меняется.\n"
                + "\n".join(pointers)
            )
        return block

    @staticmethod
    def _skill_index(concept) -> dict:
        """Обратная карта: документ базы знаний → файл скилла, где он лежит.

        Каталог `knowledge/` внутрь проекта не копируется, и кодовый агент
        заперт в каталоге игры. Промпт при этом писал «прочитай
        `knowledge/threejs/fps_controller_and_shooting.md`» — адрес, которого в
        песочнице нет. Сам текст доезжает: генератор скиллов вклеивает
        выбранные документы дословно в `skills/*.md`. Значит и адресовать надо
        туда."""
        index = {}
        for skill in concept.skills:
            for ref in skill.knowledge_refs:
                index.setdefault(ref, skill.filename)
        return index

    @staticmethod
    def _skill_address(filename: str) -> str:
        """Адрес скилла в пакете игры — ровно один `skills/` спереди.

        Имя скилла приходит от модели и приходит по-разному: `UI_SKILL.md` у
        одних, `skills/fps_combat.md` у других. Промпт склеивал префикс вслепую
        и выдавал `skills/skills/fps_combat.md` — адрес, которого в пакете нет,
        то есть ссылку в никуда ровно там, где агенту нужен чек-лист."""
        return "skills/" + str(filename or "").replace("\\", "/").lstrip("/").removeprefix("skills/")

    @classmethod
    def _knowledge_block(cls, concept) -> str:
        """Знания проекта — по адресам, которые в пакете действительно есть."""
        plan = concept.knowledge_plan
        skills = cls._skill_index(concept)

        def row(path: str, reason: str = "", with_checklist: bool = False) -> str:
            # Адрес один и тот же на фабрике и в игре: `knowledge/<путь>`
            # превращается в `docs/ref/knowledge/<путь>` после загрузки. Скилл
            # рядом называем, когда он есть, — в нём выжимка и чек-лист.
            host = skills.get(path)
            where = f"`docs/ref/knowledge/{path}`"
            if host:
                where += f" (выжимка — `{cls._skill_address(host)}`)"
            tail = f" — {reason}" if reason else ""
            line = f"- {where}{tail}"
            if not with_checklist:
                return line
            # Чек-лист документа едет вместе с адресом. Причина — разобранный
            # шутер: `threejs/fps_controller_and_shooting.md` доехал в пакет,
            # был назван в промпте и остался неоткрытым, потому что строка
            # рядом обещала «контр-стрейф и покачивание вьюмодели». В самом
            # документе при этом лежали гравитация, прыжок с койот-таймом, две
            # руки на вьюмодели, анимации перезарядки, пружина отдачи и
            # хитмаркер — ничего из этого в игру не попало. Пункты стоят
            # дословно: их видно, даже когда файл не открывали.
            items = knowledge.checklist(path)
            if not items:
                # Чек-листа у документа нет — значит короткого пути нет тоже, и
                # об этом надо сказать прямо. Молчание здесь читается как «тут
                # нечего проверять».
                return f"{line}\n  - (чек-листа у документа нет — открывается целиком)"
            body = "\n".join(f"  - [ ] {item}" for item in items)
            return f"{line}\n{body}"

        if not plan.selections:
            return (
                "Куратор знаний не отработал на этом прогоне. Забери базу командой "
                "`node scripts/fetch-knowledge.mjs` и читай `docs/ref/knowledge/` "
                "вместе со скиллами проекта в `skills/`."
            )

        core = "\n".join(row(s.path, s.reason, with_checklist=True)
                         for s in plan.selections if s.role == "core") \
            or "- (ядро не выделено)"
        supporting = "\n".join(row(s.path, s.reason) for s in plan.selections if s.role != "core")
        # Чек-листы платформенных документов в промпт НЕ вклеиваются: их около
        # семидесяти пунктов, они одинаковы во всех играх, и вместе с ядром
        # съедали четверть промпта — ту самую дупликацию, ради которой база и
        # переехала на загрузку по требованию. Место их жизни — раздел H
        # `ACCEPTANCE.md`: он переживает контекст агента и проверяется скриптом.
        mandatory = "\n".join(row(rel) for rel in knowledge.MANDATORY_TOPICS)

        parts = [
            "База знаний не лежит в пакете копиями — она приезжает по требованию:\n\n"
            "```bash\n"
            "node scripts/fetch-knowledge.mjs        # всё обязательное → docs/ref/\n"
            "node scripts/fetch-knowledge.mjs <путь> # отдельный файл\n"
            "```\n\n"
            "Что именно тянуть, перечислено в `knowledge.manifest.json`. После "
            "загрузки адреса ниже открываются как обычные локальные файлы, и "
            "сеть больше не нужна.",
            f"Набор отобран под этот проект: {plan.summary or 'см. skills/PROJECT_KNOWLEDGE_SKILL.md'}",
            "**Строка после адреса — ярлык документа, а не его содержание.** Она "
            "названа так, чтобы документ можно было отличить от соседнего, и "
            "покрывает от силы десятую часть файла: за ярлыком «управление от "
            "первого лица и покачивание вьюмодели» в прошлый раз лежали "
            "гравитация, прыжок, вторая рука на вьюмодели, анимации "
            "перезарядки, пружина отдачи и хитмаркер — и ничего из этого в игру "
            "не попало, потому что файл сочли уже понятным. Документы ядра "
            "открываются целиком, до первой строчки кода по своей теме.\n\n"
            "Пункты `- [ ]` под адресом — чек-лист самого документа, дословно. "
            "Это не пожелания: каждый пункт закрывает уже сделанную кем-то "
            "ошибку и проверяется взглядом на запущенную игру.\n\n"
            "Здесь стоят чек-листы только тех документов, что отобраны под эту "
            "игру. **Полный список, включая платформенные документы, лежит в "
            "`ACCEPTANCE.md`, раздел H** — там же он и закрывается: у каждого "
            "пункта либо `[x]`, либо `[~]` со строкой причины. Незакрытый пункт "
            "валит `node scripts/check-spec.mjs`, и проект не считается готовым.",
            f"**Ядро — прочитать до начала реализации:**\n{core}",
        ]
        if supporting:
            parts.append(f"**Вспомогательные:**\n{supporting}")
        if plan.loop_pattern:
            parts.append(f"**Архетип петли проекта**: {row(plan.loop_pattern)[2:]}")
        parts.append(
            "**Платформенные требования — обязательны всегда, независимо от жанра.** "
            "Без Playgama Bridge игра на площадке не стартует: платформа держит свою "
            "заставку до таймаута и снимает игру с модерации.\n" + mandatory
        )
        if plan.rejected:
            rejected = ", ".join(f"`{r}`" for r in plan.rejected)
            parts.append(
                f"**Осознанно НЕ включены**: {rejected}. {plan.rejection_reason}\n"
                "Не подтягивай решения из этих документов — они про другую игру."
            )
        parts.append(
            "**Документы проекта** (лежат рядом, в корне игры): `ACCEPTANCE.md` — приёмка, "
            "`AGENTS.md` — правила работы, `PROJECT_DIRECTION.md` — рамка проекта, "
            "`GAME_DESIGN_DOCUMENT.md`, `MECHANICS.md`, `CORE_LOOP.md`, "
            "`UI_UX_SPECIFICATION.md`, `ART_DIRECTION.md`, `MOBILE_CONTROLS.md`, "
            "`PLAYGAMA_INTEGRATION.md`, `MONETIZATION.md`, `QA_PLAN.md`, "
            "`DEVLOG.md` и `CHANGELOG.md` — их ведёшь ты."
        )
        return "\n\n".join(parts)

    @staticmethod
    def _ui_block(concept) -> str:
        """Визуальный контракт интерфейса.

        До этого блока секция про UI состояла целиком из эргономики тача: где
        кнопки и какого они размера. Как интерфейс ВЫГЛЯДИТ, промпт не говорил
        ничего, и кодовый агент честно добирал вид умолчаниями — фиолетовый
        градиент, системный шрифт, эмодзи вместо иконок, alert() вместо модалки.
        Здесь решения UX-дизайнера и арт-директора доходят до него как
        требование, а не как пожелание."""
        ui = concept.ui_ux
        art = concept.art
        parts = []

        theme = art.ui_theme or ui.visual_language
        if theme:
            parts.append(f"**Материал интерфейса**: {theme}")
        if ui.visual_language and ui.visual_language != theme:
            parts.append(f"**Визуальный язык**: {ui.visual_language}")
        if ui.typography:
            parts.append(f"**Типографика**: {ui.typography}")
        parts.append(
            "**Сцена за меню.** " + (art.menu_staging or
            "Живая сцена игры на том же рендерере: медленная камера, работающий свет и "
            "эффекты.") + "\n\n"
            "Меню, пауза и итог сессии рисуются ПОВЕРХ этой сцены. Непрозрачный слой на весь "
            "экран (`background: #111` на корне экрана, полноэкранная `rgba(...)`-заливка, "
            "картинка-заставка) запрещён: подложка допускается только под текстовым блоком и "
            "кнопками. Игровой цикл в меню продолжает крутиться на сниженной нагрузке — камера "
            "едет, сцена живёт. Игрок обязан понять, во что он играет, до нажатия «Играть»; "
            "меню на глухой заливке — самый заметный признак недоделанной игры, и это первое, "
            "что увидит и игрок, и модератор площадки."
        )
        if ui.accent_roles:
            rows = "\n".join(f"| `{name}` | {meaning} |" for name, meaning in ui.accent_roles.items())
            parts.append(
                "**Акценты — один цвет = один смысл** (разный цвет у каждой кнопки «чтобы "
                "отличались» читается как мусор):\n\n"
                "| Токен | Единственный смысл |\n|---|---|\n" + rows
            )
        if ui.components:
            items = "\n".join(f"- {c}" for c in ui.components)
            parts.append(
                "**Набор компонентов — закрытый.** Всё на экране обязано быть одним из них; "
                "одноразовый `<div>` с инлайновыми стилями — это баг, из-за которого второй "
                "экран перестаёт совпадать с первым:\n" + items
            )
        if ui.hud_anchors:
            rows = "\n".join(f"| `{anchor}` | {content} |" for anchor, content in ui.hud_anchors.items())
            parts.append(
                "**Якоря HUD** — пять и только пять; посередине экрана не висит ничего, кроме "
                "временной обратной связи:\n\n| Якорь | Что там |\n|---|---|\n" + rows
            )
        screens = normalize_screens(ui.screens)
        if screens:
            rows = []
            for screen in screens:
                name = (screen.get("id") or "screen").strip()
                cells = [f"**{name}**"]
                if screen.get("desc"):
                    cells.append(screen["desc"])
                if screen.get("primary_action"):
                    cells.append(f"главное действие — {screen['primary_action']}")
                if screen.get("composition"):
                    cells.append(f"композиция: {screen['composition']}")
                rows.append("- " + " · ".join(cells))
            parts.append(
                "**Экраны и их композиция.** У каждого экрана три зоны: чем он себя называет, "
                "единственное главное действие (самое крупное и единственное с основным "
                "акцентом) и второстепенный ряд одним весом. Карточка с колонкой кнопок по "
                "центру — не композиция, а её отсутствие:\n" + "\n".join(rows)
            )
        if ui.diegetic_elements:
            items = "\n".join(f"- {d}" for d in ui.diegetic_elements)
            parts.append("**Состояние, показанное миром, а не оверлеем**:\n" + items)
        if ui.screen_flow:
            parts.append(f"**Переходы экранов**: {ui.screen_flow}")
        if ui.feedback_moments:
            items = "\n".join(f"- {f}" for f in ui.feedback_moments)
            parts.append("**Отклик интерфейса на действие**:\n" + items)
        if ui.state_coverage:
            items = "\n".join(f"- {st}" for st in ui.state_coverage)
            parts.append(
                "**Состояния экранов** — загрузка, пустота и ошибка проектируются наравне с "
                "удачным путём: сохранение, таблица лидеров, покупки и реклама на этих "
                "площадках отваливаются регулярно:\n" + items
            )

        parts.append(
            "**Значения выводятся из этого мира, а не берутся из примеров.** Имена токенов "
            "(`--color-primary`, `--font-display`, `--space-*`) одинаковы во всех играх — на них "
            "держится код компонентов. Сами значения, обе гарнитуры, силуэт рамки и язык иконок "
            "выводятся из материала интерфейса, названного выше, по процедуре из раздела 12 "
            "`knowledge/ux/ui_design_system.md`: из чего сделана панель, при каком свете она "
            "лежит, чем в этом мире помечают главное и опасное, чем написаны цифры, как режут "
            "край. Скопировать палитру, шрифты или фаску из примера в базе знаний или из другой "
            "игры — это тот же дефект, что и оставить умолчания браузера: интерфейс выглядит "
            "решением, принятым не для этой игры. Обратная проверка: если от интерфейса другой "
            "игры фабрики ваш отличается только оттенком акцента — процедура была пропущена.\n\n"
            "**Обязательные технические правила интерфейса** (каждое — из починенного бага, "
            "подробности в `knowledge/ux/ui_design_system.md` и `knowledge/ux/ui_implementation.md`):\n"
            "- Все значения — токенами в одном `src/ui/theme.css`: цвета, две гарнитуры, шкала "
            "отступов, радиусы, длительности, `--z-*`. Литерал `#RRGGBB` или `z-index: 9999` "
            "внутри экрана запрещён; `grep -rE '#[0-9a-fA-F]{3,8}' src/ui` мимо темы обязан быть пуст.\n"
            "- Слои над канвасом прозрачны для ввода: контейнер — `pointer-events: none`, "
            "`auto` включают только листовые интерактивные элементы. Слой HUD не кликается "
            "никогда. Полноэкранный оверлей, оставленный на `auto`, съедает игровой ввод — "
            "и это выглядит как «на телефоне не работает управление».\n"
            "- Интерфейс тянется одним множителем `--ui-scale`, а не отдельной вёрсткой под "
            "каждый телефон, — но множитель обязан где-то **читаться**. Он объявляется в "
            "`theme.css` брейкпоинтами (`:root { --ui-scale: 1 }`, `@media (max-width: 720px)` "
            "→ `0.86`, `@media (max-width: 420px)` → `0.74`) и умножает отступы и кегли: "
            "`padding: calc(var(--space-4) * var(--ui-scale))`, "
            "`font-size: clamp(14px, calc(16px * var(--ui-scale)), 18px)`. Посчитать масштаб в "
            "JS и не использовать его ни в одном правиле — ровно тот же результат, что не "
            "считать вовсе: интерфейс, свёрстанный в фиксированных `px`, на 360-пиксельном "
            "экране разъезжается. Ноль `@media` в `theme.css` — признак, что этот пункт "
            "пропущен.\n"
            "- Портрет и ландшафт — два разных экрана, а не один и тот же в другом масштабе. "
            "Вертикальный FOV камеры пересчитывается под аспект (иначе в портрете "
            "горизонтальный обзор схлопывается в трубу), а раскладка HUD и кнопок проверяется "
            "в обеих ориентациях.\n"
            "- Размеры зон нажатия НЕ масштабируются: основная ≥ 96 px, остальные ≥ 64 px, "
            "зазор ≥ 12 px — палец не уменьшается вместе с экраном. Ниже 460 px по высоте "
            "кнопки допускается ужать до 56 px, и это единственное исключение.\n"
            "- Меняющиеся числа — `font-variant-numeric: tabular-nums` в слоте фиксированной "
            "ширины; полосы — `transform: scaleX()`, не `width`. HUD пишет в закэшированные "
            "узлы и только при изменении значения: пересборка разметки в кадре стоит кадров.\n"
            "- Один экран виден за раз, скрытый — `display: none`; переход один на всю игру и "
            "укладывается в 300 мс. Анимируются только `transform` и `opacity`. "
            "`prefers-reduced-motion: reduce` убирает трансформации.\n"
            "- Любое нажатие отвечает в том же кадре; действие с ожиданием переводит кнопку в "
            "`loading` и снимает его в `finally`.\n"
            "- Запрещено: `alert`/`confirm`/`prompt`, эмодзи вместо иконок (один инлайновый "
            "SVG-спрайт с `currentColor`), голый `<input type=range>` и `<select>`, текст над "
            "геймплеем без подложки или обводки, серая неактивная кнопка вместо отсутствующей "
            "на площадке возможности — такой элемент не рисуется вовсе.\n"
            "- Геометрия меню считается от ИЗМЕРЕННОГО вьюпорта (`visualViewport`, пересчёт "
            "после поворота, выхода из фуллскрина и закрытия рекламы), а не от `100vh`; "
            "нижний отступ включает измеренную высоту липкого баннера. Страница под игрой не "
            "скроллится — длинные списки скроллятся во внутреннем контейнере.\n"
            "- `backdrop-filter: blur()` на полноэкранном слое — самое дорогое свойство "
            "оверлея на мобильных GPU; только на маленьких панелях."
        )
        return "\n\n".join(parts)

    @staticmethod
    def _library_block(concept) -> str:
        """Каталог готового кода: сначала похожее на эту игру, потом всё.

        Разделение важнее, чем кажется. Один список на семьдесят строк агент
        просматривает по диагонали и не берёт из него ничего; десять строк с
        подписью «вот это про твою игру» он читает.
        """
        entries = library.load()
        if not entries:
            return "_Каталог готового кода недоступен: стенд не найден._"
        query = " ".join([
            concept.title or "", concept.genre or "", concept.subgenre or "",
            concept.hook or "", concept.player_fantasy or "",
            " ".join(m.name for m in (concept.mechanics or [])),
            " ".join(getattr(m, "description", "") for m in (concept.mechanics or [])),
        ])
        likely = library.match(query, limit=10, entries=entries)
        likely_paths = {e.path for e in likely}
        rest = [e for e in entries if e.path not in likely_paths]

        parts = []
        if likely:
            parts.append("**Похоже, пригодится именно этой игре:**\n")
            parts.append(library.catalog_markdown(likely))
            parts.append("")
        # Полный каталог лежит файлом рядом, а не здесь. Семьдесят строк в
        # промпте съедали десять килобайт и всё равно просматривались по
        # диагонали; десять строк «вот это про твою игру» — читаются.
        parts.append(
            f"Это не весь каталог: всего готовых модулей {len(entries)}. "
            f"Полный список с описаниями — в `LIBRARY.md` рядом с этим файлом. "
            f"Загляни туда, когда возьмёшься за механику, которой нет в таблице выше."
        )
        return "\n".join(parts)

    @staticmethod
    def _direction_section(concept) -> str:
        """Рамка проекта в мастер-промпте: направление и список запретов.

        Кодовый агент по умолчанию достраивает недостающее самым типичным для
        жанра образом — так в игру про доставку приезжают волны врагов. Явный
        список «чем игра не является» — единственное, что это надёжно
        останавливает, поэтому он стоит в начале промпта, а не в приложении."""
        direction = concept.direction
        if not (direction.selected_name or direction.what_it_is_not):
            return ""
        parts = ["\n---\n\n## 1b. РАМКА ПРОЕКТА: ЧТО ЭТО ЗА ИГРА И ЧЕМ ОНА НЕ ЯВЛЯЕТСЯ\n"]
        if direction.selected_name:
            parts.append(f"**Направление**: {direction.selected_name}")
        if direction.selection_reason:
            parts.append(f"**Почему выбрано именно оно**: {direction.selection_reason}")
        if direction.signature_scene:
            parts.append(f"**Узнаваемая сцена**: {direction.signature_scene}")
        if direction.non_negotiables:
            parts.append(
                "**Без чего проект перестаёт быть собой** (реализовать обязательно):\n"
                + "\n".join(f"- {item}" for item in direction.non_negotiables)
            )
        if direction.what_it_is_not:
            parts.append(
                "**ЗАПРЕЩЕНО ВВОДИТЬ** — даже если спецификация где-то умалчивает "
                "и даже если «так принято в жанре»:\n"
                + "\n".join(f"- {item}" for item in direction.what_it_is_not)
                + "\n\nЕсли по ходу реализации кажется, что без запрещённого элемента игра "
                "не работает — это находка для `DEVLOG.md`, а не разрешение его добавить."
            )
        if direction.rejected_reasons:
            parts.append(
                "**Рассмотренные и отклонённые направления** (не возвращай их через механики):\n"
                + "\n".join(f"- {item}" for item in direction.rejected_reasons)
            )
        return "\n\n".join(parts) + "\n"







    @staticmethod
    def _mechanic_depth_block(deep) -> str:
        """Глубина механики для кодового агента: числа, состояния, псевдокод.

        Без этого блока агент реализует жанровый шаблон, а не эту игру.
        """
        if deep is None:
            return ""
        params = "\n".join(f"  - `{p.name}` = `{p.value}` — {p.tuning_note}" for p in deep.parameters)
        states = ", ".join(f"`{s}`" for s in deep.states)
        feedback = "\n".join(f"  - {f}" for f in deep.feedback_layers)
        synergies = "\n".join(f"  - {s}" for s in deep.synergies)
        pseudocode = f"\n- **Псевдокод тика**:\n```text\n{deep.pseudocode.strip()}\n```" if deep.pseudocode.strip() else ""
        lines = [f"- **Решение игрока**: {deep.player_decision}" if deep.player_decision else ""]
        if states:
            lines.append(f"- **Состояния**: {states}")
        if params:
            lines.append(
                "- **Числовые параметры** — лежат в `balance.yaml`, читай оттуда и не "
                f"переписывай литералами в код:\n{params}"
            )
        if feedback:
            lines.append(f"- **Слои отклика**:\n{feedback}")
        if deep.failure_mode:
            lines.append(f"- **Режим отказа игрока**: {deep.failure_mode}")
        if deep.mastery_curve:
            lines.append(f"- **Кривая мастерства**: {deep.mastery_curve}")
        if deep.counterplay:
            lines.append(f"- **Сопротивление игры**: {deep.counterplay}")
        if synergies:
            lines.append(f"- **Синергии**:\n{synergies}")
        if deep.why_unique:
            lines.append(f"- **Почему это не жанровый шаблон**: {deep.why_unique}")
        return "\n".join([l for l in lines if l]) + pseudocode + "\n"

    @staticmethod
    def _core_design_block(concept) -> str:
        """Уникальное ядро игры: петли, напряжение и формулы — до списка механик."""
        core = concept.core_design
        if not (core.micro_loop or core.core_formulas or core.signature_moment):
            return ""

        def steps(items) -> str:
            return "\n".join(
                f"- **{s.step}** ({s.duration}): игрок — {s.player_action}; игра — {s.game_response}; "
                f"решение — {s.decision}"
                for s in items
            )

        parts = []
        if core.signature_moment:
            parts.append(f"**Фирменный момент**: {core.signature_moment}")
        if core.what_makes_it_different:
            parts.append(f"**Чем петля отличается от соседей по жанру**: {core.what_makes_it_different}")
        if core.genre_template_rejected:
            parts.append(f"**Шаблон жанра, который НЕ реализуем**: {core.genre_template_rejected}")
        if core.loop_diagram.strip():
            parts.append(f"**Схема петли**:\n```text\n{core.loop_diagram.strip()}\n```")
        if core.micro_loop:
            parts.append(f"**Микро-петля (посекундно)**:\n{steps(core.micro_loop)}")
        if core.meso_loop:
            parts.append(f"**Мезо-петля (этап)**:\n{steps(core.meso_loop)}")
        if core.macro_loop:
            parts.append(f"**Макро-петля (забег)**:\n{steps(core.macro_loop)}")
        if core.tension_curve:
            parts.append(f"**Кривая напряжения**: {core.tension_curve}")
        if core.core_formulas:
            formulas = "\n".join(f"- `{f}`" for f in core.core_formulas)
            parts.append(f"**Формулы ядра (реализуй буквально)**:\n{formulas}")
        if core.run_progression:
            parts.append("**Прогрессия внутри забега**:\n" + "\n".join(f"- {i}" for i in core.run_progression))
        if core.meta_progression:
            parts.append("**Мета-прогрессия**:\n" + "\n".join(f"- {i}" for i in core.meta_progression))
        return "\n\n".join(parts)

    @classmethod
    def _generate_module_map(cls, concept) -> str:
        """Динамическая карта модулей под архитектуру и системы именно этой игры."""
        is_3d = concept.renderer == "threejs"
        physics_desc = "Rapier3D / Physics world manager & colliders" if is_3d else "Matter.js / Physics world manager"

        # Системы из концепции или механик
        systems_lines = []
        if concept.gameplay_systems:
            for s in concept.gameplay_systems[:5]:
                name_clean = re.sub(r"[^a-zA-Z0-9]+", "", s.name.title())
                if not name_clean.endswith("System") and not name_clean.endswith("Manager"):
                    name_clean += "System"
                purpose = s.purpose[:45] if s.purpose else "Game logic execution"
                systems_lines.append(f"│   ├── {name_clean}.ts{' ' * max(1, 22 - len(name_clean))}# {purpose}")
        else:
            for m in concept.mechanics[:4]:
                name_clean = re.sub(r"[^a-zA-Z0-9]+", "", m.name.title())
                if not name_clean.endswith("System") and not name_clean.endswith("Manager"):
                    name_clean += "System"
                desc = m.description[:45] if m.description else "Core mechanic logic"
                systems_lines.append(f"│   ├── {name_clean}.ts{' ' * max(1, 22 - len(name_clean))}# {desc}")

        if not systems_lines:
            systems_lines = [
                "│   ├── GameplayManager.ts     # Core loop controller",
                "│   └── ProgressionManager.ts  # Level state & progression",
            ]
        systems_block = "\n".join(systems_lines)

        scene_desc = ("Three.js scene graph, lights, perspective camera lerp" if is_3d
                      else "Three.js scene graph under an orthographic camera, layered by renderOrder")

        return f"""src/
├── main.ts                    # Bootstrap, Playgama Bridge init, Game launch
├── core/
│   ├── Game.ts                # Main coordinator & state machine
│   ├── GameLoop.ts            # 60Hz fixed update loop with delta clamping
│   └── EventBus.ts            # Typed publish/subscribe event dispatcher
├── platform/
│   ├── PlaygamaService.ts     # Wrapper for @playgama/bridge (Ads, Save, Leaderboards)
│   └── StorageService.ts      # Cloud & LocalStorage sync with debouncing
├── physics/
│   └── PhysicsWorld.ts        # {physics_desc}
├── entities/
│   ├── Player.ts              # Player entity & input handling
│   └── EntityManager.ts       # Dynamic entity pool & lifecycle
├── systems/
{systems_block}
├── rendering/
│   ├── SceneManager.ts        # {scene_desc}
│   ├── ProceduralModels.ts    # Styled models / geometry for {concept.title}
│   └── ParticleSystem.ts      # Particle effects & visual feedback
├── ui/
│   ├── theme.css              # Единственное место со значениями: цвета, шрифты, шкала, слои
│   ├── UiRoot.ts              # Слои над канвасом, измеренный вьюпорт, safe-area + баннер
│   ├── ScreenRouter.ts        # Экраны как автомат: один видимый, один общий переход
│   ├── Hud.ts                 # Запись в закэшированные узлы только при изменении значения
│   ├── components/            # Button, IconButton, Panel, Modal, Toast, Meter, Stat, ListRow
│   ├── screens/               # По файлу на экран, каждый — со своими loading/empty/error
│   ├── icons.ts               # Один инлайновый SVG-спрайт, цвет через currentColor
│   └── TouchControls.ts       # Mobile touch input adapter
└── audio/
    └── AudioManager.ts        # Sound effects pool & dynamic audio feedback"""

    def compile(self, ctx: GenerationContext) -> str:
        concept = ctx.concept
        log_agent("PromptCompiler", f"Compiling definitive AI Developer Prompt for '{concept.title}'")

        dod_items = "\n".join([f"- [ ] {item}" for item in concept.definition_of_done]) if concept.definition_of_done else "- [ ] Complete playable game"
        layers_items = "\n".join([
            f"- **{layer.get('name', 'Layer') if isinstance(layer, dict) else str(layer)}**: {layer.get('responsibility', layer.get('desc', '')) if isinstance(layer, dict) else ''}"
            for layer in concept.tech_spec.layers
        ]) if concept.tech_spec.layers else "- **Core Systems Layer**: Complete game loop and state management"
        deep_by_name = {d.name.strip().lower(): d for d in concept.core_design.mechanics if d.name}
        # Отклик печатался дважды: коротким полем `feedback` и подробным
        # `feedback_layers` из глубокой спецификации — один и тот же текст, два
        # заголовка, и так на каждой механике. Короткое поле остаётся только
        # там, где подробного нет.
        mechanics_items = "\n".join([
            f"### {m.name} ({m.priority.upper()})\n"
            f"- **Category**: {m.category}\n"
            f"- **Description**: {m.description}\n"
            f"- **Player Input**: {m.player_interaction}\n"
            + (f"- **Hit & Sensory Feedback**: {m.feedback}\n"
               if m.feedback and not getattr(
                   deep_by_name.get(m.name.strip().lower()), "feedback_layers", None) else "")
            + f"- **Technical Complexity**: {m.technical_complexity}\n"
            + self._mechanic_depth_block(deep_by_name.get(m.name.strip().lower()))
            for m in concept.mechanics
        ])
        core_block = self._core_design_block(concept)
        library_table = self._library_block(concept)
        menu_staging = (getattr(concept.art, "menu_staging", "") or "").strip() \
            or "не задана — придумай сам и опиши в DESIGN.md"
        rewarded_items = "\n".join([
            f"- **{r.name} (`{r.id}`)**: {r.benefit} (Trigger: {r.trigger_moment}, Limit: {r.cooldown_or_limit})"
            for r in concept.monetization.rewarded_placements
        ])
        # The knowledge base is the factory's memory of what actually ships on
        # these platforms. It is injected verbatim so the coding agent never has
        # to rediscover a rule that already cost a production bug.
        profile = self._control_profile(ctx)
        touch_layout = self._touch_layout(concept, profile)
        desktop_controls = self._DESKTOP_LAYOUTS.get(profile, self._DESKTOP_LAYOUTS["default"])
        control_verbs_rule = self._CONTROL_VERBS_RULE
        control_verbs = self._control_verbs_block(concept)
        log_agent("PromptCompiler", f"Control profile: {profile}")

        ui_contract = self._ui_block(concept)

        direction_section = self._direction_section(concept)

        critical_rules = self._platform_rules_block(concept)
        if not critical_rules:
            log_agent("PromptCompiler", "WARNING: knowledge/CRITICAL_RULES.md missing — prompt will omit platform rules")
        # Индекс знаний в промпте — это не библиотека «на всякий случай», а список
        # того, что кодовый агент обязан прочитать. Полный дамп базы тянул в игру
        # чужой жанр: документы про орду и карточки апгрейда лежали ровно там же,
        # где нужные. Здесь остаётся только выбор куратора знаний.
        knowledge_index = self._knowledge_block(concept)

        roadmap_items = "\n".join([
            f"### Phase {phase.phase_number}: {phase.title} ({phase.duration_days} days)\n"
            f"- **Deliverable**: {phase.milestone_deliverable}\n"
            + "\n".join([f"  - {task}" for task in phase.tasks])
            for phase in concept.roadmap
        ])

        prompt_content = f"""# FINAL AI DEVELOPER PROMPT: {concept.title.upper()} 🎮⚡

> **ИНСТРУКЦИЯ КОДОВОМУ АГЕНТУ**
> Ты ведущий разработчик этой игры. Задача — довести её до состояния, в котором
> она проходит приёмку из `ACCEPTANCE.md`: работающая, играбельная, принятая
> площадкой. Заглушки, TODO и «пока так» результатом не считаются.

### Как читать этот документ

Требования размечены по обязательности. Когда обязательно всё, не обязательно ничего.

| Уровень | Что значит | Что делать при сомнении |
|---|---|---|
| **MUST** | Без этого игра не работает или не проходит модерацию площадки. | Не обсуждается. Проверяется в `ACCEPTANCE.md`, разделы A–C. |
| **SHOULD** | Проектное решение фабрики: так игра задумана. | Отступать можно, но с записью в `DEVLOG.md` — что и почему. |
| **MAY** | На твоё усмотрение. | Решай сам, спрашивать не нужно. |

Неразмеченное считается **SHOULD**. Всё, что помечено «ЗАПРЕЩЕНО» в секции 1b, —
это **MUST**, даже если спецификация где-то умалчивает.

### Порядок работы

Читать документ целиком до первой строчки кода не нужно. Порядок такой:

0. `node scripts/fetch-knowledge.mjs` — забрать базу знаний в `docs/ref/`. Одна команда, дальше работа идёт офлайн. **MUST**, и раньше всего остального: без этого половина адресов в документе никуда не ведёт.
1. `ACCEPTANCE.md` — чем закончится работа. Дальше всё делается под него.
2. Секция 1b — чем эта игра является и чем она не является. Рамка всего остального.
3. `DESIGN.md` — написать самому, до первой строчки кода. Секция 7 говорит, что в нём должно быть и чего в нём быть не должно.
4. Каркас: `package.json`, Vite, TypeScript strict, `src/vite-env.d.ts` с `/// <reference types="vite/client" />` (TypeScript 5 пропускает `import './ui/theme.css'` молча, TypeScript 6 роняет на нём сборку — один файл снимает вопрос навсегда), пустая сцена Three.js, цикл с фиксированным шагом. Playgama Bridge и `game_ready` — сразу, а не в конце (проверки **C1–C4**).
5. Главная механика из секции 3 — одна, до играбельного состояния. Не все сразу. Перед тем как писать её с нуля — секция 3c: возможно, она уже написана.
6. Дальше по фазам роадмапа (секция 8), каждая фаза закрывает свои номера проверок.
7. `node scripts/check-spec.mjs` — после каждой фазы, а не один раз в конце.
8. `node scripts/smoke.mjs` — перед каждым отчётом. Он собирает игру, открывает её в браузере и трогает управление. Зелёный `check-spec` при красном `smoke` означает ровно одно: код выглядит правильно и не работает.

---

## 1. PROJECT IDENTITY & GOAL
- **Game Title**: {concept.title}
- **Project Slug**: `{concept.slug}`
- **Genre**: {concept.genre} ({concept.subgenre})
- **Target Platform**: {concept.platform}
- **Orientation**: {concept.orientation.capitalize()}
- **Target Audience**: {concept.target_audience}
- **Player Fantasy**: {concept.player_fantasy}
- **Core Hook**: {concept.hook}
- **Session Model**: {concept.session_model}

{direction_section}
---

## 2. TECHNOLOGY STACK & RENDERING ENGINE
- **Language**: {concept.tech_spec.language}
- **Bundler & Dev Server**: {concept.tech_spec.bundler}
- **Renderer**: **{concept.tech_spec.renderer.upper()}** ({concept.tech_spec.renderer_version})
  - *Selection Rationale*: {concept.renderer_reason}
- **Physics Simulation**: **{concept.tech_spec.physics_engine}** (Fixed 60Hz timestep with accumulator)
- **Audio Engine**: {concept.tech_spec.audio_engine}
- **State Management**: {concept.tech_spec.state_manager}
- **Platform SDK**: `{concept.playgama.sdk_version}`

### Performance Budgets
- **Target FPS**: {concept.tech_spec.target_fps} FPS (Desktop & Mobile)
- **Max Draw Calls**: < {concept.tech_spec.max_draw_calls}
- **Max Triangles / Active Sprites**: < {concept.tech_spec.max_triangles_or_sprites}
- **Max Bundle Size**: < {concept.tech_spec.bundle_size_budget_mb} MB (Gzipped + assets)

---

## 3. CORE GAMEPLAY LOOP & MECHANICS
**Core Loop Sequence**:
```text
{concept.core_loop}
```

{core_block}

{mechanics_items}

---

## 3b. ⚠️ СТРОГИЙ ЗАПРЕТ ЖАНРОВЫХ ШАБЛОНОВ И КЛОНОВ (CRITICAL ANTI-CLICHÉ RULES)
Кодовый агент ОБЯЗАН реализовать уникальную игру, спроектированную в этом ТЗ, а не шаблонный автошутер:
1. **ЗАПРЕТ ШАБЛОННЫХ РОГАЛИКОВ И КАРТОЧЕК**: Если игра прямо не требует карточный драфт в GDD, **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** добавлять спам волн врагов и всплывающее окно «Выберите 1 из 3 карт апгрейда».
2. **ЗАПРЕТ СЕРЫХ ПРИМИТИВОВ НА ПУСТОЙ ПЛОСКОСТИ**: Создавай выразительную процедурную низкополигональную 3D/2D графику, точно соответствующую `ART_DIRECTION.md` (тематические персонажи, рельеф, модули, объекты окружения, частицы), а не бегающий куб на сером полу.
3. **ТОЧНОЕ СОБЛЮДЕНИЕ МЕХАНИК**: Реализуй все состояния, формулы, тайминги и слои отклика из `MECHANICS.md` (включая Web Audio звуки, импульсы камеры, визуал и тач-инпут).
4. **СПЕЦИФИЧЕСКОЕ УПРАВЛЕНИЕ**: Реализуй схему управления под конкретную механику этой игры (свайпы, жесты, траектории, физический дрифт, прицеливание), а не стандартный стик.

---

## 3c. ГОТОВОЕ: ЧТО УЖЕ НАПИСАНО И ОТЛАЖЕНО — SHOULD

Ниже — рабочий код фабрики: не примеры из статьи, а модули, которые крутились в
живых сценах, и в которых числа выставлены не наугад. Каждый файл объясняет в
своей шапке, почему константы именно такие — это та часть работы, которую с
нуля не воспроизвести за один заход.

**Правило.** Прежде чем писать механику с нуля, посмотри, нет ли её здесь.
Нашёл — тяни файл и подгоняй под свою игру. Не нашёл или не подходит — пиши
сам, но запиши в `DEVLOG.md` строку «взял/не взял <файл>, потому что …».
Молча проигнорировать готовое нельзя: это стоило нам рэгдолла, который писали
заново, хотя он лежал написанным.

Загрузка любого файла — одной командой, путь берётся из таблицы:

```bash
node scripts/fetch-knowledge.mjs workspace/knowledge-showcase/src/game/stealthSensing.ts
```

Файл появится в `docs/ref/<путь>`, оттуда копируй в `src/`.

Колонка «Готовность» — это часы работы, а не оттенок смысла:
- **копируется как есть** — ни одного импорта, чистая логика и числа. Взял, переименовал, поехал.
- **нужен three, больше ничего** — тянет только `three`, чужого проекта в нём нет.
- **образец, переписать под себя** — тянет модули стенда. Читать как показ того, как это собирается, а не копировать.

{library_table}

---

## 4. SOFTWARE ARCHITECTURE & SYSTEMS
The game must be built with a clean, decoupled layer architecture:

{layers_items}

### Module Map (`src/`):
```text
{self._generate_module_map(concept)}
```

### Контракт модулей — MUST

Карта выше говорит, какие файлы завести. Ниже — чего им нельзя, потому что
именно на этом ломаются сгенерированные проекты:

- **DOM создаётся только в `src/ui/`.** Ни один файл вне `src/ui/components/` и
  `src/ui/screens/` не вызывает `document.createElement` и не присваивает
  `element.style.*`. Экран, собранный инлайновыми стилями в обход `theme.css`, —
  это второй экран, который перестанет совпадать с первым.
- **Значения — только в `src/ui/theme.css`.** Проверяется **B1**.
- **`src/core/` не знает про площадку.** Playgama Bridge живёт в
  `src/platform/`; всё остальное общается с ним через свой интерфейс. Иначе
  игру нельзя запустить локально без SDK.
- **`src/ui/` не знает про физику и рендер.** Интерфейс читает состояние
  через `EventBus` и не держит ссылок на `THREE.*` и на мир Rapier.
- **Числа игры — из `balance.yaml`.** Литерал скорости, урона, тайминга или
  радиуса в коде — баг: правка баланса не должна быть правкой кода.
- **Цикл обновления не аллоцирует.** Ни `new`, ни литерала объекта, ни
  `array.map` в кадре: пулы заводятся заранее. Проверяется **E4**.
- **Каждый модуль экспортирует один публичный класс или функцию** и не тянет
  импорт из соседнего слоя мимо своего интерфейса.

---

## 5. PLAYGAMA BRIDGE INTEGRATION SPECIFICATION
Platform integration is powered by `@playgama/bridge`.

### 1. Initialization & Ready Event
`game_ready` is **NOT** sent after `initialize()` — that dismisses the platform splash over an unloaded game. It is sent once, after assets are loaded and the menu is interactive.

```typescript
export async function bootstrapPlatform(): Promise<void> {{
    // A blocked sdk.js (ad blocker, CDN failure) must not mean a permanent black screen.
    await Promise.race([bridge.initialize(), new Promise((r) => setTimeout(r, 10_000))]);
    bridge.platform.sendMessage('in_game_loading_started');
}}

let gameReadySent = false;
export function sendGameReady(): void {{
    if (gameReadySent) return;                  // a second send can re-arm the platform splash
    gameReadySent = true;
    try {{ bridge.platform.sendMessage('game_ready'); }} catch {{}}
    try {{ bridge.platform.sendMessage('in_game_loading_stopped'); }} catch {{}}
}}
```

**Boot order (strict).** Nothing in this chain may wait on a player decision:
page guards → `initialize()` → language → silent VK/OK auth → load save → redeem pending purchases → build engine/UI → progress to 100% → `sendGameReady()` → arm banners → first-launch tutorial.
Keep a 15 s watchdog that sends `game_ready` regardless of boot failures.

### 2. Advertisement Flow
- **Interstitial Ads**:
  - Minimum **90 seconds** cooldown, and never below the platform's configured minimum.
  - Only at natural breaks traceable to a real click (run over, level complete, leaving to menu). Never at boot, never mid-combat, never right after a purchase.
  - Arm the slot when the run ends; fire it when the player taps to leave the result screen.
  - Never call `showInterstitial()` from a state method — the click handler decides.
- **Rewarded Ads** — the reward is granted **only** on `state === 'rewarded'`, never when the promise resolves. Always `off()` the listener and guard re-entry, or one ad pays out twice:
{rewarded_items}
- Every ad surface is capability-gated: if `isRewardedSupported` is false the button is **not rendered at all**.

### 3. Cloud Storage & Save State
- Persistent storage key: `"{concept.playgama.cloud_save_keys[0]}"` — one key, one JSON object.
- `bridge.storage.set(key, value)` / `get(key)` take **no `storageType` argument**; v2 picks cloud vs. local.
- Normalize on read: a corrupted or truncated save must boot on defaults, not crash.
- Mirror to `localStorage` for instant/offline boot, but never as the only copy — it is partitioned third-party storage inside the platform iframe. Settings (mute, volume, language) live in the save.
- Debounce writes by 1.5 s **and** flush on `pagehide` / `visibilitychange`.
- Daily/timed content uses `bridge.platform.getServerTime()`, never the device clock.

### 4. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED` — not `visibility_state_changed`, which misses interstitials.
- Fire the callback once with the current value at subscribe time; a game booted in a hidden tab otherwise starts in the wrong state.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

### 5. Authorization
- `authorize()` only from an explicit player action — **except** VK/OK, where it is silent, runs at boot before saves, and is time-boxed to 5 s.
- Guests have a non-null `id` and `name`: the only reliable check is `player.isGuest`.
- Never `await` a dialog-showing `authorize()` inside boot.

---

## 6. USER INTERFACE & MOBILE CONTROLS
Мобильное управление — обязательная часть поставки, а не «доделаем потом».
Большинство игроков на Яндекс Играх / VK / Playgama заходят с телефона: игра без
рабочего тач-управления не проходит приёмку, даже если на клавиатуре всё идеально.

- **Orientation**: {concept.orientation.capitalize()}
- **Safe Area Insets**: `padding: calc(18px + env(safe-area-inset-bottom))` и аналогично
  для left/right — кнопки не должны попадать под вырез камеры и системные жесты.

### Визуальный контракт интерфейса
Интерфейс — первое, что видит игрок: до геймплея он смотрит на меню. Меню,
собранное из умолчаний браузера, обесценивает всё, что сделано за ним, и это
самый заметный признак недоделанной игры. Всё ниже — требование, а не пожелание.

{ui_contract}

### Контракт тач-управления
{touch_layout}

- **Реализация только на Pointer Events** (`pointerdown/move/up/cancel`) с
  `setPointerCapture` и учётом `pointerId` для каждой кнопки: `touchstart/end`
  теряет палец на границе элемента, а второй палец сбрасывает первый.
- **Если в раскладке есть стик** — он плавающий: зона захвата — вся левая
  половина экрана, база появляется под пальцем, мёртвая зона 8%, иначе
  управление дрожит. Если раскладка обходится без стика — не добавляйте его.
- **Отмена браузерных жестов**: `touch-action: none`, отмена `contextmenu`,
  `dragstart` и `touchmove` с `{{ passive: false }}`; `-webkit-tap-highlight-color: transparent`.
- **Видимость по состоянию**: слой управления показан только в игровом процессе,
  скрыт в меню / гараже / паузе / модалках и при скрытии сбрасывает все оси и
  кнопки (также по `blur` и `visibilitychange`).
- **Размеры**: основная кнопка действия ≥ 96 px, второстепенные ≥ 64 px, зазор ≥ 12 px.
- **Отладочный флаг** `?touch=1` принудительно включает мобильную раскладку на
  десктопе (и `?touch=0` выключает) — без него управление невозможно проверить.
- Клавиатура и тач работают параллельно и не глушат друг друга.

### Desktop Controls
{desktop_controls}

{control_verbs_rule}

{control_verbs}

---

## 6a. ЖУРНАЛ РАЗРАБОТКИ И CHANGELOG (ЧАСТЬ DEFINITION OF DONE)
Проект живёт в песочнице `workspace/{concept.slug}/`, и вся работа за её пределы
не выходит. Правила работы продублированы в `AGENTS.md` в корне проекта —
прочитай его первым. В корне также ведутся два журнала; они обновляются в конце
**каждой** рабочей сессии, до отчёта о завершении:

- **`DEVLOG.md`** — запись вида `## ГГГГ-ММ-ДД ЧЧ:ММ — <суть>` с пунктами
  **Задача**, **Сделано**, **Затронутые файлы**, **Проверено**,
  **Известные проблемы / следующий шаг**.
- **`CHANGELOG.md`** — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/):
  раздел `## [Unreleased]`, подразделы Added / Changed / Fixed / Removed,
  формулировки на языке игрока, а не описание диффа.
- **`README.md`** — как запустить (`npm install`, `npm run dev`), управление на
  клавиатуре и на телефоне, структура каталогов.

Игра обязана запускаться командой `npm run dev` и открываться в браузере без
ошибок в консоли: именно так её проверяет фабрика (вкладка «Играть»).

---

## 7. ДИЗАЙН: ЕГО ПИШЕШЬ ТЫ — MUST

Готового арт-дирекшена в этом пакете нет намеренно. Дизайн, продиктованный
списком полей, получается одинаковым от игры к игре, и узнать в нём конкретную
игру невозможно. Поэтому первым делом, до кода, ты пишешь `DESIGN.md` сам.

**Что в нём должно быть** (без этих пяти пунктов файл не считается написанным):

1. **Одна фраза о том, как игра выглядит.** Не «мрачный киберпанк», а что
   именно видит игрок в первую секунду.
2. **Палитра** — 5–7 цветов с ролями (фон, поверхность, текст, акцент, опасность,
   успех) и HEX. Они же становятся токенами в `theme.css`.
3. **Камера и свет** — где стоит камера, что она захватывает, откуда светит и
   почему сцена читается на телефоне.
4. **Экраны** — для каждого: что на нём, где три зоны (заголовок, содержимое,
   действие), какое действие главное.
5. **Сцена за меню** — что живёт на фоне главного меню. Не заливка, не блюр
   поверх ничего: работающая сцена игры под пониженной нагрузкой.

**Чего в нём быть не должно** — это уровень **MUST**, проверяется приёмкой:
эмодзи вместо иконок, `alert()` вместо модалки, непрозрачная плашка поверх
канваса, фиолетово-синий градиент, интерфейс из умолчаний браузера.

**Отправная точка от фабрики** — это подсказка, а не приговор. Не подошло —
меняй и запиши в `DEVLOG.md`, что и почему:

- Стиль: {concept.art.style_name}
- Камера: {concept.art.camera_perspective} (FOV {concept.art.camera_fov}°, наклон {concept.art.camera_pitch_angle}°)
- Среда: {concept.art.environment_theme}
- Свет: {concept.art.lighting_setup}
- Тема интерфейса: {concept.art.ui_theme} (реализация — секция 6)
- Сцена за меню: {menu_staging}

Подробности отбора — в `ART_DIRECTION.md` и `UI_UX_SPECIFICATION.md` рядом.

---

## 8. РОАДМАП

Фаза закончена не тогда, когда код написан, а когда закрыты её проверки из
`ACCEPTANCE.md`. Прогоняй `node scripts/check-spec.mjs` в конце каждой фазы,
а `node scripts/smoke.mjs` — начиная с фазы «Каркас и площадка»: с этого момента
игра обязана открываться, и каждая следующая фаза обязана оставлять её открывающейся.

| Фаза | Чем закрывается |
|---|---|
| Подготовка | **F4**, **F1** — база загружена в `docs/ref/`, `DESIGN.md` написан |
| Каркас и площадка | **A1**, **A3**, **A5**, **S1–S4** — игра собирается, открывается и рисует кадр |
| Главная механика | **D1**, **B6** — в неё можно играть, ввод доходит до игры |
| Остальные механики и петля | **D2–D5**, **B9–B11** — петля проходится целиком |
| Интерфейс и подача | **B1–B5**, **B7–B8**, **B12**, **S6** — интерфейс собран из токенов, меню стоит на живой сцене, на телефоне ничего не разъехалось |
| Полировка и релиз | **C5–C11**, **E1–E5**, **A2**, **A4**, **S5**, **F2–F3** — сохранения, реклама, кадры, сборка |

{roadmap_items}

---

## 9. ПРАВИЛА ПЛОЩАДКИ — УРОВЕНЬ MUST
Каждое правило ниже — след бага, дошедшего до продакшена, или отказа модерации.
Они перекрывают любую привычку, туториал и пример — включая куски из документации
Playgama и Яндекса, многие из которых описывают устаревший контракт Bridge v1.

{critical_rules}

---

## 10. ПРИЁМКА — MUST

Полный список проверок с номерами лежит в `ACCEPTANCE.md`, рядом с этим файлом.
Он и есть определение готовности: пока хотя бы один пункт разделов **A–C**
красный, игра не готова — это не качество, это работоспособность.

Проверяется двумя скриптами. Оба уже лежат в проекте и зависимостей не требуют —
пропиши их в `package.json` как `check:spec` и `smoke`:

```bash
node scripts/check-spec.mjs   # чтение исходников: недописанное, мёртвое, несогласованное
node scripts/smoke.mjs        # сборка, запуск в браузере, кадры, ввод, телефон
```

Второй важнее первого. `check-spec` умеет только читать код и потому не видит
самого главного: собирается ли проект, открывается ли игра, попадает ли
что-нибудь в кадр, переживает ли она нажатие. Уже случался пакет, зелёный по
всей статике и не запускающийся вовсе. Писать код, подогнанный под проверки, —
не то же самое, что писать работающую игру: проверки описывают минимум, а не
цель.

Прогонять после каждой фазы роадмапа, а не один раз в конце. Результат
записывать строкой в `DEVLOG.md`. Пункт, который не проходит, честнее оставить
красным с объяснением, чем отметить зелёным: следующий, кто откроет проект,
будет считать его проверенным.

Критерии, которые относятся именно к этой игре:

{dod_items}

---

## 11. ГДЕ ЛЕЖИТ ОСТАЛЬНОЕ

{knowledge_index}
"""
        return prompt_content.strip()
