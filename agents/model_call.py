"""Обвязка вызова модели: один структурированный запрос с повторами.

Модуль назывался design_os_base и лежал в слое Design OS — исторически он там и
появился. К моменту, когда слой убрали, через ask_model ходили уже все агенты
фабрики без исключения, так что имя врало о принадлежности.

Фабрика работает только онлайн: подставлять заготовку вместо ответа модели
нельзя — пакет тогда получается полный, валидный и не про эту игру. Но и ронять
прогон от единичной осечки незачем, поэтому вызов повторяется: сеть рвётся,
CLI-агент упирается в лимит, процесс убивают по таймауту — всё это обычно
лечится второй попыткой. Когда попытки кончились, прогон не падает, а
ПРИОСТАНАВЛИВАЕТСЯ (`RunPaused`): сделанное лежит в сессии, и продолжение идёт
со следующего шага, не переспрашивая модель о том, что она уже ответила.

Пустой ответ модели — это не обрыв связи, а плохой ответ: он отдаётся как None
(агент достраивает раздел сам), но громко пишется в лог.

Настройки повторов — переменными окружения:

    AGENT_RETRY_ATTEMPTS          сколько раз пробовать при ошибке (по умолчанию 3)
    AGENT_RETRY_BACKOFF_SECONDS   пауза перед второй попыткой, дальше удваивается
                                  (по умолчанию 4)
"""
import os
import time
from typing import Any, Optional, Type, TypeVar

from pydantic import BaseModel

from app.context import GenerationContext
from app.logging import log_agent, log_warning
from app.run_session import RunPaused


def _retry_attempts() -> int:
    """Число попыток при ошибке провайдера. 1 — повторов нет."""
    try:
        return max(1, int(os.getenv("AGENT_RETRY_ATTEMPTS", "3")))
    except ValueError:
        return 3


def _retry_backoff() -> float:
    """Пауза перед второй попыткой; каждая следующая — вдвое длиннее."""
    try:
        return max(0.0, float(os.getenv("AGENT_RETRY_BACKOFF_SECONDS", "4")))
    except ValueError:
        return 4.0


# Пустой ответ — не обрыв связи, поэтому переспрашиваем один раз и без паузы:
# ждать тут нечего, а гонять живой CLI-агент три раза ради пустоты дорого.
_EMPTY_ANSWER_ATTEMPTS = 2

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
    """Запрашивает структурированный ответ у живой модели, с повторами.

    Офлайн-режим отключён: подставлять заготовку вместо ответа нельзя. Но и
    ронять прогон от единичной осечки незачем — вызов повторяется, а когда
    попытки кончились, прогон приостанавливается и продолжается командой
    `continue`."""
    provider: Any = ctx.ai_provider
    session = getattr(ctx, "session", None)
    if provider is None:
        # Офлайн-ветка. Раньше здесь молча возвращался None, и агент собирал
        # раздел эвристикой — прогон без провайдера выглядел успешным.
        # if provider is None:
        #     return None
        raise RuntimeError(
            f"[{agent_name}] Провайдер не задан: фабрика работает только онлайн. "
            "Укажите провайдера (--provider / DEFAULT_PROVIDER)."
        )

    attempts = _retry_attempts()
    backoff = _retry_backoff()
    empty_seen = 0
    last_error: Optional[Exception] = None
    attempt = 0

    while attempt < attempts:
        attempt += 1
        try:
            result = provider.generate_structured(system_prompt, user_prompt, response_model)
        except Exception as exc:
            # Офлайн-ветка. Раньше ошибка провайдера гасилась предупреждением и
            # раздел собирался локальной эвристикой — в документах это было не
            # отличить от настоящего ответа модели.
            # log_warning(f"[{agent_name}] Модель не ответила ({exc}). ...")
            # return None
            last_error = exc
            if session is not None:
                session.log_call(agent_name, user_prompt, error=str(exc),
                                 attempt=attempt, attempts_total=attempts)
            if attempt < attempts:
                pause = backoff * (2 ** (attempt - 1))
                log_warning(
                    f"[{agent_name}] Провайдер не ответил ({exc}). "
                    f"Попытка {attempt} из {attempts}, повтор через {pause:.0f} с."
                )
                if pause:
                    time.sleep(pause)
                continue
            break

        if is_empty(result):
            # Это не офлайн: живой провайдер ответил, но ничего не наполнил.
            empty_seen += 1
            if session is not None:
                session.log_call(agent_name, user_prompt, answer="(пустой ответ)",
                                 attempt=attempt, attempts_total=attempts)
            if empty_seen < _EMPTY_ANSWER_ATTEMPTS and attempt < attempts:
                log_warning(f"[{agent_name}] Модель вернула пустой ответ — переспрашиваю.")
                continue
            log_warning(
                f"[{agent_name}] Модель вернула пустой ответ — раздел достроен эвристикой агента. "
                "Проверьте раздел в документах и при необходимости пересоберите его."
            )
            return None

        if session is not None:
            session.log_call(
                agent_name, user_prompt,
                answer=result.model_dump_json(indent=2, exclude_defaults=True),
                attempt=attempt, attempts_total=attempts,
            )
        if attempt > 1:
            log_agent(agent_name, f"Ответ получен со {attempt}-й попытки.")
        return result

    # Попытки кончились. Это не падение: всё сделанное уже в сессии.
    run_id = getattr(session, "run_id", "") if session is not None else ""
    hint = (
        f" Продолжить: python -m app.cli continue {run_id}"
        if run_id else
        " Запустите прогон заново при рабочем провайдере."
    )
    raise RunPaused(
        f"[{agent_name}] Провайдер не ответил за {attempts} попыт(ки/ок): {last_error}. "
        f"Прогон приостановлен, сделанное сохранено.{hint}",
        run_id=run_id,
        step=agent_name,
    )


RU_SYSTEM_SUFFIX = (
    "\nТРЕБОВАНИЕ К ЯЗЫКУ: все текстовые поля — на русском языке. "
    "Идентификаторы (id, имена событий телеметрии) — ASCII в snake_case или вида A-01."
)
