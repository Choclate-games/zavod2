"""Тесты разнообразия идей и отказа от киберпанка как визуального умолчания."""
import pytest

from agents import idea_brainstormer
from agents.idea_brainstormer import (
    CREATIVE_LENSES,
    RENDERER,
    UNSOLICITED_STYLES,
    BrainstormedIdea,
    BrainstormFailed,
    BrainstormResult,
    GameTheme,
    IdeaBrainstormerAgent,
    ThemeResult,
    catalog_size,
    fallback_catalog,
)
from app.models import GameConcept
from providers.local import LocalAIProvider


def _has_unsolicited_style(text: str) -> bool:
    lowered = text.lower()
    return any(word in lowered for word in UNSOLICITED_STYLES)


def test_catalog_is_large_and_fully_annotated():
    ideas = fallback_catalog("", catalog_size())
    assert catalog_size() >= 30
    assert all(idea.family and idea.art_style for idea in ideas)
    assert all(idea.prompt_seed and idea.hook for idea in ideas)


def test_catalog_titles_are_unique():
    ideas = fallback_catalog("", catalog_size())
    titles = [idea.title for idea in ideas]
    assert len(titles) == len(set(titles))


def test_default_output_has_no_cyberpunk():
    for _ in range(5):
        for idea in fallback_catalog("", 10):
            blob = f"{idea.title} {idea.genre} {idea.art_style} {idea.pitch} {idea.prompt_seed}"
            assert not _has_unsolicited_style(blob), idea.title


def test_ten_ideas_come_from_ten_different_settings():
    ideas = fallback_catalog("", 10)
    assert len(ideas) == 10
    assert len({idea.family for idea in ideas}) == 10


def test_consecutive_calls_do_not_repeat_ideas():
    first = {idea.title for idea in fallback_catalog("", 10)}
    second = {idea.title for idea in fallback_catalog("", 10)}
    assert not first & second


@pytest.mark.parametrize("hint,expected_family", [
    ("кулинария кафе еда", "кулинария"),
    ("детектив расследование", "детектив"),
    ("рыбалка на озере", "рыбалка"),
])
def test_hint_puts_matching_ideas_first(hint, expected_family):
    ideas = fallback_catalog(hint, 3)
    assert ideas[0].family == expected_family


def test_art_style_follows_the_setting():
    provider = LocalAIProvider()
    bakery = provider.generate_structured("s", "игра про уютную пекарню", GameConcept)
    wasteland = provider.generate_structured("s", "3D дрифт против зомби в пустоши", GameConcept)
    ocean = provider.generate_structured("s", "погружение батискафа в океан", GameConcept)

    styles = {bakery.art.style_name, wasteland.art.style_name, ocean.art.style_name}
    assert len(styles) == 3
    assert not _has_unsolicited_style(bakery.art.style_name + bakery.art.ui_theme)
    assert not _has_unsolicited_style(wasteland.art.style_name + wasteland.art.ui_theme)


def test_cyberpunk_still_available_when_asked():
    concept = LocalAIProvider().generate_structured("s", "игра в стиле киберпанк с неоном", GameConcept)
    assert "киберпанк" in concept.art.style_name.lower()


def test_non_combat_setting_does_not_get_a_combat_loop():
    concept = LocalAIProvider().generate_structured("s", "игра про уютную пекарню", GameConcept)
    assert "враг" not in concept.core_loop.lower()
    assert "босс" not in concept.core_loop.lower()
    assert concept.mechanics and "враг" not in concept.mechanics[0].description.lower()


def test_agent_wrapper_text_does_not_leak_into_title_and_slug():
    provider = LocalAIProvider()
    concept = provider.generate_structured(
        "s",
        "User Game Pitch: игра про уютную пекарню\nTarget Platform: Playgama Bridge",
        GameConcept,
    )
    assert "user game pitch" not in concept.title.lower()
    assert "пекарн" in concept.title.lower()
    # Слаг обязан быть латинским: по нему создаётся каталог проекта.
    assert concept.slug.isascii() and concept.slug != "game-project"


# ── Генератор идей: тематики сначала, игры потом ────────────────────────────


class _RecordingProvider:
    """Провайдер-заглушка: запоминает промпты и отвечает по типу схемы."""

    def __init__(self, themes=None, ideas=None, fail_themes=False):
        self.calls = []
        self._themes = themes or []
        self._ideas = ideas or []
        self._fail_themes = fail_themes

    def generate_structured(self, system, user, schema, temperature=1.0):
        self.calls.append((schema.__name__, system, user))
        if schema is ThemeResult:
            if self._fail_themes:
                raise RuntimeError("шаг тематик недоступен")
            return ThemeResult(themes=self._themes)
        return BrainstormResult(ideas=self._ideas)


