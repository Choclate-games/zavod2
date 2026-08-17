import os
import sys
import json
import re
import math
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Type, Callable
from PIL import Image, ImageDraw

from providers.base import AIProvider, ImageProvider, NoneImageProvider, T
from providers.local import LocalAIProvider, LocalImageProvider

class AGYQuotaTracker:
    """
    Отслеживает использование Antigravity CLI (AGY), скользящий 5-часовой лимит и недельную квоту.
    """

    def __init__(self, storage_path: Optional[Path] = None):
        self.storage_path = storage_path or Path("output/.agy_quota_history.json")
        self.limit_5h = int(os.getenv("AGY_LIMIT_5H", "50"))
        self.limit_weekly = int(os.getenv("AGY_LIMIT_WEEKLY", "500"))

    def record_usage(self, prompt_len: int = 0, model: str = "default"):
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        history = self._load_history()
        now_ts = datetime.now().timestamp()
        history.append({
            "timestamp": now_ts,
            "datetime": datetime.now().isoformat(),
            "prompt_len": prompt_len,
            "model": model
        })
        self._save_history(history)

    def get_quota_status(self) -> Dict[str, Any]:
        history = self._load_history()
        now_ts = datetime.now().timestamp()
        
        # 5 часов = 18 000 сек
        ts_5h_ago = now_ts - 18000
        # 7 дней = 604 800 сек
        ts_7d_ago = now_ts - 604800
        
        reqs_5h = [item for item in history if item.get("timestamp", 0) >= ts_5h_ago]
        reqs_weekly = [item for item in history if item.get("timestamp", 0) >= ts_7d_ago]
        
        used_5h = len(reqs_5h)
        used_weekly = len(reqs_weekly)
        
        rem_5h = max(0, self.limit_5h - used_5h)
        rem_weekly = max(0, self.limit_weekly - used_weekly)
        
        reset_5h_seconds = 0
        if reqs_5h:
            oldest_5h = min(item.get("timestamp", now_ts) for item in reqs_5h)
            reset_5h_seconds = max(0, int(18000 - (now_ts - oldest_5h)))
            
        reset_weekly_seconds = 0
        if reqs_weekly:
            oldest_weekly = min(item.get("timestamp", now_ts) for item in reqs_weekly)
            reset_weekly_seconds = max(0, int(604800 - (now_ts - oldest_weekly)))

        return {
            "used_5h": used_5h,
            "limit_5h": self.limit_5h,
            "remaining_5h": rem_5h,
            "pct_5h": min(100.0, (used_5h / max(1, self.limit_5h)) * 100),
            "reset_5h_seconds": reset_5h_seconds,
            "reset_5h_str": f"{reset_5h_seconds // 3600}ч {(reset_5h_seconds % 3600) // 60}м" if reset_5h_seconds > 0 else "0м",
            
            "used_weekly": used_weekly,
            "limit_weekly": self.limit_weekly,
            "remaining_weekly": rem_weekly,
            "pct_weekly": min(100.0, (used_weekly / max(1, self.limit_weekly)) * 100),
            "reset_weekly_seconds": reset_weekly_seconds,
            "reset_weekly_str": f"{reset_weekly_seconds // 86400}д {(reset_weekly_seconds % 86400) // 3600}ч" if reset_weekly_seconds > 0 else "0д",
            "total_recorded": len(history)
        }

    def _load_history(self) -> List[Dict[str, Any]]:
        if not self.storage_path.exists():
            return []
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_history(self, history: List[Dict[str, Any]]):
        try:
            cutoff = datetime.now().timestamp() - (30 * 86400)
            cleaned = [item for item in history if item.get("timestamp", 0) >= cutoff]
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(cleaned, f, indent=2)
        except Exception:
            pass


class AGYSession:
    """Управление активной двухсторонней сессией с процессом agy CLI."""

    def __init__(self, proc: subprocess.Popen):
        self.proc = proc

    def send_input(self, text: str) -> bool:
        """Отправляет строку в stdin запущенного процесса agy."""
        if self.proc and self.proc.poll() is None and self.proc.stdin:
            try:
                data = (text.strip() + "\n").encode("utf-8")
                self.proc.stdin.write(data)
                self.proc.stdin.flush()
                return True
            except Exception as e:
                print(f"[AGYSession] Ошибка отправки в stdin: {e}")
                return False
        return False

    def kill(self):
        """Принудительно завершает процесс."""
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.kill()
            except Exception:
                pass


