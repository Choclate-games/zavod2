"""
HTTP-слой веб-фабрики (FastAPI).

Роуты тонкие: разбирают запрос, зовут `app.web.service` и возвращают JSON.
Живые события (журнал студии, лента чата, вывод dev-сервера) уходят в браузер
одним потоком Server-Sent Events на `/api/events`.
"""

from __future__ import annotations

import asyncio
import codecs
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import (
    FileResponse, HTMLResponse, JSONResponse, RedirectResponse, Response, StreamingResponse,
)
from fastapi.staticfiles import StaticFiles

from app import sandbox
from app.web import auth, terminals
from app.web.bus import bus
from app.web.service import AGENT_KEYS, DEMO_SLUG, service

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="AI Game Factory", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Настройки входа читаются один раз на старте. Если они кривые, AuthError
# поднимается здесь же и uvicorn не поднимется — лучше не запуститься, чем
# запуститься открытым наружу.
#
# load_settings, а не from_env: действующий пароль лежит в таблице `users`,
# .env остаётся аварийной копией на случай недоступной базы. Объект дальше
# меняется на месте при смене пароля — middleware читает его на каждом
# запросе, поэтому новый пароль действует сразу, без перезапуска.
AUTH = auth.load_settings()

# Единственные адреса, доступные без входа. Всё остальное — включая /static
# и весь /api — закрыто. Страница входа самодостаточна и своих ассетов не
# просит, поэтому дырку под них делать не нужно.
_PUBLIC_PATHS = frozenset({"/login", "/api/login", "/api/logout", "/healthz", "/favicon.ico"})


def _client_ip(request: Request) -> str:
    """
    Адрес клиента для счётчика неудачных входов.

    X-Forwarded-For доверяем только когда фабрика заведомо стоит за своим
    nginx (AUTH_TRUST_PROXY=1). Иначе заголовок подделывается кем угодно и
    лимит перебора обходится одной строкой.
    """
    if os.getenv("AUTH_TRUST_PROXY", "").strip().lower() in ("1", "true", "yes", "on"):
        forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        if forwarded:
            return forwarded
    return request.client.host if request.client else "?"


@app.middleware("http")
async def require_login(request: Request, call_next):
    """
    Проверка сессии перед каждым запросом.

    Сделано middleware, а не зависимостью на роутах: роутов уже под сотню, и
    любой забытый `Depends` — это открытая ручка. Здесь закрыто по умолчанию,
    а исключения перечислены явно и списком.
    """
    if not AUTH.enabled:
        return await call_next(request)

    path = request.url.path
    if path in _PUBLIC_PATHS:
        return await call_next(request)

    token = request.cookies.get(auth.COOKIE_NAME) or ""
    if token and auth.read_token(token, AUTH.password_hash):
        return await call_next(request)

    if path.startswith("/api/"):
        return JSONResponse(
            {"status": "error", "auth": "required", "message": "Требуется вход."},
            status_code=401,
        )

    target = request.url.path
    if request.url.query:
        target = f"{target}?{request.url.query}"
    return RedirectResponse(f"/login?next={quote(target, safe='')}", status_code=302)


@app.get("/healthz")
def healthz() -> Dict[str, Any]:
    """Проба для Docker HEALTHCHECK. Намеренно ничего не рассказывает о себе."""
    return {"status": "ok"}


@app.get("/login", response_class=HTMLResponse)
def login_page() -> HTMLResponse:
    if not AUTH.enabled:
        return HTMLResponse('<meta http-equiv="refresh" content="0; url=/">')
    return HTMLResponse(
        (STATIC_DIR / "login.html").read_text(encoding="utf-8"),
        headers={"Cache-Control": "no-store"},
    )


