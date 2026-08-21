import os
import json
from typing import Any, Dict, Optional, Type
import requests

from providers.base import AIProvider, T

# Локальной подмены ответа здесь больше нет.
#
# Раньше любая ошибка (нет ключа, сеть, невалидный JSON) молча возвращала
# концепт, собранный локальным шаблонным генератором. Отличить такой пакет
# документов от настоящей работы модели невозможно, и фабрика выпускала
# одинаковые ТЗ, считая их результатом генерации. Теперь ошибка остаётся
# ошибкой: её видно в логе, и генерация останавливается.

class GoogleProvider(AIProvider):
    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-1.5-pro"):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.model = model

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        if not self.api_key:
            raise RuntimeError("Google Gemini: не задан GEMINI_API_KEY.")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }
        try:
            resp = requests.post(url, json=payload, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as exc:
            raise RuntimeError(f"Google Gemini: запрос не удался — {exc}") from exc

    def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.5
    ) -> T:
        if not self.api_key:
            raise RuntimeError("Google Gemini: не задан GEMINI_API_KEY.")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        schema = response_model.model_json_schema()
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt + "\nReturn ONLY valid JSON matching schema."}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "responseMimeType": "application/json",
                "responseSchema": schema
            }
        }
        try:
            resp = requests.post(url, json=payload, timeout=90)
            resp.raise_for_status()
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(text)
            return response_model.model_validate(parsed)
        except Exception as exc:
            raise RuntimeError(
                f"Google Gemini: ответ не разобрался как {response_model.__name__} — {exc}"
            ) from exc
