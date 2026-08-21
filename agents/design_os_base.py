"""Общая обвязка для агентов слоя Design OS.

Слой Design OS обязан работать и без сети: локальный провайдер возвращает пустую
модель, поэтому каждый агент сначала строит детерминированную эвристическую
версию артефакта, а ответ ИИ использует как обогащение — и только если тот
действительно что-то содержит.
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
    """Запрашивает структурированный ответ, молча падая обратно на эвристику."""
    provider: Any = ctx.ai_provider
    if provider is None:
        return None
    try:
        result = provider.generate_structured(system_prompt, user_prompt, response_model)
    except Exception as exc:  # провайдер может быть недоступен — это не повод падать
        # Видимое предупреждение, а не строчка в общем потоке: без ответа модели
        # агент отдаёт нейтральную заготовку, и это надо заметить в логе, а не
        # обнаружить потом в документах.
        log_warning(
            f"[{agent_name}] Модель не ответила ({exc}). "
            f"Раздел собран локальной эвристикой — перезапустите его при рабочем провайдере."
        )
        return None
    if is_empty(result):
        return None
    return result


RU_SYSTEM_SUFFIX = (
    "\nТРЕБОВАНИЕ К ЯЗЫКУ: все текстовые поля — на русском языке. "
    "Идентификаторы (id, имена событий телеметрии) — ASCII в snake_case или вида A-01."
)