def _idea_stub(title, renderer=RENDERER):
    return BrainstormedIdea(
        title=title, genre="жанр", hook="крючок", pitch="о чём игра",
        prompt_seed="заказ на генерацию", family=f"семейство {title}",
        art_style="стиль", renderer=renderer,
    )


@pytest.fixture(autouse=True)
def _clear_brainstorm_memory():
    """Память выдач живёт в модуле — между тестами её надо обнулять."""
    idea_brainstormer._recently_shown = []
    idea_brainstormer._recent_families = []
    yield
    idea_brainstormer._recently_shown = []
    idea_brainstormer._recent_families = []


def test_themes_are_asked_before_games_and_nothing_is_ordered_but_themes():
    """Первый запрос заказывает тематики и не заказывает игр.

    Это и есть вся суть двухзаходной схемы: спросив про игры сразу, модель
    отвечает ближайшей известной игрой."""
    provider = _RecordingProvider(
        themes=[GameTheme(name="ночная пекарня")],
        ideas=[_idea_stub("Опара")],
    )
    IdeaBrainstormerAgent().brainstorm(ai_provider=provider, count=1)

    assert [call[0] for call in provider.calls] == ["ThemeResult", "BrainstormResult"]
    theme_system, theme_user = provider.calls[0][1], provider.calls[0][2]
    # Здесь заказывают нишу и оболочку, а не игру.
    assert "ниш" in theme_user.lower()
    assert "оболоч" in theme_user.lower()
    assert "концепт" not in theme_user.lower()
    assert "Игру ты не придумываешь" in theme_system


def test_designed_games_receive_the_invented_themes():
    provider = _RecordingProvider(
        themes=[GameTheme(niche="Разрушение", name="затонувший сухогруз",
                          differentiator="рушишь снизу вверх, всплывая",
                          desire="обрушить большое", verb="тянет")],
        ideas=[_idea_stub("Понтон")],
    )
    IdeaBrainstormerAgent().brainstorm(ai_provider=provider, count=1)

    game_user = provider.calls[1][2]
    assert "затонувший сухогруз" in game_user
    assert "Разрушение" in game_user                       # ниша доезжает до шага игры
    assert "рушишь снизу вверх, всплывая" in game_user     # и поворот вместе с ней
    assert "тянет" in game_user


def test_renderer_is_always_threejs_whatever_the_model_says():
    """Фабрика умеет один движок: «pixijs» из ответа модели уезжал в прогон."""
    provider = _RecordingProvider(
        themes=[GameTheme(name="тема")],
        ideas=[_idea_stub("Игра", renderer="pixijs")],
    )
    ideas = IdeaBrainstormerAgent().brainstorm(ai_provider=provider, count=1)
    assert [idea.renderer for idea in ideas] == [RENDERER]


def test_provider_failure_is_an_error_not_a_catalog():
    """Молчаливая подмена ответа каталогом и выглядела как «ИИ всё копирует»."""

    class Dead:
        def generate_structured(self, *args, **kwargs):
            raise RuntimeError("CLI не отвечает")

    with pytest.raises(BrainstormFailed):
        IdeaBrainstormerAgent().brainstorm(ai_provider=Dead(), count=5)


def test_empty_model_answer_is_an_error_too():
    provider = _RecordingProvider(themes=[GameTheme(name="тема")], ideas=[])
    with pytest.raises(BrainstormFailed):
        IdeaBrainstormerAgent().brainstorm(ai_provider=provider, count=5)


def test_games_step_survives_a_dead_themes_step():
    """Осечка первого шага не срывает генерацию — второй умеет оба шага сам."""
    provider = _RecordingProvider(ideas=[_idea_stub("Игра")], fail_themes=True)
    ideas = IdeaBrainstormerAgent().brainstorm(ai_provider=provider, count=1)
    assert len(ideas) == 1
    assert "сначала для каждой игры" in provider.calls[1][2]