@app.post("/api/login")
async def login(request: Request) -> Response:
    if not AUTH.enabled:
        return JSONResponse({"status": "ok"})

    ip = _client_ip(request)
    wait = auth.attempts.blocked_for(ip)
    if wait:
        return JSONResponse(
            {"status": "error",
             "message": f"Слишком много попыток. Повторите через {wait // 60 + 1} мин."},
            status_code=429,
        )

    payload = await _body(request)
    username = str(payload.get("username") or "")
    password = str(payload.get("password") or "")

    if not auth.check_credentials(AUTH, username, password):
        auth.attempts.fail(ip)
        return JSONResponse(
            {"status": "error", "message": "Неверный логин или пароль."},
            status_code=401,
        )

    auth.attempts.reset(ip)
    token = auth.issue_token(AUTH.username, AUTH.password_hash, AUTH.ttl_seconds)
    response = JSONResponse({"status": "ok"})
    response.set_cookie(
        auth.COOKIE_NAME, token,
        max_age=AUTH.ttl_seconds,
        httponly=True,
        samesite="lax",
        path="/",
        # Secure не ставим: фабрика отдаётся по http внутри VPN, и с этим
        # флагом браузер просто не сохранил бы куку.
        secure=False,
    )
    return response


@app.post("/api/logout")
def logout() -> Response:
    response = JSONResponse({"status": "ok"})
    response.delete_cookie(auth.COOKIE_NAME, path="/")
    return response


# ── Служебное ───────────────────────────────────────────────────────────────

def _slug(slug: str) -> str:
    try:
        sandbox.project_dir(slug)
    except sandbox.SandboxViolation as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return slug


async def _body(request: Request) -> Dict[str, Any]:
    try:
        data = await request.json()
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _stamped(html: str) -> str:
    """Дописывает к ссылкам на стили и скрипт версию по времени файла.

    Без штампа браузер оставляет у себя старый `styles.css`: HTML отдаётся
    заново каждым запросом, а вот CSS живёт в кэше, и новая разметка от
    `app.js` раскладывается по правилам, которых в этом CSS ещё нет. Именно
    так обложки уезжали в натуральные 1280 пикселей мимо колонки — JS уже
    рисовал `.cover16`, а стилей для него в браузере не было."""
    for asset in ("styles.css", "app.js"):
        path = STATIC_DIR / asset
        version = int(path.stat().st_mtime) if path.exists() else 0
        html = html.replace(f"/static/{asset}", f"/static/{asset}?v={version}")
    return html


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    return HTMLResponse(_stamped((STATIC_DIR / "index.html").read_text(encoding="utf-8")))


@app.get("/play", response_class=HTMLResponse)
def play_view() -> HTMLResponse:
    """
    Обёртка вокруг игры: сама игра в iframe, сверху полоска с пресетами
    размера вьюпорта. Открывается как /play?url=<адрес игры>&slug=<проект>.
    """
    return HTMLResponse((STATIC_DIR / "play.html").read_text(encoding="utf-8"))


@app.get("/api/bootstrap")
def bootstrap() -> Dict[str, Any]:
    payload = service.bootstrap()
    # Кнопка «Выйти» бессмысленна, когда вход выключен (локальный запуск на
    # 127.0.0.1), поэтому её показывает только этот флаг.
    payload["auth_enabled"] = AUTH.enabled
    return payload


@app.get("/api/events")
async def events(request: Request) -> StreamingResponse:
    """Единый поток событий: журнал, прогресс, чаты, dev-сервер."""
    subscriber = bus.subscribe()

    async def stream():
        try:
            yield "retry: 2000\n\n"
            idle = 0.0
            while True:
                if await request.is_disconnected():
                    break
                batch = subscriber.drain()
                if batch:
                    idle = 0.0
                    for event in batch:
                        yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                else:
                    idle += 0.1
                    if idle >= 15:
                        idle = 0.0
                        yield ": ping\n\n"
                    await asyncio.sleep(0.1)
        finally:
            bus.unsubscribe(subscriber)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


# ── Студия ──────────────────────────────────────────────────────────────────

@app.get("/api/studio/state")
def studio_state() -> Dict[str, Any]:
    return service.studio_state()


