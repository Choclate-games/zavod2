import os
import json
from typing import Any, Dict, Optional, Type
import requests

from providers.base import AIProvider, T
from providers.local import LocalAIProvider

class AnthropicProvider(AIProvider):
    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-5-sonnet-20241022"):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
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
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": self.model,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        try:
            resp = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            return data["content"][0]["text"]
        except Exception as e:
            print(f"Anthropic API call failed ({e}), falling back to Local Expert...")
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
        
        # Use Claude tools/structured output or text prompt with json markdown block
        prompt_with_schema = (
            f"{user_prompt}\n\nYou MUST respond strictly in valid JSON matching this Pydantic schema:\n"
            f"```json\n{json.dumps(response_model.model_json_schema())}\n```\n"
            "Return only the JSON object."
        )
        text_resp = self.generate_text(system_prompt, prompt_with_schema, temperature=temperature)
        try:
            cleaned = text_resp.strip()
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[1].split("```")[0].strip()
            elif "```" in cleaned:
                cleaned = cleaned.split("```")[1].split("```")[0].strip()
            parsed = json.loads(cleaned)
            return response_model.model_validate(parsed)
        except Exception as e:
            print(f"Failed to parse Claude structured response ({e}), falling back to Local Expert...")
            return self.fallback.generate_structured(system_prompt, user_prompt, response_model, temperature)