def test_shown_ideas_and_project_titles_go_into_the_next_request():
    provider = _RecordingProvider(
        themes=[GameTheme(name="тема")], ideas=[_idea_stub("Опара")],
    )
    agent = IdeaBrainstormerAgent()
    agent.brainstorm(ai_provider=provider, count=1)
    idea_brainstormer.remember_titles(["Стальной дрифт"])
    agent.brainstorm(ai_provider=provider, count=1)

    second_theme_request = provider.calls[2][2]
    second_game_request = provider.calls[3][2]
    assert "семейство Опара" in second_theme_request      # тема уже разбиралась
    assert "Стальной дрифт" in second_game_request        # игра уже выпущена
    assert "Опара" in second_game_request


def test_theme_step_refuses_production_procedures():
    """Регресс: выдача съехала в симуляторы регламентов.

    Шесть идей подряд оказались производственными процедурами — ультразвуковая
    дефектоскопия каната, вакуумное напыление зеркала, массаж ядовитых желёз.
    Формально свежо, играть невозможно. Промпт обязан требовать желание, а не
    только необычность."""
    system = IdeaBrainstormerAgent._THEME_SYSTEM.lower()
    # Процедурные темы названы поимённо и запрещены.
    for banned in ("дефектоскопия", "калибровка", "наладка", "регламента"):
        assert banned in system
    # И причина названа: они выглядят свежо, а играются как работа.
    assert "играются как работа" in system


def test_game_step_bans_the_word_simulator_in_the_genre():
    """«Симулятор прецизионной юстировки» — это должность, а не жанр."""
    system = IdeaBrainstormerAgent._GAME_SYSTEM.lower()
    assert "слово «симулятор» в genre" in system
    assert "первые десять секунд" in system


def test_lenses_ask_for_desire_not_for_dull_work():
    """Линзы «начни с профессии, о которой игр не делают» и «возьми скучную
    механику» и приводили в симуляторы: они просят необычность и молчат про то,
    зачем в это играть."""
    joined = " ".join(CREATIVE_LENSES).lower()
    for gone in ("скучной", "бытовой рутины", "профессии, о которой"):
        assert gone not in joined


def test_demand_beats_novelty_in_the_theme_step():
    """Разворот критерия: ставка на спрос, а не на незанятость.

    Первая версия искала «то, про что ничего нет», и приносила ниши, пустые
    ровно потому, что туда не тянет."""
    system = IdeaBrainstormerAgent._THEME_SYSTEM.lower()
    assert "спрос" in system
    assert "незанятости" in system or "незанятая" in system


def test_proven_niches_reach_the_model():
    """Список ниш — не украшение файла: он обязан доехать в промпт."""
    provider = _RecordingProvider(
        themes=[GameTheme(niche="Гонки и дрифт", name="оболочка")],
        ideas=[_idea_stub("Игра")],
    )
    IdeaBrainstormerAgent().brainstorm(ai_provider=provider, count=1)

    theme_user = provider.calls[0][2]
    assert "НИШИ С ДОКАЗАННЫМ СПРОСОМ" in theme_user
    names = {n["name"] for n in idea_brainstormer.niches()}
    assert any(name in theme_user for name in names)


def test_every_niche_carries_keywords_for_the_anticliche_gate():
    """Без этих слов в prompt_seed критик вычистит жанр как протёкший шаблон.

    `app/anticliche.py` снимает запрет с шаблона только тогда, когда видит в
    заказе слова из `requested`. Ниша без keywords приедет в ТЗ без своего ядра."""
    for niche in idea_brainstormer.niches():
        assert niche.get("desire"), niche["name"]
        assert niche.get("saturated"), niche["name"]
        assert niche.get("keywords"), niche["name"]


def test_the_game_step_demands_the_genre_words_in_the_prompt_seed():
    provider = _RecordingProvider(
        themes=[GameTheme(niche="Выживание против орды", name="оболочка")],
        ideas=[_idea_stub("Игра")],
    )
    IdeaBrainstormerAgent().brainstorm(ai_provider=provider, count=1)
    game_user = provider.calls[1][2]
    assert "Жанр ниши обязан быть назван прямыми словами" in game_user
    # Требование сохраняется, но перестало диктовать порядок предложений:
    # оно и превратило все заказы в один бланк с жанровой шапкой впереди.
    assert "не обязан стоять первым" in game_user


# ── Поворот — это правило, а не другое существительное ──────────────────────
#
# Заказ из десяти игр приехал перекрашенным: гонки, но на молоковозе; арена,
# но на ватрушках; башня, но маяк. Формально «поворот» был заявлен в каждой
# идее, а по правилам не менялось ничего — игрок жал те же кнопки ради того
# же результата. Проверки ниже стерегут ту формулировку промпта, которая это
# различает.


