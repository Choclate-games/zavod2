"""
Проверка доступа к GitHub — одной кнопкой вместо трёх разборов по логам.

С GitHub у фабрики связаны три разные вещи, и связаны они по-разному:

* **база знаний** — репозиторий, из которого готовая игра тянет рецепты
  скриптом `scripts/fetch-knowledge.mjs` (`KNOWLEDGE_REPO`, `ZAVOD_KNOWLEDGE_TOKEN`);
* **тестер** — приватный `AI_Tester`, который фабрика клонирует себе перед
  первым прогоном на площадке (`GAMETEST_REPO`, `GAMETEST_TOKEN`);
* **мост площадки** — тарбол релиза форка Playgama Bridge, который ставится в
  каждую игру (`BRIDGE_PACKAGE_SOURCE`).

Токен у них формально свой у каждого, но на деле почти всегда один и тот же, и
берётся он по цепочке запасных вариантов. Из-за этого отказ выглядел одинаково
и невнятно: «клонирование тестера не удалось (код 128)» одинаково означает
опечатку в имени репозитория, отсутствующую ветку, протухший токен и токен без
доступа именно к этому репозиторию. Разбираться приходилось по очереди, и
каждая попытка стоила минуты.

Здесь тот же вопрос задаётся напрямую GitHub API и по частям: кто этот токен,
виден ли ему репозиторий, есть ли в нём такая ветка, существует ли такой релиз.
Ответ приходит строкой, которую видно в настройках.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List
from urllib.parse import quote

API = "https://api.github.com"
TIMEOUT = 20


def _get(path: str, token: str) -> tuple[int, dict]:
    """Запрос к API. Возвращает код ответа и тело (пустое — если не JSON)."""
    # Заголовок HTTP не бывает не-ASCII, и токен GitHub тоже. Без этой проверки
    # такой токен доходил до отправки и валился внутри http.client сообщением
    # «'latin-1' codec can't encode characters in position 11-23», которое
    # выглядит как отказ сети, а означает опечатку в поле ввода.
    if token and not token.isascii():
        return 0, {"message": "в токене есть символы, которых в нём быть не может "
                              "(кириллица, кавычки, перенос строки) — скопируйте его заново"}
    request = urllib.request.Request(f"{API}{path}")
    request.add_header("Accept", "application/vnd.github+json")
    request.add_header("X-GitHub-Api-Version", "2022-11-28")
    # User-Agent обязателен: без него GitHub отвечает 403 всем подряд.
    request.add_header("User-Agent", "zavod2-factory")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            body = response.read().decode("utf-8", "replace")
            status = response.status
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read().decode("utf-8", "replace")
        except Exception:  # noqa: BLE001 — тело ошибки необязательно
            body = ""
        status = exc.code
    except (urllib.error.URLError, OSError, ValueError) as exc:
        return 0, {"message": f"сеть не ответила: {exc}"}
    try:
        data = json.loads(body) if body else {}
    except ValueError:
        data = {}
    return status, data if isinstance(data, dict) else {"items": data}


def _reason(status: int, data: dict, what: str) -> str:
    """Отказ человеческими словами. Коды GitHub тут врут в одну сторону.

    404 на приватном репозитории означает не «нет такого», а «этому токену его
    не видно»: GitHub намеренно не подтверждает существование приватных
    репозиториев. Писать «репозиторий не найден» — отправлять человека искать
    опечатку там, где на самом деле не хватает прав.
    """
    if status == 0:
        return str(data.get("message") or "сеть не ответила")
    if status == 401:
        return "токен не принят — он протух или скопирован не целиком"
    if status == 403:
        message = str(data.get("message") or "")
        if "rate limit" in message.lower():
            return "GitHub упёрся в лимит запросов — без токена он низкий"
        return f"доступ запрещён: {message or 'токену не хватает прав'}"
    if status == 404:
        return f"{what} не виден этому токену — либо опечатка, либо у токена нет к нему доступа"
    if status >= 400:
        return f"GitHub ответил {status}: {data.get('message') or 'ошибка запроса'}"
    return ""


def identity(token: str) -> Dict[str, object]:
    """Чей это токен. Пустой токен — не ошибка: публичное читается и без него."""
    if not token:
        return {"ok": False, "anonymous": True,
                "message": "токена нет — доступно только то, что открыто всем"}
    status, data = _get("/user", token)
    if status == 200:
        return {"ok": True, "login": str(data.get("login") or ""), "message": ""}
    # Fine-grained токен без доступа к профилю — рабочий, просто /user ему закрыт.
    if status == 403 and "user" in str(data.get("message") or "").lower():
        return {"ok": True, "login": "", "message": "токен рабочий, но профиль ему не показывают"}
    return {"ok": False, "message": _reason(status, data, "профиль токена")}


def repo(slug: str, ref: str, token: str, title: str) -> Dict[str, object]:
    """Виден ли репозиторий и есть ли в нём такая ветка."""
    slug = (slug or "").strip().strip("/")
    result: Dict[str, object] = {"title": title, "repo": slug, "ref": ref, "ok": False}
    if not slug:
        result["message"] = "репозиторий не задан"
        return result
    if slug.count("/") != 1:
        result["message"] = "нужен вид «владелец/репозиторий»"
        return result

    status, data = _get(f"/repos/{slug}", token)
    if status != 200:
        result["message"] = _reason(status, data, f"репозиторий {slug}")
        return result
    result["private"] = bool(data.get("private"))
    result["default_branch"] = str(data.get("default_branch") or "")

    if not ref:
        result["ok"] = True
        result["message"] = ""
        return result

    # Ветка и тег живут в разных разделах API, а в настройках это одно поле.
    for kind in ("branches", "tags"):
        code, body = _get(f"/repos/{slug}/{kind}/{quote(ref, safe='')}", token)
        if code == 200:
            result["ok"] = True
            result["message"] = ""
            return result
        if code in (401, 403):
            result["message"] = _reason(code, body, f"ветка {ref}")
            return result
    result["message"] = (f"ветки или тега «{ref}» в репозитории нет"
                         + (f" — по умолчанию там «{result['default_branch']}»"
                            if result.get("default_branch") else ""))
    return result


def release(slug: str, tag: str, token: str, title: str) -> Dict[str, object]:
    """Существует ли релиз, из которого игры ставят мост площадки."""
    slug = (slug or "").strip().strip("/")
    result: Dict[str, object] = {"title": title, "repo": slug, "ref": tag, "ok": False}
    if not slug or not tag:
        result["message"] = "релиз не задан"
        return result
    status, data = _get(f"/repos/{slug}/releases/tags/{quote(tag, safe='')}", token)
    if status != 200:
        result["message"] = _reason(status, data, f"релиз {tag}")
        return result
    result["ok"] = True
    result["message"] = ""
    return result


def check(targets: List[Dict[str, str]], token: str) -> Dict[str, object]:
    """Проверяет все три адреса разом и отвечает так, как это показывают в вебе.

    Запросы идут параллельно. Последовательно их выходит до десяти (репозиторий,
    затем ветка, затем тег — у каждого адреса свои), и кнопка «Проверить доступ»
    думала бы дольше, чем занимает сама починка.
    """
    def one(target: Dict[str, str]) -> Dict[str, object]:
        own = (target.get("token") or "").strip() or token
        call = release if target.get("kind") == "release" else repo
        return call(target.get("repo", ""), target.get("ref", ""), own, target.get("title", ""))

    with ThreadPoolExecutor(max_workers=max(1, len(targets) + 1)) as pool:
        who_task = pool.submit(identity, token)
        # Порядок ответов — порядок карточек на вкладке, а не порядок ответов сети.
        checks = list(pool.map(one, targets))
        who = who_task.result()

    return {
        "ok": all(bool(item.get("ok")) for item in checks),
        "identity": who,
        "checks": checks,
    }
