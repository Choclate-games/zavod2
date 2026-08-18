import os
from typing import Optional, Tuple

from providers.base import AIProvider, ImageProvider, NoneImageProvider
from providers.local import LocalAIProvider, LocalImageProvider
from providers.openai import OpenAIProvider, OpenAIImageProvider
from providers.anthropic import AnthropicProvider
from providers.google import GoogleProvider
from providers.agy import AGYProvider, AGYImageProvider
from providers.opencode import OpenCodeProvider
from providers.qwen import QwenImageProvider
from providers.cli_agents import AGENT_CLASSES, make_cli_agent

class ProviderFactory:
    @staticmethod
    def get_ai_provider(provider_name: Optional[str] = None) -> AIProvider:
        name = (provider_name or os.getenv("DEFAULT_PROVIDER", "local")).lower().strip()

        if name in ("agy", "antigravity", "gemini-cli"):
            cli_path = os.getenv("AGY_CLI_PATH", "agy")
            model = os.getenv("AGY_MODEL")
            effort = os.getenv("AGY_EFFORT")
            return AGYProvider(cli_path=cli_path, model=model, effort=effort)
        elif name in AGENT_CLASSES:
            # Терминальные агенты: claude (Claude Code), codex, kimi.
            # Путь к CLI и модель берутся из <PREFIX>_CLI_PATH / <PREFIX>_MODEL.
            return make_cli_agent(name)
        elif name in ("opencode", "opencode_go", "opencode-zen", "zen"):
            api_key = os.getenv("OPENCODE_API_KEY") or os.getenv("OPENCODE_GO_KEY")
            base_url = os.getenv("OPENCODE_BASE_URL", "https://opencode.ai/zen/v1")
            model = os.getenv("OPENCODE_MODEL", "opencode-zen")
            return OpenCodeProvider(api_key=api_key, base_url=base_url, model=model)
        elif name == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            model = os.getenv("OPENAI_MODEL", "gpt-4o")
            return OpenAIProvider(api_key=api_key, model=model)
        elif name == "anthropic":
            api_key = os.getenv("ANTHROPIC_API_KEY")
            model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
            return AnthropicProvider(api_key=api_key, model=model)
        elif name == "google":
            api_key = os.getenv("GEMINI_API_KEY")
            model = os.getenv("GOOGLE_MODEL", "gemini-1.5-pro")
            return GoogleProvider(api_key=api_key, model=model)
        else:
            return LocalAIProvider()

    @staticmethod
    def get_image_provider(provider_name: Optional[str] = None) -> ImageProvider:
        name = (provider_name or os.getenv("IMAGE_PROVIDER", "local")).lower().strip()
        
        if name in ("none", "skip", "off", "no", "without"):
            return NoneImageProvider()
        elif name in ("qwen", "dashscope", "wan"):
            # Самое дешёвое превью: text-to-image DashScope (wan2.2-t2i-flash).
            return QwenImageProvider()
        elif name in ("agy", "antigravity"):
            cli_path = os.getenv("AGY_CLI_PATH", "agy")
            return AGYImageProvider(cli_path=cli_path)
        elif name == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            model = os.getenv("OPENAI_IMAGE_MODEL", "dall-e-3")
            return OpenAIImageProvider(api_key=api_key, model=model)
        else:
            return LocalImageProvider()
