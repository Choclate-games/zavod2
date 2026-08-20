"""
Fish Audio TTS — генерация голосов для игр.

Генерация запускается ТОЛЬКО вручную, из вкладки «🔊 Озвучка» проекта. Ни один
агент фабрики не вызывает этот модуль: озвучка стоит денег и квоты, поэтому
решение «озвучить» принимает человек, а не пайплайн.

По умолчанию используется бесплатная модель `s2.1-pro-free` — та, что Fish Audio
отдаёт для разработки и прототипов (https://docs.fish.audio/overview/capabilities).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import requests

API_BASE = "https://api.fish.audio"

# Бесплатный тариф: именно эта модель не тарифицируется.
FREE_MODEL = "s2.1-pro-free"

MODELS = [
    {"key": FREE_MODEL, "label": "🆓 s2.1-pro-free (бесплатная, для разработки)"},
    {"key": "s2.1-pro", "label": "s2.1-pro (платная, лучшее качество)"},
    {"key": "s2-pro", "label": "s2-pro (платная, мультиспикер)"},
    {"key": "s1", "label": "s1 (платная, теги эмоций)"},
]

FORMATS = ["mp3", "wav", "opus"]

# Столько ждём синтез: минута речи генерируется за считанные секунды, но на
# холодном старте бесплатной модели ответ приходит заметно позже.
TIMEOUT = 120

MAX_TEXT_LENGTH = 8000


class FishAudioError(RuntimeError):
    """Ошибка обращения к Fish Audio: нет ключа, отказ API или сеть."""


class FishAudioClient:
    def __init__(self, api_key: str = "", model: str = FREE_MODEL) -> None:
        self.api_key = (api_key or "").strip()
        self.model = (model or FREE_MODEL).strip() or FREE_MODEL

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    # ── Голоса ──────────────────────────────────────────────────────────────

    def list_voices(self, query: str = "", limit: int = 24) -> List[Dict[str, Any]]:
        """
        Каталог голосов Fish Audio. Пустой `query` отдаёт витрину популярных.

        Голос выбирается по `reference_id` — это `_id` модели из этого списка.
        """
        params: Dict[str, Any] = {"page_size": max(1, min(100, limit)), "page_number": 1}
        if query.strip():
            params["title"] = query.strip()
        data = self._request("GET", "/model", params=params).json()
        items = data.get("items") if isinstance(data, dict) else None
        voices: List[Dict[str, Any]] = []
        for item in items or []:
            if not isinstance(item, dict):
                continue
            voices.append({
                "id": item.get("_id") or item.get("id") or "",
                "title": item.get("title") or "Без названия",
                "languages": item.get("languages") or [],
                "author": ((item.get("author") or {}).get("nickname")
                           if isinstance(item.get("author"), dict) else "") or "",
                "likes": item.get("like_count") or 0,
            })
        return [voice for voice in voices if voice["id"]]

    # ── Синтез ──────────────────────────────────────────────────────────────

    def synthesize(self, text: str, *, reference_id: Optional[str] = None,
                   fmt: str = "mp3", mp3_bitrate: int = 128,
                   normalize: bool = True, latency: str = "normal") -> bytes:
        """Возвращает готовый аудиофайл байтами. `reference_id` — голос из каталога."""
        text = (text or "").strip()
        if not text:
            raise FishAudioError("Пустой текст — нечего озвучивать.")
        if len(text) > MAX_TEXT_LENGTH:
            raise FishAudioError(
                f"Текст длиннее {MAX_TEXT_LENGTH} символов — разбейте реплику на части."
            )
        if fmt not in FORMATS:
            fmt = "mp3"

        payload: Dict[str, Any] = {
            "text": text,
            "format": fmt,
            "normalize": bool(normalize),
            "latency": latency if latency in ("low", "normal", "balanced") else "normal",
        }
        if fmt == "mp3":
            payload["mp3_bitrate"] = mp3_bitrate if mp3_bitrate in (64, 128, 192) else 128
        if reference_id:
            payload["reference_id"] = reference_id

        response = self._request("POST", "/v1/tts", json=payload)
        audio = response.content
        if not audio:
            raise FishAudioError("Fish Audio вернул пустой ответ — попробуйте ещё раз.")
        return audio

    def test_connection(self) -> Dict[str, Any]:
        try:
            voices = self.list_voices(limit=1)
        except FishAudioError as exc:
            return {"status": "error", "message": str(exc)}
        return {"status": "success",
                "message": f"✅ Fish Audio на связи · модель {self.model}"
                           + (" · каталог голосов доступен" if voices else "")}

    # ── HTTP ────────────────────────────────────────────────────────────────

    def _request(self, method: str, path: str, **kwargs) -> requests.Response:
        if not self.is_configured:
            raise FishAudioError(
                "Не задан ключ Fish Audio. Получите его на fish.audio → API Keys "
                "и вставьте в «⚙️ Настройки → 🔊 Fish Audio»."
            )
        headers = {"Authorization": f"Bearer {self.api_key}", "model": self.model}
        try:
            response = requests.request(
                method, f"{API_BASE}{path}", headers=headers, timeout=TIMEOUT, **kwargs
            )
        except requests.RequestException as exc:
            raise FishAudioError(f"Fish Audio недоступен: {exc}") from exc

        if response.status_code == 401:
            raise FishAudioError("Ключ Fish Audio отклонён (401) — проверьте его в настройках.")
        if response.status_code == 402:
            raise FishAudioError(
                "Fish Audio: закончился баланс (402). Для бесплатной генерации "
                f"выберите модель «{FREE_MODEL}» в настройках."
            )
        if response.status_code == 429:
            raise FishAudioError("Fish Audio: слишком часто (429) — подождите минуту.")
        if response.status_code >= 400:
            raise FishAudioError(
                f"Fish Audio ответил {response.status_code}: {response.text[:300]}"
            )
        return response
