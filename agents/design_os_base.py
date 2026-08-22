"""Общая обвязка для агентов слоя Design OS.

РАНЬШЕ: слой обязан был работать и без сети. Локальный провайдер возвращал
пустую модель, ошибка провайдера гасилась предупреждением, и каждый агент
достраивал артефакт детерминированной эвристикой. Пакет собирался целиком и
выглядел успешным, хотя об этой конкретной игре не думал ни один агент.

СЕЙЧАС: фабрика работает только онлайн. Недоступный провайдер и упавший вызов
останавливают прогон с понятной ошибкой, а не подменяются заготовкой. Сами
эвристики в агентах не удалены — они просто становятся недостижимыми, пока
офлайн выключен, и переживут его возврат без правок.

Пустой ответ модели — это НЕ офлайн, а плохой ответ живого провайдера: он
по-прежнему отдаётся как None (агент достраивает раздел), но теперь громко
пишется в лог, а не проглатывается молча.
"""
from typing import Any, Optional, Type, TypeVar

from pydantic import BaseModel

from app.context import GenerationContext
from app.logging import log_agent, log_warning

T = TypeVar("T", bound=BaseModel)


def is_empty(model: Optional[BaseModel]) -> bool:
    """Модель считается пустой, если все поля равны значениям по умолчанию."""
    if model is None:
        return True
    empty = type(model)()
    return model.model_dump() == empty.model_dump()


def merge_filled(base: T, extra: Optional[T]) -> T:
    """Берёт поля из `extra`, если они заполнены; иначе оставляет значение из `base`."""
    if extra is None:
        return base
    empty = type(base)().model_dump()
    base_data = base.model_dump()
    extra_data = extra.model_dump()
    merged = dict(base_data)
    for key, value in extra_data.items():
        if value in (None, "", [], {}) or value == empty.get(key):
            continue
        merged[key] = value
    return type(base).model_validate(merged)


def ask_model(
    ctx: GenerationContext,
    agent_name: str,
    system_prompt: str,
    user_prompt: str,
    response_model: Type[T],
) -> Optional[T]:
    """Запрашивает структурированный ответ у живой модели.

    Офлайн-режим отключён: без провайдера и при упавшем вызове прогон
    останавливается, а не подменяется заготовкой."""
    provider: Any = ctx.ai_provider
    if provider is None:
        # Офлайн-ветка. Раньше здесь молча возвращался None, и агент собирал
        # раздел эвристикой — прогон без провайдера выглядел успешным.
        # if provider is None:
        #     return None
        raise RuntimeError(
            f"[{agent_name}] Провайдер не задан: фабрика работает только онлайн. "
            "Укажите провайдера (--provider / DEFAULT_PROVIDER)."
        )
    try:
        result = provider.generate_structured(system_prompt, user_prompt, response_model)
    except Exception as exc:
        # Офлайн-ветка. Раньше ошибка провайдера гасилась предупреждением и
        # раздел собирался локальной эвристикой — в документах это было не
        # отличить от настоящего ответа модели.
        # log_warning(
        #     f"[{agent_name}] Модель не ответила ({exc}). "
        #     f"Раздел собран локальной эвристикой — перезапустите его при рабочем провайдере."
        # )
        # return None
        log_warning(f"[{agent_name}] Модель не ответила ({exc}). Офлайн-подстраховка отключена.")
        raise RuntimeError(
            f"[{agent_name}] Провайдер не ответил: {exc}. "
            "Фабрика работает только онлайн — прогон остановлен, чтобы не выдать "
            "пакет, собранный заготовками."
        ) from exc
    if is_empty(result):
        # Это не офлайн: живой провайдер ответил, но ничего не наполнил. Раздел
        # достроит агент, а вот молчать об этом нельзя — раньше строчка уходила
        # в никуда, и пустой ответ был неотличим от нормального.
        log_warning(
            f"[{agent_name}] Модель вернула пустой ответ — раздел достроен эвристикой агента. "
            "Проверьте раздел в документах и при необходимости пересоберите его."
        )
        return None
    return result


RU_SYSTEM_SUFFIX = (
    "\nТРЕБОВАНИЕ К ЯЗЫКУ: все текстовые поля — на русском языке. "
    "Идентификаторы (id, имена событий телеметрии) — ASCII в snake_case или вида A-01."
)
