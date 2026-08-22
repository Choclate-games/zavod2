"""
HTTP-слой веб-фабрики (FastAPI).

Роуты тонкие: разбирают запрос, зовут `app.web.service` и возвращают JSON.
Живые события (журнал студии, лента чата, вывод dev-сервера) уходят в браузер
одним потоком Server-Sent Events на `/api/events`.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app import sandbox
from app.web.bus import bus
from app.web.service import AGENT_KEYS, service

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="AI Game Factory", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


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


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    return HTMLResponse((STATIC_DIR / "index.html").read_text(encoding="utf-8"))


@app.get("/play", response_class=HTMLResponse)
def play_view() -> HTMLResponse:
    """
    Обёртка вокруг игры: сама игра в iframe, сверху полоска с пресетами
    размера вьюпорта. Открывается как /play?url=<адрес игры>&slug=<проект>.
    """
    return HTMLResponse((STATIC_DIR / "play.html").read_text(encoding="utf-8"))


@app.get("/api/bootstrap")
def bootstrap() -> Dict[str, Any]:
    return service.bootstrap()


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
    service.stop_generation()
    return {"status": "success"}


@app.post("/api/studio/logs/clear")
def studio_clear_logs() -> Dict[str, Any]:
    service.clear_logs()
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


@app.post("/api/projects/{slug}/archive")
async def project_archive(slug: str, request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    return service.set_project_archived(_slug(slug), bool(payload.get("archived", True)))


@app.get("/api/projects/{slug}/doc")
def project_doc(slug: str, name: str = "AI_DEVELOPER_PROMPT.md") -> Dict[str, Any]:
    return service.read_doc(_slug(slug), name)


@app.get("/api/projects/{slug}/preview.png")
def project_preview(slug: str):
    path = service.preview_image_path(_slug(slug))
    if not path:
        raise HTTPException(status_code=404, detail="Превью не найдено")
    return FileResponse(path, media_type="image/png")


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
    return service.open_folder(sandbox.project_dir(_slug(slug)))


@app.post("/api/open-workspace")
def open_workspace() -> Dict[str, Any]:
    return service.open_folder(sandbox.workspace_root())


@app.get("/api/projects/{slug}/continue-prompt")
def project_continue_prompt(slug: str) -> Dict[str, Any]:
    return {"prompt": service.continue_prompt(_slug(slug))}


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


@app.on_event("shutdown")
def _shutdown() -> None:
    service.stop_all_servers()
