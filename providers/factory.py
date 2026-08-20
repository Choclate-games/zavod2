import os
from typing import Optional, Tuple

from providers.base import AIProvider, ImageProvider, NoneImageProvider
from providers.local import LocalAIProvider, LocalImageProvider
from providers.agy import AGYProvider, AGYImageProvider
from providers.qwen import QwenImageProvider
from providers.cli_agents import AGENT_CLASSES, make_cli_agent

# API-провайдеры отключены: по подписке кодят терминальные агенты (agy, claude,
# codex, kimi, opencode), а API-модели пока пишут код заметно хуже.
# Из API оставлен только Qwen/DashScope — он нужен исключительно для картинок.
# from providers.openai import OpenAIProvider, OpenAIImageProvider
# from providers.anthropic import AnthropicProvider
# from providers.google import GoogleProvider
# from providers.opencode import OpenCodeProvider   # OpenCode Zen REST API

class ProviderFactory:
    @staticmethod
    def get_ai_provider(provider_name: Optional[str] = None) -> AIProvider:
        default_agent = (os.getenv("DEFAULT_PROVIDER") or os.getenv("DEFAULT_AGENT") or "opencode").lower().strip()
        name = (provider_name or default_agent).lower().strip()
        if name in ("default", "auto", ""):
            name = default_agent

        if name in ("agy", "antigravity", "gemini-cli"):
            cli_path = os.getenv("AGY_CLI_PATH", "agy")
            model = os.getenv("AGY_MODEL")
            effort = os.getenv("AGY_EFFORT")
            return AGYProvider(cli_path=cli_path, model=model, effort=effort)
        elif name in AGENT_CLASSES:
            # Терминальные агенты: claude (Claude Code), codex, kimi, opencode.
            # Путь к CLI и модель берутся из <PREFIX>_CLI_PATH / <PREFIX>_MODEL.
            return make_cli_agent(name)
        elif name == "local":
            return LocalAIProvider()
        elif default_agent in AGENT_CLASSES:
            return make_cli_agent(default_agent)
        else:
            cli_path = os.getenv("AGY_CLI_PATH", "agy")
            return AGYProvider(cli_path=cli_path)

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
        # elif name == "openai":
        #     api_key = os.getenv("OPENAI_API_KEY")
        #     model = os.getenv("OPENAI_IMAGE_MODEL", "dall-e-3")
        #     return OpenAIImageProvider(api_key=api_key, model=model)
        else:
            return LocalImageProvider()