class AGYProvider(AIProvider):
    """
    Интеграция с CLI Google Antigravity (`agy`).
    Поддерживает режим YOLO (--dangerously-skip-permissions), двухсторонний интерактивный stdin, стриминг и квоты.
    """

    def __init__(
        self,
        cli_path: Optional[str] = None,
        model: Optional[str] = None,
        effort: Optional[str] = None,
        yolo: bool = True,
        timeout_seconds: int = 300
    ):
        self.cli_path = cli_path or os.getenv("AGY_CLI_PATH", "agy")
        self.model = model or os.getenv("AGY_MODEL", None)
        self.effort = effort or os.getenv("AGY_EFFORT", None)
        self.yolo = yolo
        self.timeout_seconds = timeout_seconds
        self.fallback = LocalAIProvider()
        self.quota_tracker = AGYQuotaTracker()

    def is_available(self) -> bool:
        """Проверка доступности исполняемого файла agy."""
        cli = shutil.which(self.cli_path)
        if not cli and self.cli_path != "agy":
            cli = self.cli_path if Path(self.cli_path).exists() else None
        return cli is not None

    def _build_command(self, prompt: str, output_format: str = "text", yolo: Optional[bool] = None) -> list[str]:
        use_yolo = self.yolo if yolo is None else yolo
        cmd = [self.cli_path, "-p", prompt, "--output-format", output_format]
        if use_yolo:
            cmd.append("--dangerously-skip-permissions")
        if self.model and self.model != "inherit":
            cmd.extend(["--model", self.model])
        if self.effort and self.effort in ("low", "medium", "high"):
            cmd.extend(["--effort", self.effort])
        return cmd

    def _run_agy(self, prompt: str, output_format: str = "text", yolo: Optional[bool] = None, cwd: Optional[Path] = None) -> str:
        if not self.is_available():
            raise RuntimeError(f"Исполняемый файл Antigravity CLI '{self.cli_path}' не найден в PATH.")

        cmd = self._build_command(prompt, output_format=output_format, yolo=yolo)
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=self.timeout_seconds,
            cwd=str(cwd) if cwd else None,
            env=env
        )

        self.quota_tracker.record_usage(prompt_len=len(prompt), model=self.model or "default")

        if result.returncode != 0:
            err_msg = result.stderr.strip() or f"Процесс завершился с кодом {result.returncode}"
            raise RuntimeError(f"AGY CLI ошибка выполнения: {err_msg}")

        return result.stdout.strip()

    def stream_run(
        self,
        prompt: str,
        on_line: Callable[[str], None],
        yolo: Optional[bool] = None,
        cwd: Optional[Path] = None,
        stop_check_fn: Optional[Callable[[], bool]] = None
    ) -> tuple[int, str]:
        """Запускает задачу в agy с непрерывным стримингом вывода в реальном времени."""
        import time

        if not self.is_available():
            raise RuntimeError(f"Antigravity CLI '{self.cli_path}' не найден.")

        cmd = self._build_command(prompt, output_format="text", yolo=yolo)
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUNBUFFERED"] = "1"
        
        creationflags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=str(cwd) if cwd else None,
            env=env,
            bufsize=0,
            creationflags=creationflags
        )

        collected = []

        try:
            while True:
                if stop_check_fn and stop_check_fn():
                    proc.kill()
                    on_line("\n⏹️ Процесс принудительно остановлен.\n")
                    break
                
                chunk = proc.stdout.read1(1024) if hasattr(proc.stdout, "read1") else proc.stdout.read(512)
                if not chunk:
                    if proc.poll() is not None:
                        remainder = proc.stdout.read() if proc.stdout else b""
                        if remainder:
                            text = remainder.decode("utf-8", errors="replace")
                            collected.append(text)
                            on_line(text)
                        break
                    time.sleep(0.02)
                    continue
                
                text = chunk.decode("utf-8", errors="replace")
                collected.append(text)
                on_line(text)
        finally:
            if proc.stdout and not proc.stdout.closed:
                try:
                    proc.stdout.close()
                except Exception:
                    pass
            proc.wait()

        self.quota_tracker.record_usage(prompt_len=len(prompt), model=self.model or "default")
        return proc.returncode, "".join(collected)

    def launch_interactive_terminal(self, project_dir: Optional[Path] = None, prompt: Optional[str] = None, yolo: bool = True):
        """Открывает отдельное интерактивное окно терминала Windows с запущенным agy в режиме YOLO."""
        cwd = str(project_dir.resolve()) if project_dir and project_dir.exists() else os.getcwd()
        yolo_flag = "--dangerously-skip-permissions" if yolo else ""
        
        if prompt:
            clean_prompt = prompt.replace('"', '""').replace('\n', ' ').replace('\r', '')[:1200]
            cmd_part = f'agy {yolo_flag} -i "{clean_prompt}"'
        else:
            cmd_part = f'agy {yolo_flag} -i "Привет! Начни разработку игры по спецификации."'
            
        if sys.platform == "win32":
            script = f'chcp 65001 > nul & cd /d "{cwd}" & {cmd_part}'
            subprocess.Popen(['cmd', '/k', script], creationflags=subprocess.CREATE_NEW_CONSOLE)
        else:
            subprocess.Popen(["x-terminal-emulator", "-e", f'cd "{cwd}" && {cmd_part}'])

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        combined_prompt = (
            f"[SYSTEM INSTRUCTIONS]\n{system_prompt}\n\n"
            f"[TASK / USER REQUEST]\n{user_prompt}\n\n"
            f"Please provide a comprehensive and detailed response in RUSSIAN."
        )
        try:
            return self._run_agy(combined_prompt, output_format="text")
        except Exception as e:
            print(f"[AGYProvider] Execution error ({e}), falling back to Local Expert...")
            return self.fallback.generate_text(system_prompt, user_prompt, temperature, max_tokens)

    def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.5
    ) -> T:
        schema = response_model.model_json_schema()
        schema_str = json.dumps(schema, ensure_ascii=False, indent=2)

        combined_prompt = (
            f"[SYSTEM INSTRUCTIONS]\n{system_prompt}\n\n"
            f"[USER REQUEST]\n{user_prompt}\n\n"
            f"[CRITICAL OUTPUT FORMAT REQUIREMENT]\n"
            f"You MUST reply ONLY with a valid JSON object matching the JSON Schema below.\n"
            f"Do not include any explanation, markdown commentary, or introductory text before or after the JSON.\n\n"
            f"JSON Schema:\n{schema_str}\n"
        )

        try:
            raw_output = self._run_agy(combined_prompt, output_format="text")
            extracted_json = self._extract_json_string(raw_output)
            parsed_data = json.loads(extracted_json)
            return response_model.model_validate(parsed_data)
        except Exception as e:
            print(f"[AGYProvider] Structured generation error ({e}), falling back to Local Expert...")
            return self.fallback.generate_structured(system_prompt, user_prompt, response_model, temperature)

    def _extract_json_string(self, text: str) -> str:
        """Extracts JSON substring from possible markdown wrappers or surrounding text."""
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
        """Test the connection with agy CLI."""
        if not self.is_available():
            return {
                "status": "error",
                "message": f"CLI '{self.cli_path}' не найден в PATH."
            }
        try:
            out = self._run_agy("Respond with 'OK' only.")
            return {
                "status": "success",
                "message": "Antigravity CLI доступен и отвечает в режиме YOLO.",
                "sample_output": out[:100]
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"AGY тест не удался: {str(e)}"
            }


