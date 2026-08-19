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
from typing import Any, Dict

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


# ── Проекты ─────────────────────────────────────────────────────────────────

@app.get("/api/projects")
def list_projects() -> Dict[str, Any]:
    return {"projects": service.list_projects()}


@app.get("/api/projects/{slug}")
def project_detail(slug: str) -> Dict[str, Any]:
    return service.project_detail(_slug(slug))


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


@app.get("/api/projects/{slug}/design-os")
def project_design_os(slug: str) -> Dict[str, Any]:
    return service.design_os_payload(_slug(slug))


@app.post("/api/projects/{slug}/gates/{gate_id}")
async def project_set_gate(slug: str, gate_id: str, request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    status = str(payload.get("status", "accepted")).strip()
    note = str(payload.get("note", "")).strip()
    return service.set_gate(_slug(slug), gate_id, status, note)


@app.get("/api/projects/{slug}/health")
def project_health(slug: str) -> Dict[str, Any]:
    return service.design_os_health(_slug(slug))


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
    return service.send_chat_task(
        _slug(slug),
        payload.get("session_id"),
        payload.get("prompt") or "",
        agent_key=agent,
        model=model,
        yolo=bool(payload.get("yolo", True)),
        continue_dialog=bool(payload.get("continue_dialog", True)),
    )


@app.post("/api/chats/{slug}/{session_id}/stop")
def chats_stop(slug: str, session_id: str) -> Dict[str, Any]:
    return service.stop_chat(session_id)


@app.get("/api/chats-running")
def chats_running() -> Dict[str, Any]:
    return {"running": service.running_chats()}


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


@app.post("/api/play/{slug}/window")
async def play_window(slug: str, request: Request) -> Dict[str, Any]:
    payload = await _body(request)
    state = service.play_state(_slug(slug))
    return service.open_preview_window(slug, payload.get("url") or state.get("url") or "")


# ── Квоты ───────────────────────────────────────────────────────────────────

@app.get("/api/quota")
def quota() -> Dict[str, Any]:
    return service.quota_payload()


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
