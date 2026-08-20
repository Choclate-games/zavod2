import os
from pathlib import Path
from typing import Any, Dict
import yaml
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_DIR = BASE_DIR / "config"
KNOWLEDGE_DIR = BASE_DIR / "knowledge"
TEMPLATES_DIR = BASE_DIR / "templates"
# Единственный корень для всех проектов игр: и документация, и исходный код.
# Кодовый агент запускается строго внутри него (см. app/sandbox.py).
DEFAULT_WORKSPACE_DIR = BASE_DIR / "workspace"

def _flag(name: str, default: bool) -> bool:
    """Булев ключ .env: 1/true/yes/on — включено, всё остальное — выключено."""
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")

def load_yaml(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}

class AppConfig:
    def __init__(self):
        self.base_dir = BASE_DIR
        self.config_dir = CONFIG_DIR
        self.knowledge_dir = KNOWLEDGE_DIR
        self.templates_dir = TEMPLATES_DIR
        # workspace/ — песочница агента и хранилище проектов.
        self.workspace_dir = Path(os.getenv("WORKSPACE_DIR", str(DEFAULT_WORKSPACE_DIR))).resolve()
        # OUTPUT_DIR оставлен для совместимости со старыми .env, но по умолчанию
        # проекты создаются в workspace/, чтобы агент не выходил за её пределы.
        self.output_dir = Path(os.getenv("OUTPUT_DIR", str(self.workspace_dir))).resolve()
        self.workspace_dir.mkdir(parents=True, exist_ok=True)

        # Load yaml configs
        self.factory_cfg = load_yaml(CONFIG_DIR / "factory.yaml")
        self.models_cfg = load_yaml(CONFIG_DIR / "models.yaml")
        self.genres_cfg = load_yaml(CONFIG_DIR / "genres.yaml")
        self.mechanics_cfg = load_yaml(CONFIG_DIR / "mechanics.yaml")
        self.references_cfg = load_yaml(CONFIG_DIR / "references.yaml")
        self.playgama_cfg = load_yaml(CONFIG_DIR / "playgama.yaml")
        
        self.default_agent = os.getenv("DEFAULT_AGENT", "opencode")
        self.default_provider = os.getenv("DEFAULT_PROVIDER", self.default_agent)
        self.default_mode = os.getenv("DEFAULT_MODE", "standard")
        self.allow_template_mixing = _flag("ALLOW_TEMPLATE_MIXING", False)
        
        # Provider & GUI settings
        # OpenCode Zen REST API отключён вместе с остальными API-моделями:
        # self.opencode_api_key = os.getenv("OPENCODE_API_KEY", "")
        # self.opencode_base_url = os.getenv("OPENCODE_BASE_URL", "https://opencode.ai/zen/v1")
        self.agy_cli_path = os.getenv("AGY_CLI_PATH", "agy")
        self.agy_model = os.getenv("AGY_MODEL", "")
        # Пусто = не передавать --effort: модель по умолчанию его не принимает
        # ("invalid model selection: --effort is not supported for the current model")
        self.agy_effort = os.getenv("AGY_EFFORT", "")

        # Терминальные кодовые агенты кроме AGY: Claude Code, Codex, Kimi, OpenCode.
        # Пути к CLI и модели читаются провайдерами из этих же переменных.
        self.default_agent = os.getenv("DEFAULT_AGENT", "agy")
        self.claude_cli_path = os.getenv("CLAUDE_CLI_PATH", "claude")
        self.claude_model = os.getenv("CLAUDE_MODEL", "")
        self.codex_cli_path = os.getenv("CODEX_CLI_PATH", "codex")
        self.codex_model = os.getenv("CODEX_MODEL", "")
        self.kimi_cli_path = os.getenv("KIMI_CLI_PATH", "kimi")
        self.kimi_model = os.getenv("KIMI_MODEL", "")
        self.opencode_cli_path = os.getenv("OPENCODE_CLI_PATH", "opencode")
        # Уровень рассуждений там, где CLI его понимает (kimi — не понимает).
        self.claude_effort = os.getenv("CLAUDE_EFFORT", "")
        self.codex_effort = os.getenv("CODEX_EFFORT", "")
        self.kimi_effort = os.getenv("KIMI_EFFORT", "")
        self.opencode_effort = os.getenv("OPENCODE_EFFORT", "")
        # Модель OpenCode задаётся как provider/model, напр. opencode-go/kimi-k3
        self.opencode_model = os.getenv("OPENCODE_MODEL", "")
        self.gui_host = os.getenv("GUI_HOST", "127.0.0.1")
        self.gui_port = int(os.getenv("GUI_PORT", "7860"))

        # Fish Audio TTS: озвучка реплик и голосов игры. Ключ берётся с fish.audio
        # (раздел API Keys). Генерацию запускает только человек — см.
        # providers/fish_audio.py.
        self.fish_audio_api_key = os.getenv("FISH_AUDIO_API_KEY", "")
        self.fish_audio_model = os.getenv("FISH_AUDIO_MODEL", "s2.1-pro-free")

        # Каждый запуск игры начинается «с чистого листа»: кеш сборщика сносится,
        # dev-сервер поднимается на новом порту (а значит, с пустым localStorage —
        # хранилище браузера привязано к origin вместе с портом).
        self.reset_game_on_launch = _flag("RESET_GAME_ON_LAUNCH", True)

# ---------------------------------------------------------------------------
# Слой Design OS (обещание игроку, плотность впечатлений, допущения, телеметрия,
# план валидации, решения и человеческие ворота) отключён по просьбе владельца
# фабрики. Код агентов, генераторов и валидаторов оставлен на месте: чтобы
# вернуть слой, достаточно поставить здесь True или задать DESIGN_OS=1 в .env.
# ---------------------------------------------------------------------------
DESIGN_OS_ENABLED = os.getenv("DESIGN_OS", "0").strip().lower() in ("1", "true", "yes", "on")

config = AppConfig()