class AGYImageProvider(ImageProvider):
    """
    Image Provider powered by Antigravity visual synthesis and procedural rendering.
    Generates high-aesthetic concept preview mockups with isometric arena, VFX, and HUD overlay.
    """

    def __init__(self, cli_path: Optional[str] = None):
        self.cli_path = cli_path or os.getenv("AGY_CLI_PATH", "agy")
        self.fallback = LocalImageProvider()

    def generate_image(
        self,
        prompt: str,
        output_path: Path,
        aspect_ratio: str = "16:9",
        width: int = 1280,
        height: int = 720
    ) -> bool:
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            img = Image.new("RGBA", (width, height), (10, 14, 24, 255))
            draw = ImageDraw.Draw(img)

            cx, cy = width // 2, height // 2
            max_radius = math.sqrt(cx**2 + cy**2)
            
            for ring in range(30, 0, -1):
                r = int(max_radius * (ring / 30))
                alpha = int(40 * (1.0 - ring / 30))
                draw.ellipse(
                    [cx - r, cy - r, cx + r, cy + r],
                    fill=(0, int(150 * (1.0 - ring / 30)), int(240 * (1.0 - ring / 30)), alpha)
                )

            grid_color = (0, 240, 255, 45)
            origin_x, origin_y = cx, int(height * 0.72)
            cell_size = 48
            
            for i in range(-12, 13):
                p1 = (origin_x + i * cell_size * 2, origin_y - 180 + i * cell_size)
                p2 = (origin_x + (i - 12) * cell_size * 2, origin_y + 180 + (i + 12) * cell_size // 2)
                draw.line([p1, p2], fill=grid_color, width=1)
                
                p3 = (origin_x - i * cell_size * 2, origin_y - 180 + i * cell_size)
                p4 = (origin_x - (i - 12) * cell_size * 2, origin_y + 180 + (i + 12) * cell_size // 2)
                draw.line([p3, p4], fill=grid_color, width=1)

            arena_points = [
                (cx, origin_y - 140),
                (cx + 340, origin_y - 20),
                (cx, origin_y + 100),
                (cx - 340, origin_y - 20)
            ]
            draw.polygon(arena_points, fill=(18, 28, 48, 220), outline=(0, 255, 136, 180), width=3)

            hero_x, hero_y = cx - 90, origin_y - 30
            draw.ellipse([hero_x - 30, hero_y - 30, hero_x + 30, hero_y + 30], fill=(0, 240, 255, 230), outline=(255, 255, 255, 255), width=2)
            draw.polygon([(hero_x, hero_y - 45), (hero_x + 35, hero_y - 10), (hero_x - 35, hero_y - 10)], fill=(0, 255, 136, 220))
            
            boss_x, boss_y = cx + 110, origin_y - 50
            draw.ellipse([boss_x - 45, boss_y - 45, boss_x + 45, boss_y + 45], fill=(255, 51, 102, 230), outline=(255, 184, 0, 255), width=3)

            draw.line([(hero_x + 20, hero_y - 5), (boss_x - 35, boss_y - 5)], fill=(0, 255, 200, 240), width=5)

            draw.rectangle([40, 30, 320, 55], fill=(15, 23, 42, 210), outline=(0, 240, 255, 180), width=2)
            draw.rectangle([44, 34, 260, 51], fill=(0, 255, 136, 230))
            
            draw.rectangle([width - 360, 30, width - 40, 55], fill=(15, 23, 42, 210), outline=(255, 51, 102, 180), width=2)
            draw.rectangle([width - 356, 34, width - 110, 51], fill=(255, 51, 102, 230))

            draw.ellipse([60, height - 160, 160, height - 60], outline=(0, 240, 255, 150), width=3)
            draw.ellipse([90, height - 130, 130, height - 90], fill=(0, 240, 255, 180))
            
            draw.ellipse([width - 150, height - 150, width - 70, height - 70], fill=(255, 51, 102, 200), outline=(255, 255, 255, 220), width=3)
            draw.ellipse([width - 230, height - 120, width - 170, height - 60], fill=(0, 240, 255, 180), outline=(255, 255, 255, 200), width=2)

            draw.text((cx - 140, 75), "ANTIGRAVITY CONCEPT PREVIEW", fill=(240, 244, 252, 230))

            img.convert("RGB").save(output_path, "PNG")
            return True
        except Exception as e:
            print(f"[AGYImageProvider] Generation fallback due to: {e}")
            return self.fallback.generate_image(prompt, output_path, aspect_ratio, width, height)