@app.post("/api/studio/generate")
async def studio_generate(request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    kind = payload.get("kind", "spec")
    if kind == "full":
        return service.start_full_game(payload)
    return service.start_spec_generation(payload)


@app.post("/api/studio/batch")
async def studio_batch(request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    return service.start_batch_generation(payload.get("ideas") or [], payload)


@app.post("/api/studio/analyze")
async def studio_analyze(request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    prompt = (payload.get("prompt") or "").strip()
    if not prompt:
        return {"status": "error", "message": "Поле идеи игры не должно быть пустым."}
    try:
        result = service.analyze_idea(prompt, payload.get("provider") or "agy")
        return {"status": "success", "concept": result}
    except Exception as exc:
        service.append_log(f"❌ Ошибка анализа: {exc}")
        return {"status": "error", "message": str(exc)}


@app.post("/api/studio/stop")
def studio_stop() -> Dict[str, Any]:
    """Остановить все прогоны студии разом."""
    service.stop_generation()
    return {"status": "success"}


@app.get("/api/studio/jobs")
def studio_jobs() -> Dict[str, Any]:
    """Карточки прогонов: сколько идей делается прямо сейчас."""
    return {"jobs": service.studio_jobs.snapshots(),
            "max_parallel": service.studio_jobs.max_parallel}


@app.get("/api/studio/jobs/{job_id}")
def studio_job(job_id: str) -> Dict[str, Any]:
    return service.job_state(job_id)


@app.post("/api/studio/jobs/{job_id}/stop")
def studio_job_stop(job_id: str) -> Dict[str, Any]:
    return service.stop_job(job_id)


@app.post("/api/studio/jobs/{job_id}/close")
def studio_job_close(job_id: str) -> Dict[str, Any]:
    return service.close_job(job_id)


@app.post("/api/studio/jobs/close-finished")
def studio_jobs_close_finished() -> Dict[str, Any]:
    return service.close_finished_jobs()


@app.post("/api/studio/logs/clear")
async def studio_clear_logs(request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    service.clear_logs(payload.get("job_id"))
    return {"status": "success"}


@app.post("/api/brainstorm")
async def brainstorm(request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    try:
        ideas = service.brainstorm(
            provider=payload.get("provider") or "agy",
            hint=payload.get("hint") or "",
            count=int(payload.get("count") or 10),
        )
        return {"status": "success", "ideas": ideas}
    except Exception as exc:
        return {"status": "error", "message": str(exc), "ideas": []}


# ── Прогоны ─────────────────────────────────────────────────────────────────
#
# Прогон — это один запуск пайплайна спецификаций: его чат с моделью, снимок
# концепции и статусы шагов. Приостановленный прогон продолжается отсюда же.

@app.get("/api/runs")
def list_runs() -> Dict[str, Any]:
    return {"runs": service.list_runs()}


@app.get("/api/runs/{run_id}")
def run_chat(run_id: str) -> Dict[str, Any]:
    return service.run_chat(run_id)


@app.post("/api/runs/{run_id}/continue")
async def run_continue(run_id: str, request: Request) -> Dict[str, Any]:
    opts = {}
    try:
        opts = await request.json()
    except Exception:
        pass
    return service.continue_run(run_id, opts or {})


# ── Проекты ─────────────────────────────────────────────────────────────────

@app.get("/api/projects")
def list_projects() -> Dict[str, Any]:
    return {"projects": service.list_projects()}


@app.get("/api/projects/{slug}")
def project_detail(slug: str) -> Dict[str, Any]:
    return service.project_detail(_slug(slug))


@app.delete("/api/projects/{slug}")
def project_delete(slug: str) -> Dict[str, Any]:
    return service.delete_project(_slug(slug))


@app.post("/api/projects/{slug}/rating")
async def project_rating(slug: str, request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    try:
        rating = int(payload.get("rating", 0))
    except (TypeError, ValueError):
        return {"status": "error", "message": "Оценка должна быть числом 0–5."}
    return service.set_project_rating(_slug(slug), rating)


@app.post("/api/projects/{slug}/rename")
async def project_rename(slug: str, request: Request) -> Dict[str, Any]:
    """Новое имя игры. Пустая строка возвращает название из спецификации."""
    payload = await _body(request)
    return service.rename_project(_slug(slug), str(payload.get("title") or ""))


@app.post("/api/projects/{slug}/gate")
async def project_gate(slug: str, request: Request) -> Dict[str, Any]:
    """Прогон приёмки по требованию: сборка, статика и запуск в браузере."""
    payload = await _body(request)
    return service.start_gate(_slug(slug), payload)


@app.post("/api/projects/{slug}/favorite")
async def project_favorite(slug: str, request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    return service.set_project_favorite(_slug(slug), bool(payload.get("favorite", True)))


@app.post("/api/projects/{slug}/archive")
async def project_archive(slug: str, request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    return service.set_project_archived(_slug(slug), bool(payload.get("archived", True)))


@app.get("/api/projects/{slug}/doc")
def project_doc(slug: str, name: str = "AI_DEVELOPER_PROMPT.md") -> Dict[str, Any]:
    return service.read_doc(_slug(slug), name)


@app.get("/api/projects/{slug}/preview.png")
def project_preview(slug: str):
    # Отдаём байтами, а не FileResponse: у упакованной игры превью лежит
    # внутри zip, и файла на диске для него нет.
    data = service.preview_image_bytes(_slug(slug))
    if not data:
        raise HTTPException(status_code=404, detail="Превью не найдено")
    # URL несёт версию через ?v=preview_mtime — при пересборке превью адрес
    # меняется сам, поэтому старую картинку можно кешировать бессрочно.
    return Response(content=data, media_type="image/png",
                     headers={"Cache-Control": "public, max-age=31536000, immutable"})


@app.post("/api/projects/{slug}/preview")
def project_generate_preview(slug: str) -> Dict[str, Any]:
    try:
        return service.generate_preview(_slug(slug))
    except Exception as exc:
        return {"status": "error", "message": f"❌ Не вышло: {exc}"}


@app.post("/api/projects/{slug}/validate")
def project_validate(slug: str) -> Dict[str, Any]:
    try:
        return service.validate_project(_slug(slug))
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.post("/api/projects/{slug}/rebuild")
async def project_rebuild(slug: str, request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    section = payload.get("section")
    if not section:
        return {"status": "error", "message": "Не указана секция."}
    try:
        return service.rebuild_section(_slug(slug), section)
    except Exception as exc:
        return {"status": "error", "message": f"❌ Ошибка: {exc}"}


@app.get("/api/projects/{slug}/export")
def project_export(slug: str):
    path = service.export_zip(_slug(slug))
    return FileResponse(path, media_type="application/zip", filename=path.name)


@app.post("/api/projects/{slug}/open-folder")
def project_open_folder(slug: str) -> Dict[str, Any]:
    # Открыть в проводнике можно только настоящую папку — упакованную игру
    # для этого разворачиваем.
    return service.open_folder(service.live_dir(_slug(slug)))


@app.post("/api/open-workspace")
def open_workspace() -> Dict[str, Any]:
    return service.open_folder(sandbox.workspace_root())


@app.get("/api/projects/{slug}/continue-prompt")
def project_continue_prompt(slug: str) -> Dict[str, Any]:
    return {"prompt": service.continue_prompt(_slug(slug))}


# ── Хранилище: архивы игр и общий стор node-пакетов ─────────────────────────

@app.get("/api/storage")
def storage_state() -> Dict[str, Any]:
    return service.storage_state()


@app.post("/api/storage/sweep")
def storage_sweep() -> Dict[str, Any]:
    return service.sweep_storage()


@app.post("/api/storage/prune")
def storage_prune() -> Dict[str, Any]:
    return service.prune_packages()


@app.post("/api/storage/snapshots/clean")
def storage_snapshots_clean() -> Dict[str, Any]:
    return service.clean_snapshots()


@app.post("/api/projects/{slug}/pack")
def project_pack(slug: str) -> Dict[str, Any]:
    return service.pack_project(_slug(slug))


@app.post("/api/projects/{slug}/unpack")
def project_unpack(slug: str) -> Dict[str, Any]:
    return service.unpack_project(_slug(slug))


# ── Чаты ────────────────────────────────────────────────────────────────────

@app.get("/api/chats/{slug}")
def chats_list(slug: str) -> Dict[str, Any]:
    return {"sessions": service.list_chats(_slug(slug))}


@app.post("/api/chats/{slug}")
def chats_create(slug: str) -> Dict[str, Any]:
    return {"status": "success", "session": service.create_chat(_slug(slug))}


@app.get("/api/chats/{slug}/{session_id}")
def chats_open(slug: str, session_id: str) -> Dict[str, Any]:
    return service.open_chat(_slug(slug), session_id)


@app.delete("/api/chats/{slug}/{session_id}")
def chats_delete(slug: str, session_id: str) -> Dict[str, Any]:
    return service.delete_chat(_slug(slug), session_id)


@app.post("/api/chats/{slug}/send")
async def chats_send(slug: str, request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    agent = payload.get("agent") or service.default_agent()
    if agent not in AGENT_KEYS:
        return {"status": "error", "message": f"Неизвестный агент: {agent}"}
    model = (payload.get("model") or "").strip() or None
    attachments = payload.get("attachments")
    return service.send_chat_task(
        _slug(slug),
        payload.get("session_id"),
        payload.get("prompt") or "",
        agent_key=agent,
        model=model,
        yolo=bool(payload.get("yolo", True)),
        continue_dialog=bool(payload.get("continue_dialog", True)),
        attachments=attachments if isinstance(attachments, list) else None,
    )


@app.post("/api/chats/{slug}/{session_id}/stop")
def chats_stop(slug: str, session_id: str) -> Dict[str, Any]:
    return service.stop_chat(session_id)


@app.get("/api/chats/{slug}/{session_id}/undo")
def chats_undo_info(slug: str, session_id: str, index: Optional[int] = None) -> Dict[str, Any]:
    """Что уберёт откат — для окна подтверждения. `index` — запрос в ленте."""
    return service.undo_info(_slug(slug), session_id, index)


@app.post("/api/chats/{slug}/{session_id}/undo")
def chats_undo(slug: str, session_id: str, index: Optional[int] = None) -> Dict[str, Any]:
    return service.undo_last_chat_task(_slug(slug), session_id, index)


@app.get("/api/chats-running")
def chats_running() -> Dict[str, Any]:
    return {"running": service.running_chats()}


@app.get("/api/activity")
def activity() -> Dict[str, Any]:
    """Панель активности сайдбара: работающие/недавно завершённые чаты и живые dev-серверы."""
    return service.activity()


@app.delete("/api/activity/{session_id}")
def activity_dismiss(session_id: str) -> Dict[str, Any]:
    """Убрать одну тему из панели активности (сам чат остаётся)."""
    return service.dismiss_activity(session_id)


@app.post("/api/activity/clear")
def activity_clear() -> Dict[str, Any]:
    return service.clear_activity()


# ── Вложения заказа (прогон) ────────────────────────────────────────────────
#
# Отдельные роуты от чатовых: у заказа ещё нет проекта, поэтому нет и слага.
# Файлы ждут в предбаннике песочницы и копируются в игру на старте прогона.

@app.get("/api/studio/uploads")
def studio_uploads_list() -> Dict[str, Any]:
    return service.list_studio_uploads()


@app.post("/api/studio/uploads")
async def studio_uploads_save(request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    return service.save_studio_upload(
        str(payload.get("name") or "attachment"),
        str(payload.get("data") or ""),
    )


@app.get("/api/studio/uploads/file/{name}")
def studio_uploads_file(name: str):
    path = service.studio_upload_path(name)
    if not path:
        raise HTTPException(status_code=404, detail="Вложение не найдено")
    return FileResponse(path)


@app.delete("/api/studio/uploads/file/{name}")
def studio_uploads_delete(name: str) -> Dict[str, Any]:
    return service.delete_studio_upload(name)


# ── Вложения чата ───────────────────────────────────────────────────────────

@app.get("/api/uploads/{slug}")
def uploads_list(slug: str) -> Dict[str, Any]:
    return service.list_uploads(_slug(slug))


@app.post("/api/uploads/{slug}")
async def uploads_save(slug: str, request: Request) -> Dict[str, Any]:
    """
    Приём файла или скриншота.

    Содержимое приходит data-URL'ом в JSON — так вложение долетает обычным
    fetch-запросом, без multipart и без лишней зависимости в requirements.
    """
    payload = await _body(request)
    return service.save_upload(
        _slug(slug),
        str(payload.get("name") or "attachment"),
        str(payload.get("data") or ""),
    )


@app.get("/api/uploads/{slug}/file/{name}")
def uploads_file(slug: str, name: str):
    path = service.upload_path(_slug(slug), name)
    if not path:
        raise HTTPException(status_code=404, detail="Вложение не найдено")
    return FileResponse(path)


@app.delete("/api/uploads/{slug}/file/{name}")
def uploads_delete(slug: str, name: str) -> Dict[str, Any]:
    return service.delete_upload(_slug(slug), name)


# ── Озвучка: Fish Audio TTS (только по действию пользователя) ───────────────

@app.get("/api/tts")
def tts_state() -> Dict[str, Any]:
    return service.tts_state()


@app.get("/api/tts/voices")
def tts_voices(query: str = "", limit: int = 24) -> Dict[str, Any]:
    return service.tts_voices(query, limit)


@app.post("/api/tts/test")
def tts_test() -> Dict[str, Any]:
    return service.tts_test()


@app.get("/api/tts/{slug}/files")
def tts_files(slug: str) -> Dict[str, Any]:
    return {"files": service.tts_files(_slug(slug))}


@app.post("/api/tts/{slug}/generate")
async def tts_generate(slug: str, request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    return service.tts_generate(
        _slug(slug),
        str(payload.get("text") or ""),
        voice_id=str(payload.get("voice_id") or ""),
        name=str(payload.get("name") or ""),
        fmt=str(payload.get("format") or "mp3"),
    )


@app.get("/api/tts/{slug}/file/{name}")
def tts_file(slug: str, name: str):
    path = service.tts_file_path(_slug(slug), name)
    if not path:
        raise HTTPException(status_code=404, detail="Файл не найден")
    return FileResponse(path)


@app.delete("/api/tts/{slug}/file/{name}")
def tts_file_delete(slug: str, name: str) -> Dict[str, Any]:
    return service.tts_delete(_slug(slug), name)


# ── Агенты ──────────────────────────────────────────────────────────────────

@app.get("/api/agents/{key}/models")
def agent_models(key: str) -> Dict[str, Any]:
    if key not in AGENT_KEYS:
        raise HTTPException(status_code=404, detail="Неизвестный агент")
    return service.list_agent_models(key)


@app.post("/api/agents/{key}/test")
async def agent_test(key: str, request: Request) -> Dict[str, Any]:
    if key not in AGENT_KEYS:
        raise HTTPException(status_code=404, detail="Неизвестный агент")
    payload = await _body(request)
    return service.test_agent(
        key,
        cli_path=(payload.get("cli_path") or "").strip() or None,
        model=(payload.get("model") or "").strip() or None,
        effort=(payload.get("effort") or "").strip() or None,
    )


@app.post("/api/agents/{key}/terminal")
async def agent_terminal(key: str, request: Request) -> Dict[str, Any]:
    if key not in AGENT_KEYS:
        raise HTTPException(status_code=404, detail="Неизвестный агент")
    payload = await _body(request)
    return service.launch_terminal(
        key,
        slug=payload.get("slug"),
        prompt=payload.get("prompt"),
        yolo=bool(payload.get("yolo", True)),
        bare=bool(payload.get("bare", False)),
        model=(payload.get("model") or "").strip() or None,
    )


# ── Игра ────────────────────────────────────────────────────────────────────

@app.get("/api/play")
def play_servers() -> Dict[str, Any]:
    """Менеджер запущенных игр: занятые порты по проектам."""
    return {"servers": service.running_servers()}


@app.post("/api/play/stop-all")
def play_stop_all() -> Dict[str, Any]:
    return service.stop_all_play()


@app.get("/api/play/{slug}")
def play_state(slug: str) -> Dict[str, Any]:
    return service.play_state(_slug(slug))


@app.post("/api/play/{slug}/start")
def play_start(slug: str) -> Dict[str, Any]:
    return service.start_play(_slug(slug))


@app.post("/api/play/{slug}/stop")
def play_stop(slug: str) -> Dict[str, Any]:
    return service.stop_play(_slug(slug))


@app.post("/api/play/{slug}/build")
def play_build(slug: str) -> Dict[str, Any]:
    return service.build_play(_slug(slug))


@app.post("/api/play/{slug}/build-zip")
def play_build_zip(slug: str):
    """
    Собрать игру и сразу отдать ZIP на скачивание.

    Роут синхронный (FastAPI выполнит его в пуле потоков): браузер держит запрос
    до конца сборки, а ход сборки видно в логе вкладки «Игра».
    """
    try:
        path = service.build_zip(_slug(slug))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return FileResponse(path, media_type="application/zip", filename=path.name)


@app.post("/api/play/{slug}/window")
async def play_window(slug: str, request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    state = service.play_state(_slug(slug))
    return service.open_preview_window(slug, payload.get("url") or state.get("url") or "")


# ── Демо-стенд базы знаний ──────────────────────────────────────────────────
#
# Стенд — не игра студии, поэтому у него свои роуты и своя кнопка в интерфейсе:
# в списке проектов его карточку путали с выпущенной игрой.

@app.get("/api/demo")
def demo_state() -> Dict[str, Any]:
    return service.demo_state()


@app.post("/api/demo/start")
def demo_start() -> Dict[str, Any]:
    return service.start_demo()


@app.post("/api/demo/stop")
def demo_stop() -> Dict[str, Any]:
    return service.stop_demo()


@app.post("/api/demo/open-folder")
def demo_open_folder() -> Dict[str, Any]:
    return service.open_folder(sandbox.project_dir(DEMO_SLUG))


# ── Квоты ───────────────────────────────────────────────────────────────────

@app.get("/api/quota")
def quota() -> Dict[str, Any]:
    return service.quota_payload()


@app.get("/api/usage")
def usage() -> Dict[str, Any]:
    """Расход токенов: итог по фабрике и разбивка по проектам."""
    return service.usage_payload()


@app.post("/api/quota/{key}/terminal")
def quota_terminal(key: str) -> Dict[str, Any]:
    if key not in AGENT_KEYS:
        raise HTTPException(status_code=404, detail="Неизвестный агент")
    return service.launch_terminal(key, bare=False)


# ── Настройки ───────────────────────────────────────────────────────────────

@app.get("/api/settings")
def get_settings() -> Dict[str, Any]:
    return service.settings_payload()


@app.post("/api/settings")
async def save_settings(request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    try:
        return service.save_settings(payload)
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.post("/api/settings/notifications")
async def set_notifications(request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    return service.set_notifications(bool(payload.get("enabled", True)))


@app.post("/api/settings/default-agent")
async def set_default_agent(request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    return service.set_default_agent(payload.get("agent") or "")


# -- Смена пароля ------------------------------------------------------------

@app.post("/api/settings/password")
async def change_password(request: Request):
    """
    Смена пароля входа.

    Меняет объект AUTH на месте, поэтому новый пароль действует сразу, без
    перезапуска контейнера. Все ранее выданные куки при этом перестают
    приниматься — ключ подписи выводится из хеша пароля. Себя разлогинивать
    незачем, поэтому в ответ кладём свежую куку, подписанную новым хешем.
    """
    payload = await _body(request)
    ok, message = auth.change_password(
        AUTH,
        str(payload.get("current") or ""),
        str(payload.get("new") or ""),
    )
    if not ok:
        return {"status": "error", "message": message}
    response = JSONResponse({"status": "success", "message": message})
    response.set_cookie(
        auth.COOKIE_NAME,
        auth.issue_token(AUTH.username, AUTH.password_hash, AUTH.ttl_seconds),
        max_age=AUTH.ttl_seconds, httponly=True, samesite="lax", secure=False,
    )
    return response


# -- Состояние машины --------------------------------------------------------

@app.get("/api/system")
def system_state() -> Dict[str, Any]:
    data = service.system_payload()
    data.setdefault("factory", {})["terminals"] = len(terminals.registry.list())
    return data


# -- База данных -------------------------------------------------------------

@app.get("/api/settings/database")
def database_state() -> Dict[str, Any]:
    return service.database_payload()


@app.post("/api/settings/database")
async def database_save(request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    return service.save_database(payload)


# -- Архивы игр --------------------------------------------------------------

@app.get("/api/builds")
def builds_list(slug: str = "", limit: int = 50) -> Dict[str, Any]:
    return service.builds_payload(_slug(slug) if slug else "", limit)


@app.post("/api/projects/{slug}/snapshot")
def build_snapshot(slug: str) -> Dict[str, Any]:
    result = service.capture_build(_slug(slug), reason="manual")
    if not result:
        return {"status": "error",
                "message": "Каталог игры не найден или архивы выключены."}
    return {"status": "success", "build": result,
            "message": f"Архив {result['filename']} готов."}


@app.get("/api/builds/{build_id}/download")
def build_download(build_id: int):
    path, data, name = service.build_download(build_id)
    if path is not None:
        return FileResponse(path, media_type="application/zip", filename=name)
    if data is not None:
        return Response(
            content=data, media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="' + name + '"'},
        )
    raise HTTPException(status_code=404, detail="Архив не найден ни на диске, ни в базе")


@app.delete("/api/builds/{build_id}")
def build_delete(build_id: int) -> Dict[str, Any]:
    return service.delete_build(build_id)


# -- Терминалы агентов -------------------------------------------------------

@app.get("/api/terminals")
def terminals_list() -> Dict[str, Any]:
    return {
        "available": terminals.registry.available(),
        "launchers": terminals.launchers(),
        "sessions": terminals.registry.list(),
    }


@app.post("/api/terminals")
async def terminals_start(request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    try:
        session = terminals.registry.start(
            str(payload.get("key") or ""),
            rows=int(payload.get("rows") or 30),
            cols=int(payload.get("cols") or 100),
        )
    except terminals.TerminalError as exc:
        return {"status": "error", "message": str(exc)}
    return {"status": "success", "session": session.snapshot()}


@app.delete("/api/terminals/{session_id}")
def terminals_close(session_id: str) -> Dict[str, Any]:
    ok = terminals.registry.close(session_id)
    return {"status": "success" if ok else "error",
            "message": "Терминал закрыт." if ok else "Терминал уже закрыт."}


@app.websocket("/api/terminals/{session_id}/ws")
async def terminals_stream(websocket: WebSocket, session_id: str) -> None:
    """
    Двусторонний поток терминала.

    Вход проверяется здесь руками, и это принципиально: `@app.middleware("http")`
    к вебсокетам не применяется — у них своя область запроса. Без этой проверки
    роут раздавал бы оболочку мини-ПК всем, кто дотянется до порта, в обход
    формы входа.
    """
    if AUTH.enabled:
        token = websocket.cookies.get(auth.COOKIE_NAME) or ""
        if not (token and auth.read_token(token, AUTH.password_hash)):
            await websocket.close(code=1008)
            return

    session = terminals.registry.get(session_id)
    if session is None:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    loop = asyncio.get_running_loop()
    queue = session.attach(loop)

    # Байты из PTY могут разорвать многобайтовый символ между двумя чтениями,
    # поэтому декодер инкрементальный: половинка кириллической буквы не должна
    # превращаться в мусор.
    decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")

    async def pump() -> None:
        """Вывод процесса — в браузер."""
        while True:
            chunk = await queue.get()
            if chunk == b"":
                await websocket.send_json({"type": "exit", "code": session.exit_code})
                return
            text = decoder.decode(chunk)
            if text:
                await websocket.send_json({"type": "data", "data": text})

    # Накопленный вывод — сразу: вернувшийся из вкладки с кодом входа браузер
    # должен увидеть диалог целиком, а не с момента подключения.
    history = session.history()
    if history:
        await websocket.send_json({"type": "data", "data": decoder.decode(history)})

    pump_task = asyncio.create_task(pump())
    try:
        while True:
            message = await websocket.receive_json()
            kind = message.get("type")
            if kind == "input":
                session.write(str(message.get("data") or ""))
            elif kind == "resize":
                session.resize(int(message.get("rows") or 30),
                               int(message.get("cols") or 100))
    except (WebSocketDisconnect, RuntimeError, ValueError):
        pass
    finally:
        pump_task.cancel()
        session.detach(queue)


@app.on_event("shutdown")
def _shutdown() -> None:
    service.stop_all_servers()
    terminals.registry.close_all()
