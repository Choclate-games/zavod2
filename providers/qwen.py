"""
Провайдер изображений Qwen / DashScope (Alibaba Cloud, международный регион).

Используется для дешёвого концепт-превью каждой игры: модель `wan2.2-t2i-flash`
— самый бюджетный text-to-image в линейке DashScope.

API асинхронный: сначала создаётся задача, затем опрашивается её статус, и
только потом скачивается готовый PNG. Совместимый с OpenAI режим
(`/compatible-mode/v1/images/generations`) картинки НЕ отдаёт — отвечает 404,
поэтому здесь используется нативный endpoint image-synthesis.
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Optional

import requests

from providers.base import ImageProvider
from providers.local import LocalImageProvider

DEFAULT_BASE_URL = "https://dashscope-intl.aliyuncs.com"
DEFAULT_MODEL = "wan2.2-t2i-flash"

# Модель принимает фиксированный набор разрешений; ключ — соотношение сторон.
SIZE_BY_ASPECT = {
    "16:9": "1280*720",
    "9:16": "720*1280",
    "1:1": "1024*1024",
    "4:3": "1024*768",
    "3:4": "768*1024",
}


class QwenImageProvider(ImageProvider):
    """Text-to-image через DashScope (Qwen/Wan). При сбое — процедурный локальный рендер."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        poll_timeout: int = 180,
    ):
        self.api_key = api_key or os.getenv("DASHSCOPE_API_KEY", "") or os.getenv("QWEN_API_KEY", "")
        self.model = model or os.getenv("QWEN_IMAGE_MODEL", DEFAULT_MODEL)
        self.base_url = (base_url or os.getenv("DASHSCOPE_BASE_URL", DEFAULT_BASE_URL)).rstrip("/")
        # compatible-mode-путь в .env оставляем валидным: отрезаем хвост,
        # чтобы получить корень API для нативного image-synthesis.
        if self.base_url.endswith("/compatible-mode/v1"):
            self.base_url = self.base_url[: -len("/compatible-mode/v1")]
        self.poll_timeout = poll_timeout
        self.fallback = LocalImageProvider()

    def is_available(self) -> bool:
        return bool(self.api_key)

    def generate_image(
        self,
        prompt: str,
        output_path: Path,
        aspect_ratio: str = "16:9",
        width: int = 1280,
        height: int = 720,
    ) -> bool:
        if not self.api_key:
            print("QwenImageProvider: не задан DASHSCOPE_API_KEY — рисуем локальное превью.")
            return self.fallback.generate_image(prompt, output_path, aspect_ratio, width, height)

        try:
            task_id = self._submit_task(prompt, aspect_ratio)
            image_url = self._await_task(task_id)
            self._download(image_url, Path(output_path))
            return True
        except Exception as exc:
            print(f"Qwen image generation failed ({exc}), falling back to Local procedural renderer...")
            return self.fallback.generate_image(prompt, output_path, aspect_ratio, width, height)

    # ── Внутреннее ────────────────────────────────────────────────────────

    @property
    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _submit_task(self, prompt: str, aspect_ratio: str) -> str:
        url = f"{self.base_url}/api/v1/services/aigc/text2image/image-synthesis"
        payload = {
            "model": self.model,
            "input": {"prompt": prompt[:1200]},
            "parameters": {
                "size": SIZE_BY_ASPECT.get(aspect_ratio, SIZE_BY_ASPECT["16:9"]),
                "n": 1,
            },
        }
        headers = dict(self._headers)
        headers["X-DashScope-Async"] = "enable"
        resp = requests.post(url, headers=headers, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        task_id = (data.get("output") or {}).get("task_id")
        if not task_id:
            raise RuntimeError(f"DashScope не вернул task_id: {data}")
        return task_id

    def _await_task(self, task_id: str) -> str:
        url = f"{self.base_url}/api/v1/tasks/{task_id}"
        deadline = time.time() + self.poll_timeout
        while time.time() < deadline:
            resp = requests.get(url, headers=self._headers, timeout=30)
            resp.raise_for_status()
            output = resp.json().get("output") or {}
            status = output.get("task_status")
            if status == "SUCCEEDED":
                results = output.get("results") or []
                for item in results:
                    if item.get("url"):
                        return item["url"]
                raise RuntimeError(f"Задача завершена без изображения: {output}")
            if status in ("FAILED", "CANCELED", "UNKNOWN"):
                raise RuntimeError(f"Задача {task_id} завершилась статусом {status}: {output.get('message')}")
            time.sleep(3)
        raise TimeoutError(f"DashScope не отдал изображение за {self.poll_timeout} с")

    def _download(self, url: str, output_path: Path) -> None:
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(resp.content)
