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
# Упакованные игры лежат ОТДЕЛЬНО от workspace, а не внутри него: workspace —
# песочница кодового агента, и складывать архивы соседних проектов в каталог,
# по которому он ходит, незачем. Плюс так папка с играми видна глазами:
# «zip_projects/» рядом с «workspace/». См. app/archive.py.
DEFAULT_ARCHIVE_DIR = BASE_DIR / "zip_projects"

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
        # Каталог упакованных игр. По умолчанию — рядом с workspace.
        self.archive_dir = Path(os.getenv("ARCHIVE_DIR", str(DEFAULT_ARCHIVE_DIR))).resolve()
        # Потолок для истории отката (app/snapshots.py). Теневые репозитории
        # снимков растут с каждым запросом к агенту и сами не чистятся; когда
        # они вместе перевалят за этот объём, фабрика ужимает их и выбрасывает
        # самые старые. 0 — не ограничивать.
        self.snapshot_limit_mb = int(os.getenv("SNAPSHOT_LIMIT_MB", "1024") or 0)

        # Load yaml configs
        self.factory_cfg = load_yaml(CONFIG_DIR / "factory.yaml")
        self.models_cfg = load_yaml(CONFIG_DIR / "models.yaml")
        self.genres_cfg = load_yaml(CONFIG_DIR / "genres.yaml")
        # mechanics_cfg убран вместе с каталогом на 1024 механики: механики
        # придумывает модель, а готовый КОД подбирается по app/library.py.
        self.references_cfg = load_yaml(CONFIG_DIR / "references.yaml")
        # Ниши с доказанным спросом: вокруг них генератор строит идеи. Это
        # список категорий спроса, а не каталог концептов — правится руками
        # под то, что видно в аналитике площадок.
        self.niches_cfg = load_yaml(CONFIG_DIR / "niches.yaml")
        self.playgama_cfg = load_yaml(CONFIG_DIR / "playgama.yaml")
        
        # Стек конвейера. 2D временно отключено, а не удалено: знания по Pixi
        # лежат в knowledge_archive/pixijs/ и не загружаются фабрикой.
        pipeline_cfg = self.factory_cfg.get("pipeline", {}) or {}
        self.renderer = str(pipeline_cfg.get("renderer", "threejs"))
        self.enable_2d = bool(pipeline_cfg.get("enable_2d", False))

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

        # Терминальные кодовые агенты кроме AGY: Claude Code, Codex, OpenCode.
        # Kimi отключён (providers/cli_agents.AGENT_CLASSES); его настройки
        # ниже оставлены, чтобы возврат агента был правкой одной строки.
        # Пути к CLI и модели читаются провайдерами из этих же переменных.
        self.default_agent = os.getenv("DEFAULT_AGENT", "agy")
        self.claude_cli_path = os.getenv("CLAUDE_CLI_PATH", "claude")
        self.claude_model = os.getenv("CLAUDE_MODEL", "")
        self.codex_cli_path = os.getenv("CODEX_CLI_PATH", "codex")
        self.codex_model = os.getenv("CODEX_MODEL", "")
        self.kimi_cli_path = os.getenv("KIMI_CLI_PATH", "kimi")
        self.kimi_model = os.getenv("KIMI_MODEL", "")
        self.opencode_cli_path = os.getenv("OPENCODE_CLI_PATH", "opencode")
        # Уровень рассуждений там, где CLI его понимает.
        self.claude_effort = os.getenv("CLAUDE_EFFORT", "")
        self.codex_effort = os.getenv("CODEX_EFFORT", "")
        self.kimi_effort = os.getenv("KIMI_EFFORT", "")
        self.opencode_effort = os.getenv("OPENCODE_EFFORT", "")
        # Модель OpenCode задаётся как provider/model, напр. opencode-go/kimi-k3
        self.opencode_model = os.getenv("OPENCODE_MODEL", "")
        self.gui_host = os.getenv("GUI_HOST", "127.0.0.1")
        self.gui_port = int(os.getenv("GUI_PORT", "7860"))

        # Сколько прогонов студии идут одновременно. Каждая идея — свой прогон
        # со своим журналом; заказанные сверх лимита ждут очереди.
        try:
            self.studio_max_parallel = max(1, int(os.getenv("STUDIO_MAX_PARALLEL", "10")))
        except ValueError:
            self.studio_max_parallel = 10

        # Fish Audio TTS: озвучка реплик и голосов игры. Ключ берётся с fish.audio
        # (раздел API Keys). Генерацию запускает только человек — см.
        # providers/fish_audio.py.
        self.fish_audio_api_key = os.getenv("FISH_AUDIO_API_KEY", "")
        self.fish_audio_model = os.getenv("FISH_AUDIO_MODEL", "s2.1-pro-free")

        # Доступ к базе знаний из готовой игры. Пакет игры носит манифест и
        # скрипт загрузки, а не двести килобайт копий; токен нужен, только если
        # репозиторий базы приватный.
        #
        # Ключ НИКОГДА не пишется в папку игры: она уезжает в git вместе со
        # всем содержимым. Он живёт здесь и попадает к кодовому агенту через
        # переменные окружения дочернего процесса.
        self.knowledge_repo = os.getenv("KNOWLEDGE_REPO", "EdikN/zavod2")
        self.knowledge_ref = os.getenv("KNOWLEDGE_REF", "main")
        self.knowledge_token = os.getenv("ZAVOD_KNOWLEDGE_TOKEN", "")

        # Каждый запуск игры начинается «с чистого листа»: кеш сборщика сносится,
        # dev-сервер поднимается на новом порту (а значит, с пустым localStorage —
        # хранилище браузера привязано к origin вместе с портом).
        self.reset_game_on_launch = _flag("RESET_GAME_ON_LAUNCH", True)

config = AppConfig()