def test_theme_step_asks_what_stays_the_same_before_what_changes():
    """Строка «как у всех» идёт первой и она обязательна.

    Пока модель не обязана назвать оставленное ядро, «поворотом» проходит
    смена предмета: рядом нет строки, из которой видно, что правила прежние.
    """
    provider = _RecordingProvider(themes=[GameTheme(name="тема")],
                                  ideas=[_idea_stub("Игра")])
    IdeaBrainstormerAgent().brainstorm(ai_provider=provider, count=1)
    theme_user = provider.calls[0][2]
    assert "unchanged" in theme_user
    assert theme_user.index("unchanged") < theme_user.index("differentiator")


def test_theme_step_names_the_four_things_a_twist_may_change():
    provider = _RecordingProvider(themes=[GameTheme(name="тема")],
                                  ideas=[_idea_stub("Игра")])
    IdeaBrainstormerAgent().brainstorm(ai_provider=provider, count=1)
    theme_system = provider.calls[0][1]
    for target in ("управля", "победой", "ресурс", "сопротивляется"):
        assert target in theme_system, target


def test_swapping_a_noun_is_explicitly_not_a_twist():
    provider = _RecordingProvider(themes=[GameTheme(name="тема")],
                                  ideas=[_idea_stub("Игра")])
    IdeaBrainstormerAgent().brainstorm(ai_provider=provider, count=1)
    theme_system = provider.calls[0][1]
    assert "ЭТО НЕ ПОВОРОТ" in theme_system
    assert "перекраска" in theme_system.lower()


def test_the_theme_reaches_the_game_step_with_both_halves():
    """Шаг игры видит и оставленное ядро, и изменённое правило."""
    provider = _RecordingProvider(
        themes=[GameTheme(niche="Гонки и дрифт", name="ледяной серпантин",
                          unchanged="едешь по трассе на время",
                          differentiator="тормоза нет, скорость гасит только занос",
                          twist_target="управление")],
        ideas=[_idea_stub("Игра")],
    )
    IdeaBrainstormerAgent().brainstorm(ai_provider=provider, count=1)
    game_user = provider.calls[1][2]
    assert "едешь по трассе на время" in game_user
    assert "тормоза нет, скорость гасит только занос" in game_user
    assert "управление" in game_user


# ── Крючок вместо аннотации к трейлеру ──────────────────────────────────────


def test_game_step_bans_cinematic_openers_and_decorative_numbers():
    provider = _RecordingProvider(themes=[GameTheme(name="тема")],
                                  ideas=[_idea_stub("Игра")])
    IdeaBrainstormerAgent().brainstorm(ai_provider=provider, count=1)
    game_system = provider.calls[1][1]
    assert "Момент, когда" in game_system      # назван как запрещённый зачин
    assert "пятнадцати слов" in game_system


@pytest.mark.parametrize("written,expected", [
    ("Момент, когда пуля пробивает штифт ледника.", "Пуля пробивает штифт ледника."),
    ("Тот самый миг, когда лёд трескается", "Лёд трескается"),
    ("Представь, как башня едет за тобой", "Башня едет за тобой"),
    ("Башня едет за тобой", "Башня едет за тобой"),
])
def test_filler_opener_is_stripped_from_the_hook(written, expected):
    """Запрет стоит и в промпте, но на температуре 1.0 зачин возвращается.

    Срезаем детерминированно: фраза от этого не теряет ни слова смысла.
    """
    assert idea_brainstormer.strip_filler_opener(written) == expected


def test_the_hook_of_a_generated_idea_comes_back_clean():
    idea = _idea_stub("Игра")
    idea.hook = "Момент, когда трибуны замолкают."
    provider = _RecordingProvider(themes=[GameTheme(name="тема")], ideas=[idea])
    result = IdeaBrainstormerAgent().brainstorm(ai_provider=provider, count=1)
    assert result[0].hook == "Трибуны замолкают."


# ── Заказ не бланк: по его первым словам называется каталог проекта ─────────


def test_the_seed_may_not_start_with_a_genre_header():
    provider = _RecordingProvider(themes=[GameTheme(name="тема")],
                                  ideas=[_idea_stub("Игра")])
    IdeaBrainstormerAgent().brainstorm(ai_provider=provider, count=1)
    game_user = provider.calls[1][2]
    assert "ЗАПРЕЩЕНО" in game_user
    assert "папка проекта" in game_user
