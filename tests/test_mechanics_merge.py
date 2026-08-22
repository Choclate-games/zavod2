# -*- coding: utf-8 -*-
from pathlib import Path
import pytest

from app.config import config
from agents.mechanics_architect import MechanicsArchitectAgent
from app.models import MechanicDeepSpec, MechanicParameter
from app.web.service import service

def test_template_mixing_toggle():
    base_mechs = [
        MechanicDeepSpec(name="Базовая шаблонная нарезка", role_in_loop="core"),
        MechanicDeepSpec(name="Базовый шаблонный вок", role_in_loop="core"),
    ]
    ai_mechs = [
        MechanicDeepSpec(name="Уникальная гравитационная воронка", role_in_loop="core"),
    ]

    # При allow_template_mixing = False возвращается СТРОГО результат модели
    config.allow_template_mixing = False
    merged_strict = MechanicsArchitectAgent._merge_mechanics(base_mechs, ai_mechs)
    assert len(merged_strict) == 1
    assert merged_strict[0].name == "Уникальная гравитационная воронка"

    # При allow_template_mixing = True подмешиваются недостающие базовые шаблоны
    config.allow_template_mixing = True
    merged_mixed = MechanicsArchitectAgent._merge_mechanics(base_mechs, ai_mechs)
    assert len(merged_mixed) == 3

    # Возвращаем False
    config.allow_template_mixing = False

def test_web_settings_allow_template_mixing():
    settings = service.settings_payload()
    assert "allow_template_mixing" in settings

    # Тестируем сохранение через save_settings
    service.save_settings({"allow_template_mixing": False})
    assert config.allow_template_mixing is False
