# ВНИМАНИЕ: этот модуль отключён в ProviderFactory. Если будете его включать —
# сначала уберите откат на LocalAIProvider ниже: офлайн-режим в фабрике выключен,
# и молчаливая подмена ответа заготовкой возвращает ровно ту проблему, ради
# которой его выключали.
import os
import json
import re
from pathlib import Path
from typing import Any, Dict, Optional, Type
import requests

from providers.base import AIProvider, T
from providers.local import LocalAIProvider

class OpenCodeProvider(AIProvider):
    """
    AI Provider for OpenCode Go / OpenCode Zen subscription API.
    Provides access to curated high-performance coding and reasoning models via OpenAI-compatible REST API.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 90
    ):
        self.api_key = api_key or os.getenv("OPENCODE_API_KEY") or os.getenv("OPENCODE_GO_KEY", "")
        self.base_url = (base_url or os.getenv("OPENCODE_BASE_URL", "https://opencode.ai/zen/v1")).rstrip("/")
        self.model = model or os.getenv("OPENCODE_MODEL", "opencode-zen")
        self.timeout = timeout
        self.fallback = LocalAIProvider()

    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Zavod2-Game-Prompt-Factory/1.0"
        }

    def _get_endpoint(self) -> str:
        if self.base_url.endswith("/chat/completions"):
            return self.base_url
        return f"{self.base_url}/chat/completions"

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        if not self.is_configured():
            print("[OpenCodeProvider] OPENCODE_API_KEY not configured, falling back to Local Expert...")
            return self.fallback.generate_text(system_prompt, user_prompt, temperature, max_tokens)

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
            resp = requests.post(
                self._get_endpoint(),
                headers=self._get_headers(),
                json=payload,
                timeout=self.timeout
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"[OpenCodeProvider] API request failed ({e}), falling back to Local Expert...")
            return self.fallback.generate_text(system_prompt, user_prompt, temperature, max_tokens)

    def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.5
    ) -> T:
        if not self.is_configured():
            return self.fallback.generate_structured(system_prompt, user_prompt, response_model, temperature)

        schema = response_model.model_json_schema()
        schema_json = json.dumps(schema, ensure_ascii=False, indent=2)

        # Attempt structured response with JSON Schema format if supported, plus system prompt instruction
        structured_system = (
            f"{system_prompt}\n\n"
            f"You MUST respond ONLY with a valid JSON object matching the JSON Schema below.\n"
            f"Do not output markdown code blocks or text outside the JSON object.\n\n"
            f"JSON Schema:\n{schema_json}"
        )

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": structured_system},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": temperature
        }

        try:
            resp = requests.post(
                self._get_endpoint(),
                headers=self._get_headers(),
                json=payload,
                timeout=self.timeout
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            extracted = self._extract_json_string(content)
            parsed = json.loads(extracted)
            return response_model.model_validate(parsed)
        except Exception as e:
            print(f"[OpenCodeProvider] Structured generation failed ({e}), falling back to Local Expert...")
            return self.fallback.generate_structured(system_prompt, user_prompt, response_model, temperature)

    def _extract_json_string(self, text: str) -> str:
        text = text.strip()
        match = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", text, re.DOTALL)
        if match:
            return match.group(1).strip()
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return text[start:end + 1].strip()
        return text

    def test_connection(self) -> Dict[str, Any]:
        """Test API connection to OpenCode Go / Zen endpoint."""
        if not self.is_configured():
            return {
                "status": "error",
                "message": "OPENCODE_API_KEY is not set. Please provide your OpenCode Go API key."
            }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "user", "content": "Respond with 'OpenCode Go connected'"}
            ],
            "max_tokens": 30
        }

        try:
            resp = requests.post(
                self._get_endpoint(),
                headers=self._get_headers(),
                json=payload,
                timeout=15
            )
            resp.raise_for_status()
            data = resp.json()
            reply = data["choices"][0]["message"]["content"]
            return {
                "status": "success",
                "message": "Successfully connected to OpenCode Go / Zen API!",
                "model": self.model,
                "endpoint": self._get_endpoint(),
                "sample_response": reply
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Connection failed: {str(e)}",
                "endpoint": self._get_endpoint()
            }
