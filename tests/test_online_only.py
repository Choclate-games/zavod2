"""Тесты того, что офлайн-режим фабрики выключен.

Офлайн стоил дороже, чем помогал: при недоступном провайдере прогон не падал, а
молча собирал пакет заготовками — процедурной концепцией `LocalAIProvider` и
эвристиками агентов. На выходе получался полный, валидный и совершенно чужой
проект, и отличить его от настоящего можно было только по содержанию.

Сам код заготовок не удалён (на нём держатся тесты конвейера и он переживёт
возврат офлайна) — закрыты входы в него.
"""
from pathlib import Path

import pytest

from agents.design_os_base import ask_model
from app.context import GenerationContext
from app.models import GameConcept
from providers.factory import ProviderFactory


class ExplodingProvider:
    """Провайдер, который падает — как настоящий при обрыве сети."""

    def generate_structured(self, *args, **kwargs):
        raise ConnectionError("сеть недоступна")

    def generate_text(self, *args, **kwargs):
        raise ConnectionError("сеть недоступна")


class EmptyProvider:
    """Живой провайдер, который ответил пустым. Это не офлайн, а плохой ответ."""

    def generate_structured(self, system_prompt, user_prompt, response_model, temperature=0.5):
        return response_model()

    def generate_text(self, *args, **kwargs):
        return ""


def make_ctx(provider):
    ctx = GenerationContext(raw_prompt="игра про смотрителя маяка", output_base_dir=Path("workspace"))
    ctx.ai_provider = provider
    ctx.concept = GameConcept(title="Смотритель маяка")
    return ctx


@pytest.mark.parametrize("name", ["local", "offline", "expert"])
def test_factory_refuses_offline_provider(name):
    with pytest.raises(RuntimeError, match="Офлайн-режим отключён"):
        ProviderFactory.get_ai_provider(name)


def test_factory_still_returns_a_live_provider():
    """Отключение офлайна не должно ломать обычный выбор провайдера."""
    assert ProviderFactory.get_ai_provider("agy") is not None


def test_missing_provider_stops_the_run():
    with pytest.raises(RuntimeError, match="только онлайн"):
        ask_model(make_ctx(None), "TestAgent", "system", "user", GameConcept)


def test_provider_failure_stops_the_run_instead_of_falling_back():
    """Раньше здесь было предупреждение и None — и раздел собирала эвристика."""
    with pytest.raises(RuntimeError, match="только онлайн"):
        ask_model(make_ctx(ExplodingProvider()), "TestAgent", "system", "user", GameConcept)


def test_empty_answer_is_not_treated_as_offline():
    """Пустой ответ живой модели по-прежнему отдаётся как None: это не обрыв
    связи, а плохой ответ, и раздел достраивает сам агент. Разница в том, что
    теперь об этом пишется в лог."""
    assert ask_model(make_ctx(EmptyProvider()), "TestAgent", "system", "user", GameConcept) is None
