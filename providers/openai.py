# ВНИМАНИЕ: этот модуль отключён в ProviderFactory. Если будете его включать —
# сначала уберите откат на LocalAIProvider ниже: офлайн-режим в фабрике выключен,
# и молчаливая подмена ответа заготовкой возвращает ровно ту проблему, ради
# которой его выключали.
import os
import json
import base64
from pathlib import Path
from typing import Any, Dict, Optional, Type
import requests

from providers.base import AIProvider, ImageProvider, T
from providers.local import LocalAIProvider, LocalImageProvider

class OpenAIProvider(AIProvider):
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.model = model
        self.fallback = LocalAIProvider()

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        if not self.api_key:
            return self.fallback.generate_text(system_prompt, user_prompt, temperature, max_tokens)
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        try:
            resp = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"OpenAI API call failed ({e}), falling back to Local Expert...")
            return self.fallback.generate_text(system_prompt, user_prompt, temperature, max_tokens)

    def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.5
    ) -> T:
        if not self.api_key:
            return self.fallback.generate_structured(system_prompt, user_prompt, response_model, temperature)
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        schema = response_model.model_json_schema()
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt + "\nReturn JSON adhering to schema."},
                {"role": "user", "content": user_prompt}
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": response_model.__name__,
                    "strict": False,
                    "schema": schema
                }
            },
            "temperature": temperature
        }
        try:
            resp = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=90)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            return response_model.model_validate(parsed)
        except Exception as e:
            print(f"OpenAI structured call failed ({e}), falling back to Local Expert...")
            return self.fallback.generate_structured(system_prompt, user_prompt, response_model, temperature)


class OpenAIImageProvider(ImageProvider):
    def __init__(self, api_key: Optional[str] = None, model: str = "dall-e-3"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.model = model
        self.fallback = LocalImageProvider()

    def generate_image(
        self,
        prompt: str,
        output_path: Path,
        aspect_ratio: str = "16:9",
        width: int = 1280,
        height: int = 720
    ) -> bool:
        if not self.api_key:
            return self.fallback.generate_image(prompt, output_path, aspect_ratio, width, height)
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "prompt": prompt,
            "n": 1,
            "size": "1792x1024" if aspect_ratio == "16:9" else "1024x1024",
            "response_format": "b64_json"
        }
        try:
            resp = requests.post("https://api.openai.com/v1/images/generations", headers=headers, json=payload, timeout=120)
            resp.raise_for_status()
            data = resp.json()
            b64 = data["data"][0]["b64_json"]
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(base64.b64decode(b64))
            return True
        except Exception as e:
            print(f"OpenAI DALL-E call failed ({e}), falling back to Local procedural renderer...")
            return self.fallback.generate_image(prompt, output_path, aspect_ratio, width, height)
