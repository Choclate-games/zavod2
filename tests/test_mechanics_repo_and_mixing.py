# -*- coding: utf-8 -*-
from pathlib import Path
import pytest
import yaml

from app.config import config
from app.mechanics_repo import MechanicsRepository
from agents.mechanics_architect import MechanicsArchitectAgent
from app.models import MechanicDeepSpec, MechanicParameter
from app.web.service import service

def test_mechanics_repo_find_relevant():
    repo = MechanicsRepository.get_instance()
    results = repo.find_relevant("дрифт на машине и таран зомби", limit=3)
    assert len(results) > 0
    formatted = repo.format_for_prompt(results)
    assert len(formatted) > 10

def test_mechanics_repo_persist_temp(tmp_path):
    temp_yaml = tmp_path / "test_mechanics.yaml"
    initial_data = {"version": "2.1.0", "total_mechanics": 1, "mechanics": {"test_old": {"name": "Старая механика", "category": "core", "description": "Тест"}}}
    temp_yaml.write_text(yaml.safe_dump(initial_data), encoding="utf-8")

    custom_repo = MechanicsRepository(yaml_path=temp_yaml)
    assert custom_repo.total_count == 1

    new_mech = MechanicDeepSpec(
        name="Квантовый скачок сквозь препятствия",
        role_in_loop="двигатель мобильности",
        player_decision="Телепортироваться сквозь лазерную решетку",
        why_unique="Использует фазовый сдвиг с физикой частиц",
        input_mapping="Двойной тап в направлении движения",
        feedback_layers=["Визуал: синее свечение", "Звук: квантовый щелчок"],
    )

    added = custom_repo.register_and_persist_mechanics([new_mech], genre="Экшен", renderer="threejs")
    assert added == 1
    assert custom_repo.total_count == 2

    # Проверка, что файл обновился
    saved_data = yaml.safe_load(temp_yaml.read_text(encoding="utf-8"))
    assert saved_data["total_mechanics"] == 2
    assert any("квантовый" in m.get("name", "").lower() for m in saved_data["mechanics"].values())

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
