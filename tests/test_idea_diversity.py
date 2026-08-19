"""Тесты разнообразия идей и отказа от киберпанка как визуального умолчания."""
import pytest

from agents.idea_brainstormer import UNSOLICITED_STYLES, catalog_size, fallback_catalog
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
